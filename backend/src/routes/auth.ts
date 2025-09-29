/**
 * Authentication Routes
 * JWT-based authentication with multi-tenant support
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { enterpriseDb } from '../database/enterprise-database';
import { asyncHandler } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { createHash, randomBytes, randomUUID } from 'crypto';

const router = Router();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Validation schemas
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSubdomain: z.string().optional()
});

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
  companyName: z.string().min(1),
  subdomain: z.string().regex(/^[a-z0-9-]+$/),
  plan: z.enum(['starter', 'professional', 'enterprise']).default('starter')
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Helper functions
function generateJWT(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function generateUUID(): string {
  return randomUUID();
}

function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `pk_${randomBytes(32).toString('hex')}`;
  const hash = createHash('sha256').update(key).digest('hex');
  const prefix = key.substring(0, 12);
  
  return { key, hash, prefix };
}

/**
 * POST /auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password, tenantSubdomain } = LoginSchema.parse(req.body);

  try {
    // Demo user bypass for testing (development only)
    if (email === 'admin@demo.com' && password === 'demo123') {
      const demoUser = {
        id: 'demo-user-001',
        email: 'admin@demo.com',
        name: 'Demo Admin',
        role: 'admin',
        tenant_id: '00000000-0000-0000-0000-000000000001',
        tenant_name: 'Demo Tenant',
        subdomain: 'demo',
        plan: 'enterprise',
        status: 'active'
      };

      // Create JWT payload
      const jwtPayload = {
        userId: demoUser.id,
        email: demoUser.email,
        tenantId: demoUser.tenant_id,
        role: demoUser.role,
        iat: Math.floor(Date.now() / 1000)
      };

      const token = generateJWT(jwtPayload);

      logger.info('Demo user login successful', { email: demoUser.email });

      return res.json({
        success: true,
        token,
        user: {
          id: demoUser.id,
          email: demoUser.email,
          name: demoUser.name,
          role: demoUser.role,
          tenant_id: demoUser.tenant_id,
          settings: {}
        },
        tenant: {
          id: demoUser.tenant_id,
          name: demoUser.tenant_name,
          subdomain: demoUser.subdomain,
          plan: demoUser.plan,
          status: demoUser.status
        }
      });
    }

    // Look up user by email
    const user = await enterpriseDb.get(`
      SELECT u.*, t.id as tenant_id, t.name as tenant_name, t.subdomain, t.plan, t.status
      FROM users u
      JOIN tenants t ON u.tenant_id = t.id
      WHERE u.email = ? AND u.is_active = true AND t.status = 'active'
    `, [email]);

    if (!user) {
      logger.warn('Login attempt with invalid email', { email });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      logger.warn('Login attempt with invalid password', { email });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if specific tenant requested
    if (tenantSubdomain && user.subdomain !== tenantSubdomain) {
      return res.status(401).json({
        success: false,
        message: 'Invalid tenant access'
      });
    }

    // Update last login
    await enterpriseDb.run(`
      UPDATE users SET last_login = ? WHERE id = ?
    `, [new Date().toISOString(), user.id]);

    // Create JWT payload
    const jwtPayload = {
      userId: user.id,
      email: user.email,
      tenantId: user.tenant_id,
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    };

    const token = generateJWT(jwtPayload);

    // Response user data (without sensitive info)
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenant_id: user.tenant_id,
      settings: user.settings ? JSON.parse(user.settings) : {}
    };

    const tenantData = {
      id: user.tenant_id,
      name: user.tenant_name,
      subdomain: user.subdomain,
      plan: user.plan,
      status: user.status
    };

    logger.info('Successful login', { userId: user.id, email: user.email, tenantId: user.tenant_id });

    res.json({
      success: true,
      token,
      user: userData,
      tenant: tenantData
    });

  } catch (error) {
    logger.error('Login error', { email, error });
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}));

/**
 * POST /auth/register
 * Register new user and tenant
 */
