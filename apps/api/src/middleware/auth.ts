/**
 * Authentication Middleware
 * Handles JWT authentication, API keys, and authorization
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { enterpriseConfig } from '../config/enterprise';
import { enterpriseDb } from '../database/enterprise-database';
import { logger } from '../utils/logger';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        tenantId: string;
        role: string;
        permissions: string[];
      };
      apiKey?: {
        id: string;
        name: string;
        tenantId: string;
        permissions: string[];
      };
    }
  }
}

export interface AuthConfig {
  required?: boolean;
  permissions?: string[];
  roles?: string[];
  allowApiKey?: boolean;
  allowAnonymous?: boolean;
}

/**
 * Main authentication middleware
 */
export function authMiddleware(config: AuthConfig = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        required = true,
        permissions = [],
        roles = [],
        allowApiKey = true,
        allowAnonymous = false,
      } = config;

      // Skip authentication if not required and no auth header present
      if (!required && !req.headers.authorization) {
        return next();
      }

      // Allow anonymous access if configured
      if (allowAnonymous && !req.headers.authorization) {
        return next();
      }

      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        if (required) {
          return res.status(401).json({
            error: 'AUTHENTICATION_REQUIRED',
            message: 'Authorization header is required',
          });
        }
        return next();
      }

      let authenticated = false;

      // Try JWT authentication
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        authenticated = await authenticateJWT(req, token);
      }

      // Try API key authentication if JWT failed and allowed
      if (!authenticated && allowApiKey && authHeader.startsWith('ApiKey ')) {
        const apiKey = authHeader.substring(7);
        authenticated = await authenticateApiKey(req, apiKey);
      }

      if (!authenticated) {
        return res.status(401).json({
          error: 'AUTHENTICATION_FAILED',
          message: 'Invalid authentication credentials',
        });
      }

      // Check role-based access
      if (roles.length > 0) {
        const userRole = req.user?.role || 'viewer';
        if (!roles.includes(userRole)) {
          return res.status(403).json({
            error: 'INSUFFICIENT_ROLE',
            message: `This endpoint requires one of: ${roles.join(', ')}`,
            userRole,
            requiredRoles: roles,
          });
        }
      }

      // Check permission-based access
      if (permissions.length > 0) {
        const userPermissions = req.user?.permissions || req.apiKey?.permissions || [];
        const hasPermission = permissions.some(permission => 
          userPermissions.includes(permission) || 
          userPermissions.includes('admin:*') ||
          userPermissions.some(p => p.endsWith(':*') && permission.startsWith(p.slice(0, -1)))
        );

        if (!hasPermission) {
          return res.status(403).json({
            error: 'INSUFFICIENT_PERMISSIONS',
            message: `This endpoint requires one of: ${permissions.join(', ')}`,
            userPermissions,
            requiredPermissions: permissions,
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Authentication middleware error', { error, path: req.path });
      res.status(500).json({
        error: 'AUTHENTICATION_ERROR',
        message: 'Internal authentication error',
      });
    }
  };
}

/**
 * Authenticate JWT token
 */
export async function authenticateJWT(req: Request, token: string): Promise<boolean> {
  try {
    const decoded = jwt.verify(token, enterpriseConfig.JWT_SECRET) as any;
    
    // Validate token structure
    if (!decoded.sub || !decoded.tenantId) {
      logger.warn('Invalid JWT structure', { decoded });
      return false;
    }

    // TODO: In production, verify user exists and is active in database
    // const user = await getUserById(decoded.sub);
    // if (!user || !user.active) return false;

    req.user = {
      id: decoded.sub,
      email: decoded.email || '',
      tenantId: decoded.tenantId,
      role: decoded.role || 'member',
      permissions: decoded.permissions || [],
    };

    logger.debug('JWT authentication successful', {
      userId: req.user.id,
      tenantId: req.user.tenantId,
      role: req.user.role,
    });

    return true;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('JWT verification failed', { error: error.message });
    } else {
      logger.error('JWT authentication error', { error });
    }
    return false;
  }
}

/**
 * Authenticate API key
 */
async function authenticateApiKey(req: Request, apiKey: string): Promise<boolean> {
  try {
    // Hash the API key to look up in database
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    
    // Look up API key in database
    const keyRecord = await enterpriseDb.getApiKeyByHash(keyHash);
    
    if (!keyRecord) {
      logger.warn('API key not found or expired');
      return false;
    }

    // Validate key is active and not expired
    if (keyRecord.status !== 'active') {
      logger.warn('API key is disabled', { keyId: keyRecord.id });
      return false;
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) <= new Date()) {
      logger.warn('API key has expired', { keyId: keyRecord.id });
      return false;
    }

    // Set API key information on request
    req.apiKey = {
      id: keyRecord.id,
      name: keyRecord.name,
      tenantId: keyRecord.tenant_id,
      permissions: keyRecord.permissions || [],
    };

    // Update last used timestamp (async, don't wait)
    enterpriseDb.updateApiKeyLastUsed(keyRecord.id).catch(error => {
      logger.warn('Failed to update API key last used time', { error, keyId: keyRecord.id });
    });

    logger.debug('API key authentication successful', {
      keyId: req.apiKey.id,
      tenantId: req.apiKey.tenantId,
      keyName: req.apiKey.name,
    });

    return true;
  } catch (error) {
    logger.error('API key authentication error', { error });
    return false;
  }
}

/**
 * Generate JWT token for user
 */
export function generateJWTToken(user: {
  id: string;
  email: string;
  tenantId: string;
  role: string;
  permissions: string[];
}): string {
  const payload = {
    sub: user.id,
    email: user.email,
    tenantId: user.tenantId,
    role: user.role,
    permissions: user.permissions,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  };

  return jwt.sign(payload, enterpriseConfig.JWT_SECRET);
}

/**
 * Generate API key for tenant
 */
export function generateApiKey(tenantId: string): string {
  const randomKey = require('crypto').randomBytes(32).toString('hex');
  return `${tenantId}:${randomKey}`;
}

/**
 * Middleware for specific permissions
 */
export function requirePermission(permission: string) {
  return authMiddleware({
    required: true,
    permissions: [permission],
  });
}

/**
 * Middleware for specific roles
 */
export function requireRole(role: string) {
  return authMiddleware({
    required: true,
    roles: [role],
  });
}

/**
 * Middleware for admin access
 */
export function requireAdmin() {
  return authMiddleware({
    required: true,
    roles: ['admin', 'owner'],
    permissions: ['admin:*'],
  });
}

/**
 * Optional authentication middleware
 */
export function optionalAuth() {
  return authMiddleware({
    required: false,
    allowAnonymous: true,
  });
}

/**
 * API key only authentication
 */
export function apiKeyAuth() {
  return authMiddleware({
    required: true,
    allowApiKey: true,
  });
}

/**
 * Development-only authentication bypass
 */
export function devAuth() {
  return (req: Request, res: Response, next: NextFunction) => {
    logger.debug('devAuth middleware', { 
      nodeEnv: enterpriseConfig.NODE_ENV,
      tenantId: req.tenantId,
      path: req.path 
    });
    
    if (enterpriseConfig.NODE_ENV === 'development') {
      // Set default user in development
      req.user = {
        id: 'dev-user-001',
        email: 'admin@localhost',
        tenantId: req.tenantId || enterpriseConfig.DEFAULT_TENANT_ID,
        role: 'owner',
        permissions: ['admin:*'],
      };
      
      logger.debug('Development user set', { user: req.user });
      return next();
    }
    
    return authMiddleware({ required: true })(req, res, next);
  };
}