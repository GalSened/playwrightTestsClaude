/**
 * Multi-Tenant Middleware
 * Handles tenant identification, validation, and context setting
 */

import { Request, Response, NextFunction } from 'express';
import { enterpriseConfig } from '../config/enterprise';
import { enterpriseDb } from '../database/enterprise-database';
import { logger } from '../utils/logger';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      tenantId: string;
      tenant?: {
        id: string;
        name: string;
        subdomain: string;
        plan: string;
        settings: Record<string, any>;
      };
    }
  }
}

/**
 * Tenant identification and validation middleware
 */
export function tenantMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let tenantId: string;

      if (!enterpriseConfig.ENABLE_MULTI_TENANT) {
        // Single tenant mode - use default tenant
        tenantId = enterpriseConfig.DEFAULT_TENANT_ID;
        req.tenantId = tenantId;
        return next();
      }

      // Multi-tenant mode - extract tenant from various sources
      tenantId = await extractTenantId(req);

      if (!tenantId) {
        return res.status(400).json({
          error: 'TENANT_REQUIRED',
          message: 'Tenant identification is required',
          details: 'Provide tenant ID via header, subdomain, or JWT token',
        });
      }

      // Validate tenant exists and is active
      const tenant = await validateTenant(tenantId);
      
      if (!tenant) {
        return res.status(404).json({
          error: 'TENANT_NOT_FOUND',
          message: 'Tenant not found or inactive',
          tenantId,
        });
      }

      // Set tenant context
      req.tenantId = tenantId;
      req.tenant = {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        plan: tenant.plan,
        settings: tenant.settings,
      };

      logger.debug('Tenant context set', {
        tenantId,
        subdomain: tenant.subdomain,
        plan: tenant.plan,
        path: req.path,
      });

      next();
    } catch (error) {
      logger.error('Tenant middleware error', { error, path: req.path });
      
      res.status(500).json({
        error: 'TENANT_RESOLUTION_ERROR',
        message: 'Failed to resolve tenant context',
      });
    }
  };
}

/**
 * Extract tenant ID from request
 */
async function extractTenantId(req: Request): Promise<string | null> {
  // 1. Check X-Tenant-ID header (highest priority)
  const headerTenantId = req.headers['x-tenant-id'] as string;
  if (headerTenantId) {
    logger.debug('Tenant ID from header', { tenantId: headerTenantId });
    return headerTenantId;
  }

  // 2. Extract from subdomain (e.g., acme.playwright-smart.com -> acme)
  const host = req.headers.host;
  if (host) {
    const subdomain = extractSubdomainFromHost(host);
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      const tenant = await enterpriseDb.getTenantBySubdomain(subdomain);
      if (tenant) {
        logger.debug('Tenant ID from subdomain', { 
          subdomain, 
          tenantId: tenant.id 
        });
        return tenant.id;
      }
    }
  }

  // 3. Extract from JWT token (if present)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const tenantId = extractTenantFromJWT(token);
    if (tenantId) {
      logger.debug('Tenant ID from JWT', { tenantId });
      return tenantId;
    }
  }

  // 4. Check for tenant in query parameters (lowest priority)
  const queryTenantId = req.query.tenantId as string;
  if (queryTenantId) {
    logger.debug('Tenant ID from query', { tenantId: queryTenantId });
    return queryTenantId;
  }

  // 5. Use default tenant if configured
  if (enterpriseConfig.DEFAULT_TENANT_ID) {
    logger.debug('Using default tenant ID', { 
      tenantId: enterpriseConfig.DEFAULT_TENANT_ID 
    });
    return enterpriseConfig.DEFAULT_TENANT_ID;
  }

  logger.warn('No tenant ID found in request', {
    host: req.headers.host,
    hasAuth: !!authHeader,
    hasQuery: !!queryTenantId,
    path: req.path,
  });

  return null;
}

/**
 * Extract subdomain from host header
 */
function extractSubdomainFromHost(host: string): string | null {
  try {
    // Remove port if present
    const hostWithoutPort = host.split(':')[0];
    const parts = hostWithoutPort.split('.');
    
    // For localhost development, no subdomain
    if (hostWithoutPort === 'localhost' || hostWithoutPort.startsWith('localhost:')) {
      return null;
    }
    
    // Need at least 3 parts for subdomain (subdomain.domain.tld)
    if (parts.length < 3) {
      return null;
    }
    
    return parts[0];
  } catch (error) {
    logger.error('Error extracting subdomain', { error, host });
    return null;
  }
}

/**
 * Extract tenant ID from JWT token
 */