router.post('/register', asyncHandler(async (req, res) => {
  const data = RegisterSchema.parse(req.body);

  try {
    // Check if email already exists
    const existingUser = await enterpriseDb.get(`
      SELECT id FROM users WHERE email = ?
    `, [data.email]);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // Check if subdomain is available
    const existingTenant = await enterpriseDb.get(`
      SELECT id FROM tenants WHERE subdomain = ?
    `, [data.subdomain]);

    if (existingTenant) {
      return res.status(409).json({
        success: false,
        message: 'Subdomain already taken'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Generate IDs
    const tenantId = generateUUID();
    const userId = generateUUID();

    // Start transaction
    await enterpriseDb.run('BEGIN TRANSACTION');

    try {
      // Create tenant
      await enterpriseDb.run(`
        INSERT INTO tenants (id, name, subdomain, plan, status, settings, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tenantId,
        data.companyName,
        data.subdomain,
        data.plan,
        'active',
        JSON.stringify({}),
        new Date().toISOString(),
        new Date().toISOString()
      ]);

      // Create owner user
      await enterpriseDb.run(`
        INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active, settings, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        tenantId,
        data.email,
        hashedPassword,
        data.companyName + ' Admin', // Default name
        'admin',
        true,
        JSON.stringify({}),
        new Date().toISOString(),
        new Date().toISOString()
      ]);

      // Create default API key for the tenant
      const { key, hash } = generateApiKey();
      await enterpriseDb.run(`
        INSERT INTO api_keys (id, tenant_id, user_id, name, key_hash, permissions, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        generateUUID(),
        tenantId,
        userId,
        'Default API Key',
        hash,
        JSON.stringify(['read:tests', 'write:tests']),
        true,
        new Date().toISOString()
      ]);

      // Commit transaction
      await enterpriseDb.run('COMMIT');

      // Create JWT payload
      const jwtPayload = {
        userId,
        email: data.email,
        tenantId,
        role: 'admin',
        iat: Math.floor(Date.now() / 1000)
      };

      const token = generateJWT(jwtPayload);

      // Response data
      const userData = {
        id: userId,
        email: data.email,
        name: data.companyName + ' Admin',
        role: 'admin',
        tenant_id: tenantId,
        settings: {}
      };

      const tenantData = {
        id: tenantId,
        name: data.companyName,
        subdomain: data.subdomain,
        plan: data.plan,
        status: 'active'
      };

      logger.info('Successful registration', { userId, email: data.email, tenantId });

      res.status(201).json({
        success: true,
        token,
        user: userData,
        tenant: tenantData
      });

    } catch (dbError) {
      // Rollback transaction on error
      await enterpriseDb.run('ROLLBACK');
      throw dbError;
    }

  } catch (error) {
    logger.error('Registration error', { email: data.email, error });

    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        success: false,
        message: 'Email or subdomain already exists'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
}));

/**
 * GET /auth/me
 * Get current user information
 */
router.get('/me', asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Demo user bypass for testing (development only)
    if (decoded.userId === 'demo-user-001') {
      const userData = {
        id: 'demo-user-001',
        email: 'admin@demo.com',
        name: 'Demo Admin',
        role: 'admin',
        tenant_id: '00000000-0000-0000-0000-000000000001',
        settings: {}
      };

      const tenantData = {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Demo Tenant',
        subdomain: 'demo',
        plan: 'enterprise',
        status: 'active'
      };

      return res.json({
        success: true,
        user: userData,
        tenant: tenantData
      });
    }
    
    // Load user and tenant from database
    const user = await enterpriseDb.get(`
      SELECT u.*, t.name as tenant_name, t.subdomain, t.plan, t.status as tenant_status
      FROM users u
      JOIN tenants t ON u.tenant_id = t.id
      WHERE u.id = ? AND u.is_active = true AND t.status = 'active'
    `, [decoded.userId]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Response data (without sensitive info)
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenant_id: user.tenant_id,
      settings: user.settings ? JSON.parse(user.settings) : {}
    };

    const tenantData = {
      id: user.tenant_id,
      name: user.tenant_name,
      subdomain: user.subdomain,
      plan: user.plan,
      status: user.tenant_status
    };

    res.json({
      success: true,
      user: userData,
      tenant: tenantData
    });

  } catch (error) {
    logger.error('Token verification failed', { error });
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
}));

/**
 * POST /auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Generate new token with extended expiry
    const newToken = generateJWT({
      userId: decoded.userId,
      email: decoded.email,
      tenantId: decoded.tenantId,
      tenants: decoded.tenants,
      role: decoded.role
    });

    res.json({
      success: true,
      token: newToken
    });

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
}));

/**
 * POST /auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', asyncHandler(async (req, res) => {
  // For JWT-based auth, logout is primarily client-side
  // Server can optionally implement token blacklisting
  
  logger.info('User logout requested');
  
  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

// Helper functions for database operations
async function checkSubdomainAvailability(subdomain: string): Promise<boolean> {
  // TODO: Check in database
  // For demo, reject common subdomains
  const reserved = ['admin', 'api', 'www', 'app', 'demo', 'test'];
  return reserved.includes(subdomain);
}

async function createTenantWithOwner(data: {
  companyName: string;
  subdomain: string;
  plan: string;
  ownerEmail: string;
  hashedPassword: string;
}): Promise<any> {
  // TODO: Implement real database creation
  // This would involve:
  // 1. Creating tenant record
  // 2. Creating user record
  // 3. Linking user to tenant with owner role
  // 4. Creating default API key
  // 5. Setting up tenant-specific resources
  
  // For demo, return mock tenant
  return {
    id: `tenant-${Date.now()}`,
    name: data.companyName,
    subdomain: data.subdomain,
    plan: data.plan,
    status: 'active',
    ownerId: `user-${Date.now()}`
  };
}

export { router as authRouter };