function extractTenantFromJWT(token: string): string | null {
  try {
    // This is a simplified JWT parser - in production, use a proper JWT library
    const payload = token.split('.')[1];
    if (!payload) return null;
    
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    return decoded.tenantId || decoded.tenant_id || null;
  } catch (error) {
    logger.debug('Failed to extract tenant from JWT', { error });
    return null;
  }
}

/**
 * Validate tenant exists and is active
 */
async function validateTenant(tenantId: string) {
  try {
    logger.debug('Validating tenant', { tenantId, isUUID: isValidUUID(tenantId) });
    
    // For UUID format tenant IDs, query by ID
    if (isValidUUID(tenantId)) {
      const result = await enterpriseDb.query(
        'SELECT * FROM tenants WHERE id = $1 AND status = $2',
        [tenantId, 'active'],
        undefined,
        true // use read replica
      );
      
      logger.debug('Tenant query result', { 
        rowCount: result.rows.length,
        tenant: result.rows[0] ? 'found' : 'not found'
      });
      
      return result.rows[0] || null;
    }

    // For subdomain format, query by subdomain
    const result = await enterpriseDb.query(
      'SELECT * FROM tenants WHERE subdomain = $1 AND status = $2',
      [tenantId, 'active'],
      undefined,
      true
    );
    
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error validating tenant', { error, tenantId });
    return null;
  }
}

/**
 * Check if string is valid UUID
 */
function isValidUUID(str: string): boolean {
  // More lenient UUID regex that accepts any hex digits in all positions
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Tenant context helper for database operations
 */
export function withTenantContext<T>(
  tenantId: string,
  operation: () => Promise<T>
): Promise<T> {
  // This would set the tenant context for the database operation
  // Implementation depends on your database setup
  return operation();
}

/**
 * Middleware to require specific tenant plans
 */
export function requireTenantPlan(allowedPlans: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant) {
      return res.status(401).json({
        error: 'TENANT_CONTEXT_MISSING',
        message: 'Tenant context required',
      });
    }

    if (!allowedPlans.includes(req.tenant.plan)) {
      return res.status(403).json({
        error: 'INSUFFICIENT_PLAN',
        message: `This feature requires ${allowedPlans.join(' or ')} plan`,
        currentPlan: req.tenant.plan,
        requiredPlans: allowedPlans,
      });
    }

    next();
  };
}

/**
 * Middleware to check tenant resource limits
 */
export function checkTenantLimits(resourceType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.tenant) {
        return next();
      }

      // Get current usage for tenant
      const usage = await getTenantUsage(req.tenantId, resourceType);
      const limits = getTenantLimits(req.tenant.plan);
      
      const limit = limits[resourceType];
      if (limit && usage >= limit) {
        return res.status(429).json({
          error: 'RESOURCE_LIMIT_EXCEEDED',
          message: `${resourceType} limit exceeded`,
          usage,
          limit,
          plan: req.tenant.plan,
        });
      }

      next();
    } catch (error) {
      logger.error('Error checking tenant limits', { 
        error, 
        tenantId: req.tenantId,
        resourceType 
      });
      next(); // Continue on error to avoid blocking
    }
  };
}

/**
 * Get tenant resource usage
 */
async function getTenantUsage(tenantId: string, resourceType: string): Promise<number> {
  try {
    switch (resourceType) {
      case 'test_runs':
        const result = await enterpriseDb.query(
          `SELECT COUNT(*) as count FROM test_runs 
           WHERE tenant_id = $1 AND created_at >= date_trunc('month', NOW())`,
          [tenantId]
        );
        return parseInt(result.rows[0].count);
        
      case 'storage':
        const storageResult = await enterpriseDb.query(
          `SELECT COALESCE(SUM(file_size), 0) as total FROM test_artifacts 
           WHERE tenant_id = $1`,
          [tenantId]
        );
        return parseInt(storageResult.rows[0].total);
        
      default:
        return 0;
    }
  } catch (error) {
    logger.error('Error getting tenant usage', { error, tenantId, resourceType });
    return 0;
  }
}

/**
 * Get tenant plan limits
 */
function getTenantLimits(plan: string): Record<string, number> {
  const limits: Record<string, Record<string, number>> = {
    starter: {
      test_runs: 1000,
      storage: 1024 * 1024 * 1024, // 1GB
      users: 5,
    },
    professional: {
      test_runs: 10000,
      storage: 10 * 1024 * 1024 * 1024, // 10GB
      users: 25,
    },
    enterprise: {
      test_runs: 100000,
      storage: 100 * 1024 * 1024 * 1024, // 100GB
      users: 100,
    },
  };

  return limits[plan] || limits.starter;
}