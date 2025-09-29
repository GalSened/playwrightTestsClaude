# QA Intelligence CI/CD Security Guide

**Version:** 1.0
**Last Updated:** 2025-09-26
**Classification:** Internal Security Documentation
**Owner:** Security Team & DevOps

> **SECURITY STATUS**: Enterprise-grade security architecture with comprehensive threat protection

## Table of Contents

1. [Security Architecture Overview](#security-architecture-overview)
2. [Authentication and Authorization](#authentication-and-authorization)
3. [Network Security](#network-security)
4. [Data Protection](#data-protection)
5. [Credential Management](#credential-management)
6. [API Security](#api-security)
7. [Infrastructure Security](#infrastructure-security)
8. [Monitoring and Incident Response](#monitoring-and-incident-response)
9. [Compliance and Auditing](#compliance-and-auditing)
10. [Security Incident Response](#security-incident-response)

---

## Security Architecture Overview

### Defense in Depth Strategy

QA Intelligence implements a multi-layered security approach:

```
┌─────────────────────────────────────────┐
│             User Layer                  │
├─────────────────────────────────────────┤
│         Application Layer               │
│  ┌─────────────┬─────────────────────┐  │
│  │   Frontend  │      Backend API    │  │
│  │   (React)   │    (Express.js)     │  │
│  └─────────────┴─────────────────────┘  │
├─────────────────────────────────────────┤
│         Infrastructure Layer            │
│  ┌─────────────┬─────────────────────┐  │
│  │   Database  │    File Storage     │  │
│  │  (SQLite/   │    (Local/Cloud)    │  │
│  │ PostgreSQL) │                     │  │
│  └─────────────┴─────────────────────┘  │
├─────────────────────────────────────────┤
│           Network Layer                 │
│     (Firewalls, VPN, Load Balancers)   │
├─────────────────────────────────────────┤
│           Physical Layer                │
│     (Server Hardware, Data Centers)    │
└─────────────────────────────────────────┘
```

### Security Principles

1. **Zero Trust Architecture** - Never trust, always verify
2. **Least Privilege Access** - Minimum necessary permissions
3. **Defense in Depth** - Multiple security layers
4. **Security by Design** - Built-in security from the ground up
5. **Continuous Monitoring** - Real-time threat detection
6. **Incident Response** - Rapid threat containment and recovery

### Threat Model

**Primary Threats:**
- **External Attackers** - Unauthorized access attempts
- **Insider Threats** - Malicious or compromised internal users
- **Data Breaches** - Sensitive test data exposure
- **Service Disruption** - DDoS and availability attacks
- **Code Injection** - SQL injection, XSS, command injection
- **Man-in-the-Middle** - Network traffic interception

**Attack Vectors:**
- Web application vulnerabilities
- API endpoint exploitation
- Database injection attacks
- Network protocol weaknesses
- Social engineering
- Credential compromise

---

## Authentication and Authorization

### Multi-Factor Authentication (MFA)

**Implementation Requirements:**

```yaml
mfa_policy:
  required_roles: [admin, editor, viewer]
  methods:
    - totp: true          # Time-based One-Time Passwords
    - sms: true           # SMS verification
    - email: true         # Email verification
    - hardware: false     # Hardware tokens (future)

  session_management:
    timeout: 24h          # Session timeout
    concurrent_sessions: 3 # Maximum concurrent sessions
    remember_device: 30d  # Device trust duration
```

**TOTP Configuration:**
```javascript
// backend/src/middleware/mfa.ts
const mfaConfig = {
  issuer: 'QA Intelligence',
  window: 2,              // Allow 2 time windows (±60 seconds)
  step: 30,               // 30-second time steps
  digits: 6,              // 6-digit codes
  algorithm: 'sha256'     // SHA-256 hash algorithm
};
```

### JWT Security Implementation

**Token Configuration:**
```javascript
// backend/src/config/jwt.ts
const jwtConfig = {
  secret: process.env.JWT_SECRET,      // 256-bit secret
  algorithm: 'HS256',                  // HMAC SHA-256
  expiresIn: '24h',                    // 24-hour expiry
  issuer: 'qa-intelligence',           // Token issuer
  audience: 'qa-intelligence-api',     // Token audience

  // Security headers
  headers: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'no-referrer'
  }
};
```

**Token Validation Middleware:**
```typescript
// Enhanced JWT validation with security checks
async function validateJWT(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);

    // Verify token signature and claims
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'qa-intelligence',
      audience: 'qa-intelligence-api'
    });

    // Check token blacklist
    if (await isTokenBlacklisted(token)) {
      throw new Error('Token has been revoked');
    }

    // Validate user still exists and is active
    const user = await validateUser(decoded.userId);
    if (!user || !user.is_active) {
      throw new Error('User account is inactive');
    }

    // Check for suspicious activity
    await checkSuspiciousActivity(decoded.userId, req.ip);

    req.user = decoded;
    next();

  } catch (error) {
    logger.warn('JWT validation failed', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}
```

### Role-Based Access Control (RBAC)

**Permission Matrix:**

| Role | Auth | Tests | Reports | Admin | WeSign |
|------|------|-------|---------|-------|--------|
| **Viewer** | ❌ | View | View | ❌ | View |
| **Editor** | ❌ | CRUD | View | ❌ | Execute |
| **Admin** | ✅ | CRUD | CRUD | ✅ | CRUD |
| **Super Admin** | ✅ | CRUD | CRUD | ✅ | CRUD |

**Permission Validation:**
```typescript
// Role-based middleware
function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    // Check user permissions
    const hasPermission = await checkUserPermission(user.userId, permission);

    if (!hasPermission) {
      logger.warn('Access denied - insufficient permissions', {
        userId: user.userId,
        requiredPermission: permission,
        userRole: user.role,
        endpoint: req.path
      });

      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
}

// Usage examples
router.get('/admin/users', authenticateJWT, requirePermission('admin:users:read'), getUserList);
router.post('/tests/execute', authenticateJWT, requirePermission('tests:execute'), executeTests);
router.delete('/schedules/:id', authenticateJWT, requirePermission('schedules:delete'), deleteSchedule);
```

### API Key Management

**API Key Security:**
```typescript
// API key generation with enhanced security
function generateSecureAPIKey(): APIKey {
  const keyLength = 64;                    // 512-bit key
  const prefix = 'qai_';                   // QA Intelligence prefix
  const randomBytes = crypto.randomBytes(keyLength);
  const key = prefix + randomBytes.toString('base64url');

  // Hash the key for storage (never store plain text)
  const hash = crypto
    .createHash('sha256')
    .update(key)
    .digest('hex');

  return {
    key,                    // Return to user once
    hash,                   // Store in database
    prefix: key.substring(0, 8),  // For identification
    created: new Date(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
  };
}

// API key validation middleware
async function validateAPIKey(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey || !apiKey.startsWith('qai_')) {
      throw new Error('Invalid API key format');
    }

    // Hash the provided key
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Look up key in database
    const storedKey = await getAPIKey(keyHash);

    if (!storedKey || !storedKey.is_active) {
      throw new Error('API key not found or inactive');
    }

    // Check expiration
    if (new Date() > storedKey.expires_at) {
      throw new Error('API key has expired');
    }

    // Rate limiting for API keys
    await checkAPIKeyRateLimit(keyHash);

    // Log usage
    await logAPIKeyUsage(storedKey.id, req.ip, req.path);

    req.apiKey = storedKey;
    next();

  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid API key'
    });
  }
}
```

---

## Network Security

### TLS/SSL Configuration

**HTTPS Configuration:**
```javascript
// backend/src/config/tls.ts
const tlsConfig = {
  // TLS 1.3 minimum
  secureProtocol: 'TLSv1_3_method',

  // Strong cipher suites only
  ciphers: [
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-SHA384',
    'ECDHE-RSA-AES128-SHA256'
  ].join(':'),

  // Security headers
  secureHeaders: {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'Referrer-Policy': 'no-referrer-when-downgrade'
  }
};
```

### Firewall Configuration

**Windows Firewall Rules:**
```powershell
# Inbound rules for QA Intelligence services
New-NetFirewallRule -DisplayName "QA Intelligence Backend" -Direction Inbound -LocalPort 8082 -Protocol TCP -Action Allow -Profile Any
New-NetFirewallRule -DisplayName "QA Intelligence Frontend" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow -Profile Any
New-NetFirewallRule -DisplayName "Jenkins CI/CD" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow -Profile Any

# Block dangerous ports
New-NetFirewallRule -DisplayName "Block Telnet" -Direction Inbound -LocalPort 23 -Protocol TCP -Action Block
New-NetFirewallRule -DisplayName "Block FTP" -Direction Inbound -LocalPort 21 -Protocol TCP -Action Block
New-NetFirewallRule -DisplayName "Block SNMP" -Direction Inbound -LocalPort 161 -Protocol UDP -Action Block

# Allow only specific IP ranges (modify as needed)
$AllowedIPs = @("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")
ForEach ($IP in $AllowedIPs) {
    New-NetFirewallRule -DisplayName "Allow Corporate Network - $IP" -Direction Inbound -RemoteAddress $IP -Action Allow
}
```

### Network Segmentation

**Network Architecture:**
```yaml
network_segments:
  dmz:
    subnet: "10.1.0.0/24"
    purpose: "Public-facing services"
    services: ["load_balancer", "reverse_proxy"]

  application_tier:
    subnet: "10.2.0.0/24"
    purpose: "Application services"
    services: ["backend_api", "frontend_server"]

  data_tier:
    subnet: "10.3.0.0/24"
    purpose: "Database and storage"
    services: ["database", "file_storage"]

  management:
    subnet: "10.4.0.0/24"
    purpose: "Management and monitoring"
    services: ["monitoring", "logging", "backup"]
```

### VPN Configuration (Optional)

**OpenVPN Configuration:**
```bash
# Install OpenVPN server
sudo apt update
sudo apt install openvpn easy-rsa

# Configure server
cat > /etc/openvpn/server.conf << EOF
port 1194
proto udp
dev tun
ca ca.crt
cert server.crt
key server.key
dh dh.pem
server 10.8.0.0 255.255.255.0
keepalive 10 120
tls-auth ta.key 0
cipher AES-256-CBC
user nobody
group nogroup
persist-key
persist-tun
status openvpn-status.log
verb 3
explicit-exit-notify 1
EOF
```

---

## Data Protection

### Encryption at Rest

**Database Encryption:**
```sql
-- SQLite encryption (using SQLCipher)
PRAGMA key = 'your-encryption-key-here';
PRAGMA cipher_page_size = 4096;
PRAGMA cipher_use_hmac = ON;
PRAGMA cipher_kdf_iter = 64000;

-- PostgreSQL encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt sensitive columns
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    phone_encrypted BYTEA,  -- Encrypted with pgcrypto
    ssn_encrypted BYTEA,    -- Encrypted sensitive data
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert encrypted data
INSERT INTO users (phone_encrypted)
VALUES (pgp_sym_encrypt('555-1234', 'encryption-key'));

-- Query encrypted data
SELECT pgp_sym_decrypt(phone_encrypted, 'encryption-key')
FROM users WHERE id = $1;
```

**File System Encryption:**
```powershell
# Windows BitLocker encryption
Enable-BitLocker -MountPoint "C:" -EncryptionMethod XtsAes256 -UsedSpaceOnly

# Verify encryption status
Get-BitLockerVolume -MountPoint "C:"

# Linux LUKS encryption
sudo cryptsetup luksFormat /dev/sdb1
sudo cryptsetup luksOpen /dev/sdb1 encrypted_storage
sudo mkfs.ext4 /dev/mapper/encrypted_storage
```

### Encryption in Transit

**API Security Headers:**
```typescript
// Security middleware for all API endpoints
app.use((req: Request, res: Response, next: NextFunction) => {
  // HSTS - Force HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content Security Policy
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "connect-src 'self' ws: wss:;"
  );

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');

  // Permissions Policy
  res.setHeader('Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  next();
});
```

### Data Classification and Handling

**Data Classification Matrix:**

| Classification | Examples | Storage | Transmission | Retention |
|----------------|----------|---------|--------------|-----------|
| **Public** | Documentation, API specs | Unencrypted | HTTP/HTTPS | Indefinite |
| **Internal** | Test results, metrics | Encrypted at rest | HTTPS only | 2 years |
| **Confidential** | User credentials, API keys | AES-256 encryption | TLS 1.3 | 1 year |
| **Restricted** | Personal data, financial | AES-256 + HSM | mTLS + VPN | 90 days |

**Data Handling Procedures:**
```typescript
// Data classification middleware
function classifyAndProtectData(dataType: DataClassification) {
  return (req: Request, res: Response, next: NextFunction) => {
    switch (dataType) {
      case 'confidential':
        // Require HTTPS
        if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
          return res.status(403).json({
            error: 'HTTPS required for confidential data'
          });
        }

        // Require authentication
        if (!req.user) {
          return res.status(401).json({
            error: 'Authentication required'
          });
        }

        // Add audit logging
        auditLogger.log('confidential_data_access', {
          userId: req.user.userId,
          endpoint: req.path,
          timestamp: new Date().toISOString()
        });
        break;

      case 'restricted':
        // Enhanced security for restricted data
        if (!req.user || !req.user.permissions.includes('restricted_access')) {
          return res.status(403).json({
            error: 'Restricted access required'
          });
        }

        // Require MFA verification
        if (!req.user.mfaVerified) {
          return res.status(403).json({
            error: 'MFA verification required'
          });
        }
        break;
    }

    next();
  };
}
```

---

## Credential Management

### Secret Management Architecture

**HashiCorp Vault Integration (Recommended):**
```javascript
// backend/src/config/vault.js
const vault = require('node-vault')({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_URL || 'https://vault.company.com:8200',
  token: process.env.VAULT_TOKEN
});

class SecretManager {
  async getSecret(path: string): Promise<string> {
    try {
      const result = await vault.read(`secret/data/qa-intelligence/${path}`);
      return result.data.data.value;
    } catch (error) {
      logger.error('Failed to retrieve secret', { path, error });
      throw new Error('Secret retrieval failed');
    }
  }

  async setSecret(path: string, value: string): Promise<void> {
    try {
      await vault.write(`secret/data/qa-intelligence/${path}`, {
        data: { value }
      });
      logger.info('Secret stored successfully', { path });
    } catch (error) {
      logger.error('Failed to store secret', { path, error });
      throw new Error('Secret storage failed');
    }
  }

  async rotateSecret(path: string): Promise<string> {
    const newSecret = crypto.randomBytes(32).toString('hex');
    await this.setSecret(path, newSecret);
    return newSecret;
  }
}
```

**Environment Variable Security:**
```bash
# .env.example - Template for secure configuration
# Copy to .env and fill in actual values
# NEVER commit .env to version control

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/qa_intelligence
DATABASE_ENCRYPTION_KEY=CHANGE_THIS_TO_64_CHARACTER_HEX_STRING

# JWT Configuration
JWT_SECRET=CHANGE_THIS_TO_SECURE_256_BIT_SECRET
JWT_EXPIRES_IN=24h

# External Services
WESIGN_API_KEY=your_wesign_api_key_here
WESIGN_BASE_URL=https://devtest.comda.co.il

# Monitoring
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
EMAIL_SMTP_PASSWORD=app_specific_password

# Encryption Keys
DATA_ENCRYPTION_KEY=CHANGE_THIS_TO_SECURE_AES_KEY
FILE_ENCRYPTION_KEY=CHANGE_THIS_TO_SECURE_AES_KEY
```

### Key Rotation Strategy

**Automated Key Rotation:**
```typescript
// backend/src/services/key-rotation.ts
class KeyRotationService {
  private readonly rotationSchedule = {
    jwt_secret: '90d',      // Rotate JWT secrets every 90 days
    api_keys: '365d',       // Rotate API keys annually
    database_keys: '180d',  // Rotate DB encryption keys bi-annually
    tls_certificates: '365d' // Rotate TLS certs annually
  };

  async rotateJWTSecret(): Promise<void> {
    logger.info('Starting JWT secret rotation');

    // Generate new secret
    const newSecret = crypto.randomBytes(32).toString('hex');

    // Update vault
    await secretManager.setSecret('jwt/secret', newSecret);

    // Update environment
    process.env.JWT_SECRET = newSecret;

    // Notify administrators
    await notificationService.send({
      type: 'security_alert',
      message: 'JWT secret rotated successfully',
      recipients: ['security@company.com']
    });

    logger.info('JWT secret rotation completed');
  }

  async scheduleRotations(): Promise<void> {
    // Schedule automatic rotations
    cron.schedule('0 2 * * 0', () => {  // Weekly check
      this.checkAndRotateKeys();
    });
  }

  private async checkAndRotateKeys(): Promise<void> {
    for (const [keyType, interval] of Object.entries(this.rotationSchedule)) {
      const lastRotation = await this.getLastRotation(keyType);

      if (this.shouldRotate(lastRotation, interval)) {
        await this.rotateKey(keyType);
      }
    }
  }
}
```

### Secure Secret Storage

**Local Development Security:**
```powershell
# Windows Credential Manager integration
function Set-SecureCredential {
    param(
        [string]$Target,
        [string]$Username,
        [string]$Password
    )

    $SecurePassword = ConvertTo-SecureString $Password -AsPlainText -Force
    $Credential = New-Object System.Management.Automation.PSCredential($Username, $SecurePassword)

    # Store in Windows Credential Manager
    cmdkey /generic:$Target /user:$Username /pass:$Password
}

# Retrieve credentials securely
function Get-SecureCredential {
    param([string]$Target)

    try {
        $Credential = Get-StoredCredential -Target $Target
        return $Credential
    }
    catch {
        Write-Error "Failed to retrieve credential for $Target"
        return $null
    }
}
```

---

## API Security

### Input Validation and Sanitization

**Request Validation Middleware:**
```typescript
// backend/src/middleware/validation.ts
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import rateLimit from 'express-rate-limit';

// Input sanitization
function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove potential XSS
    let sanitized = DOMPurify.sanitize(input);

    // Remove SQL injection patterns
    sanitized = sanitized.replace(/[';--]|\/\*.*\*\//g, '');

    // Remove command injection patterns
    sanitized = sanitized.replace(/[;&|`$(){}[\]\\]/g, '');

    return sanitized;
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
}

// Validation schemas
const TestExecutionSchema = z.object({
  testIds: z.array(z.string().regex(/^[a-zA-Z0-9-_]+$/)).optional(),
  suites: z.array(z.string().max(50)).optional(),
  browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
  workers: z.number().min(1).max(10).default(2),
  timeout: z.number().min(1000).max(3600000).default(300000),
  tags: z.array(z.string().max(30)).optional()
});

// Validation middleware factory
function validateRequest(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize input first
      req.body = sanitizeInput(req.body);
      req.query = sanitizeInput(req.query);
      req.params = sanitizeInput(req.params);

      // Validate against schema
      const validatedData = schema.parse(req.body);
      req.body = validatedData;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }

      logger.error('Input validation error', { error });
      res.status(500).json({
        success: false,
        error: 'Internal validation error'
      });
    }
  };
}
```

### Rate Limiting and DDoS Protection

**Advanced Rate Limiting:**
```typescript
// backend/src/middleware/rate-limiting.ts
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD
});

// Different rate limits for different endpoints
const createRateLimit = (windowMs: number, maxRequests: number, message: string) => {
  return rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: 'rl:'
    }),
    windowMs,
    max: maxRequests,
    message: {
      success: false,
      error: 'Rate Limit Exceeded',
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,

    // Custom key generator (include IP and user ID)
    keyGenerator: (req) => {
      const user = req.user;
      return `${req.ip}:${user ? user.userId : 'anonymous'}`;
    },

    // Skip rate limiting for admin users
    skip: (req) => {
      return req.user && req.user.role === 'super_admin';
    }
  });
};

// Rate limiting configurations
export const rateLimits = {
  // Authentication endpoints - stricter limits
  auth: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    5,              // 5 attempts
    'Too many authentication attempts. Try again in 15 minutes.'
  ),

  // Test execution - moderate limits
  execution: createRateLimit(
    60 * 1000,      // 1 minute
    10,             // 10 executions per minute
    'Too many test execution requests. Try again in 1 minute.'
  ),

  // General API - generous limits
  api: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    100,            // 100 requests
    'Too many API requests. Try again in 15 minutes.'
  ),

  // WebSocket connections - very strict
  websocket: createRateLimit(
    5 * 60 * 1000,  // 5 minutes
    3,              // 3 connections
    'Too many WebSocket connection attempts.'
  )
};
```

### SQL Injection Prevention

**Parameterized Queries:**
```typescript
// backend/src/database/queries.ts
import { Database } from 'sqlite3';

class SecureQueryBuilder {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  // Secure user lookup with parameterized query
  async getUserByEmail(email: string): Promise<User | null> {
    // SECURE: Using parameterized query
    const query = `
      SELECT u.*, t.name as tenant_name, t.subdomain
      FROM users u
      JOIN tenants t ON u.tenant_id = t.id
      WHERE u.email = ? AND u.is_active = true
    `;

    return new Promise((resolve, reject) => {
      this.db.get(query, [email], (err, row) => {
        if (err) {
          logger.error('Database query failed', { error: err, email });
          reject(err);
        } else {
          resolve(row as User || null);
        }
      });
    });
  }

  // INSECURE example - NEVER do this
  async insecureUserLookup(email: string): Promise<User | null> {
    // VULNERABLE TO SQL INJECTION
    const query = `SELECT * FROM users WHERE email = '${email}'`;
    // An attacker could input: admin@test.com' OR '1'='1

    // DON'T USE THIS APPROACH
    return null;
  }

  // Secure dynamic query building
  async buildSecureQuery(filters: QueryFilters): Promise<string> {
    let query = 'SELECT * FROM test_executions WHERE 1=1';
    const params: any[] = [];

    if (filters.dateFrom) {
      query += ' AND created_at >= ?';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      query += ' AND created_at <= ?';
      params.push(filters.dateTo);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(filters.limit || 50);

    return { query, params };
  }
}
```

---

## Infrastructure Security

### Container Security

**Docker Security Configuration:**
```dockerfile
# Secure Dockerfile for QA Intelligence
FROM node:18-alpine AS base

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S qauser -u 1001

# Security: Update packages and install security patches
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Security: Set secure working directory
WORKDIR /app

# Security: Copy package files first for better layer caching
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Security: Copy application code
COPY --chown=qauser:nodejs . .

# Security: Remove unnecessary files
RUN rm -rf .env .env.* *.md

# Security: Switch to non-root user
USER qauser

# Security: Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Security: Run as non-privileged port
EXPOSE 8082

CMD ["node", "dist/server.js"]
```

**Docker Compose Security:**
```yaml
# docker-compose.secure.yml
version: '3.8'

services:
  qa-intelligence:
    build: .
    ports:
      - "127.0.0.1:8082:8082"  # Bind to localhost only
    environment:
      - NODE_ENV=production
    volumes:
      - ./logs:/app/logs:rw
      - ./data:/app/data:rw
    restart: unless-stopped

    # Security configurations
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID

    # Resource limits
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.50'
        reservations:
          memory: 512M
          cpus: '0.25'

    # Health check
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8082/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    networks:
      - qa-network

networks:
  qa-network:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.20.0.0/16
```

### Server Hardening

**Windows Server Hardening:**
```powershell
# Disable unnecessary services
$ServicesToDisable = @(
    "Fax", "NetTcpPortSharing", "RemoteRegistry",
    "Telephony", "WebClient", "WinRM"
)

foreach ($Service in $ServicesToDisable) {
    try {
        Stop-Service -Name $Service -Force -ErrorAction SilentlyContinue
        Set-Service -Name $Service -StartupType Disabled -ErrorAction SilentlyContinue
        Write-Host "Disabled service: $Service" -ForegroundColor Green
    }
    catch {
        Write-Warning "Could not disable service: $Service"
    }
}

# Configure Windows Firewall
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
Set-NetFirewallProfile -Profile Domain,Public,Private -DefaultInboundAction Block
Set-NetFirewallProfile -Profile Domain,Public,Private -DefaultOutboundAction Allow

# Disable SMBv1
Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -NoRestart

# Configure audit policies
auditpol /set /subcategory:"Logon" /success:enable /failure:enable
auditpol /set /subcategory:"Account Lockout" /success:enable /failure:enable
auditpol /set /subcategory:"Credential Validation" /success:enable /failure:enable

# Set strong password policy
net accounts /minpwlen:12 /maxpwage:90 /minpwage:1 /lockoutthreshold:5 /lockoutduration:30

# Enable Windows Defender
Set-MpPreference -DisableRealtimeMonitoring $false
Set-MpPreference -DisableIOAVProtection $false
Set-MpPreference -DisableBehaviorMonitoring $false
```

**Linux Server Hardening:**
```bash
#!/bin/bash
# Linux server hardening script

# Update system packages
apt update && apt upgrade -y

# Configure SSH security
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config
systemctl restart sshd

# Configure firewall (UFW)
ufw default deny incoming
ufw default allow outgoing
ufw allow 2222/tcp  # SSH
ufw allow 443/tcp   # HTTPS
ufw allow 8082/tcp  # QA Intelligence Backend
ufw --force enable

# Install and configure fail2ban
apt install fail2ban -y
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = 2222
EOF
systemctl enable fail2ban
systemctl start fail2ban

# Configure automatic security updates
apt install unattended-upgrades -y
echo 'Unattended-Upgrade::Automatic-Reboot "false";' >> /etc/apt/apt.conf.d/50unattended-upgrades

# Disable unnecessary services
systemctl disable cups
systemctl disable bluetooth
systemctl disable avahi-daemon

# Set proper file permissions
chmod 700 /root
chmod 600 /etc/ssh/sshd_config
chmod 644 /etc/passwd
chmod 600 /etc/shadow
```

---

## Monitoring and Incident Response

### Security Event Monitoring

**Security Event Logger:**
```typescript
// backend/src/utils/security-logger.ts
import winston from 'winston';

const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),

  transports: [
    // File transport for security events
    new winston.transports.File({
      filename: 'logs/security.log',
      level: 'warn'
    }),

    // Console transport for development
    new winston.transports.Console({
      format: winston.format.simple()
    }),

    // External SIEM integration (optional)
    new winston.transports.Http({
      host: 'siem.company.com',
      port: 9200,
      path: '/security-events'
    })
  ]
});

// Security event types
enum SecurityEventType {
  LOGIN_ATTEMPT = 'login_attempt',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  PASSWORD_CHANGE = 'password_change',
  PERMISSION_DENIED = 'permission_denied',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  API_ABUSE = 'api_abuse',
  DATA_ACCESS = 'data_access',
  PRIVILEGE_ESCALATION = 'privilege_escalation'
}

class SecurityMonitor {
  static logSecurityEvent(
    eventType: SecurityEventType,
    details: any,
    req?: Request
  ): void {
    const event = {
      eventType,
      timestamp: new Date().toISOString(),
      details,
      source: {
        ip: req?.ip,
        userAgent: req?.get('User-Agent'),
        userId: req?.user?.userId,
        sessionId: req?.sessionID
      }
    };

    securityLogger.warn('Security Event', event);

    // Check for critical events that need immediate attention
    if (this.isCriticalEvent(eventType, details)) {
      this.triggerAlert(event);
    }
  }

  private static isCriticalEvent(eventType: SecurityEventType, details: any): boolean {
    switch (eventType) {
      case SecurityEventType.PRIVILEGE_ESCALATION:
      case SecurityEventType.API_ABUSE:
        return true;
      case SecurityEventType.LOGIN_FAILURE:
        return details.consecutiveFailures > 5;
      case SecurityEventType.SUSPICIOUS_ACTIVITY:
        return details.riskScore > 0.8;
      default:
        return false;
    }
  }

  private static async triggerAlert(event: any): Promise<void> {
    // Send immediate alert to security team
    await notificationService.sendSecurityAlert({
      severity: 'critical',
      event,
      recipients: ['security@company.com', 'soc@company.com']
    });

    // Log to SIEM
    await siemIntegration.sendEvent(event);
  }
}
```

### Anomaly Detection

**Behavioral Analysis:**
```typescript
// backend/src/services/anomaly-detection.ts
class AnomalyDetectionService {
  private userBaselines: Map<string, UserBaseline> = new Map();

  async analyzeUserBehavior(userId: string, activity: UserActivity): Promise<AnomalyScore> {
    const baseline = await this.getUserBaseline(userId);

    let anomalyScore = 0;
    const factors: string[] = [];

    // Check login patterns
    if (this.isUnusualLoginTime(activity.timestamp, baseline.loginTimes)) {
      anomalyScore += 0.3;
      factors.push('unusual_login_time');
    }

    // Check location patterns
    if (this.isUnusualLocation(activity.location, baseline.locations)) {
      anomalyScore += 0.4;
      factors.push('unusual_location');
    }

    // Check API usage patterns
    if (this.isUnusualAPIUsage(activity.apiCalls, baseline.apiUsage)) {
      anomalyScore += 0.2;
      factors.push('unusual_api_usage');
    }

    // Check data access patterns
    if (this.isUnusualDataAccess(activity.dataAccess, baseline.dataAccess)) {
      anomalyScore += 0.5;
      factors.push('unusual_data_access');
    }

    const result: AnomalyScore = {
      score: anomalyScore,
      factors,
      risk: this.calculateRiskLevel(anomalyScore),
      timestamp: new Date().toISOString()
    };

    // Log if anomaly detected
    if (anomalyScore > 0.6) {
      SecurityMonitor.logSecurityEvent(
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        { anomalyScore: result, userId, activity }
      );
    }

    return result;
  }

  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score < 0.3) return 'low';
    if (score < 0.6) return 'medium';
    if (score < 0.8) return 'high';
    return 'critical';
  }
}
```

---

## Compliance and Auditing

### Audit Logging

**Comprehensive Audit Trail:**
```typescript
// backend/src/middleware/audit-logging.ts
interface AuditEvent {
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  details: any;
  result: 'success' | 'failure';
  ip: string;
  userAgent: string;
  sessionId: string;
}

class AuditLogger {
  private static instance: AuditLogger;
  private auditEvents: AuditEvent[] = [];

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  async logAuditEvent(event: Partial<AuditEvent>, req: Request): Promise<void> {
    const fullEvent: AuditEvent = {
      timestamp: new Date().toISOString(),
      userId: req.user?.userId || 'anonymous',
      action: event.action || 'unknown',
      resource: event.resource || req.path,
      details: event.details || {},
      result: event.result || 'success',
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      sessionId: req.sessionID || 'unknown'
    };

    // Store in database
    await this.storeAuditEvent(fullEvent);

    // Log to file
    auditFileLogger.info('Audit Event', fullEvent);

    // Send to external audit system if configured
    if (process.env.AUDIT_ENDPOINT) {
      await this.sendToExternalAuditSystem(fullEvent);
    }
  }

  private async storeAuditEvent(event: AuditEvent): Promise<void> {
    try {
      await database.run(`
        INSERT INTO audit_events
        (timestamp, user_id, action, resource, details, result, ip, user_agent, session_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        event.timestamp,
        event.userId,
        event.action,
        event.resource,
        JSON.stringify(event.details),
        event.result,
        event.ip,
        event.userAgent,
        event.sessionId
      ]);
    } catch (error) {
      logger.error('Failed to store audit event', { error, event });
    }
  }
}

// Audit middleware for sensitive operations
function auditSensitiveOperation(action: string, resource: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Capture original end method
    const originalEnd = res.end;

    res.end = function(chunk: any, encoding: any) {
      const duration = Date.now() - startTime;
      const success = res.statusCode < 400;

      // Log the audit event
      AuditLogger.getInstance().logAuditEvent({
        action,
        resource,
        result: success ? 'success' : 'failure',
        details: {
          statusCode: res.statusCode,
          duration,
          requestBody: req.body,
          responseSize: chunk ? chunk.length : 0
        }
      }, req);

      // Call original end method
      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}
```

### Compliance Standards

**GDPR Compliance Implementation:**
```typescript
// backend/src/services/gdpr-compliance.ts
class GDPRComplianceService {
  // Right to Access (Article 15)
  async exportUserData(userId: string): Promise<any> {
    const userData = await this.aggregateUserData(userId);

    const exportData = {
      personal_data: userData.profile,
      test_history: userData.testRuns,
      preferences: userData.settings,
      audit_trail: userData.auditEvents,
      export_date: new Date().toISOString(),
      retention_period: '2 years',
      data_controller: 'QA Intelligence Team'
    };

    // Log data export request
    await AuditLogger.getInstance().logAuditEvent({
      action: 'data_export',
      resource: 'user_data',
      details: { exportedUserId: userId }
    }, null as any);

    return exportData;
  }

  // Right to Rectification (Article 16)
  async updateUserData(userId: string, updates: any): Promise<void> {
    await database.transaction(async (tx) => {
      // Update user data
      await tx.run(`
        UPDATE users SET
          name = ?,
          email = ?,
          phone = ?,
          updated_at = ?
        WHERE id = ?
      `, [updates.name, updates.email, updates.phone, new Date().toISOString(), userId]);

      // Log rectification
      await AuditLogger.getInstance().logAuditEvent({
        action: 'data_rectification',
        resource: 'user_profile',
        details: { updatedFields: Object.keys(updates) }
      }, null as any);
    });
  }

  // Right to Erasure (Article 17)
  async deleteUserData(userId: string, reason: string): Promise<void> {
    await database.transaction(async (tx) => {
      // Anonymize rather than hard delete for audit purposes
      await tx.run(`
        UPDATE users SET
          email = 'deleted-' || id || '@anonymized.local',
          name = 'Deleted User',
          phone = NULL,
          is_active = false,
          deleted_at = ?,
          deletion_reason = ?
        WHERE id = ?
      `, [new Date().toISOString(), reason, userId]);

      // Delete sensitive test data
      await tx.run(`DELETE FROM user_test_results WHERE user_id = ?`, [userId]);
      await tx.run(`DELETE FROM user_preferences WHERE user_id = ?`, [userId]);

      // Log erasure
      await AuditLogger.getInstance().logAuditEvent({
        action: 'data_erasure',
        resource: 'user_data',
        details: { reason, userId }
      }, null as any);
    });
  }

  // Data Retention Policy
  async enforceRetentionPolicy(): Promise<void> {
    const retentionPeriods = {
      audit_events: '7 years',
      test_results: '2 years',
      user_sessions: '30 days',
      error_logs: '1 year'
    };

    // Clean up old data based on retention policy
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    await database.run(`
      DELETE FROM test_results
      WHERE created_at < ? AND retention_override = false
    `, [twoYearsAgo.toISOString()]);

    logger.info('Retention policy enforcement completed', {
      cleanupDate: twoYearsAgo.toISOString()
    });
  }
}
```

---

## Security Incident Response

### Incident Response Plan

**Incident Classification and Response Times:**

| Severity | Description | Response Time | Escalation |
|----------|-------------|---------------|------------|
| **Critical** | System compromise, data breach | 15 minutes | CISO, Legal |
| **High** | Service disruption, potential breach | 1 hour | Security Team Lead |
| **Medium** | Security policy violation | 4 hours | Security Analyst |
| **Low** | Minor security issue | 24 hours | System Administrator |

**Incident Response Playbook:**

```yaml
incident_response_phases:
  preparation:
    - Maintain incident response team contacts
    - Keep incident response tools ready
    - Regular security training and drills
    - Document communication channels

  identification:
    - Monitor security alerts and logs
    - Analyze suspicious activities
    - Determine if incident is confirmed
    - Initial impact assessment

  containment:
    short_term:
      - Isolate affected systems
      - Preserve evidence
      - Implement temporary fixes
      - Monitor for lateral movement

    long_term:
      - Apply security patches
      - Rebuild compromised systems
      - Implement additional controls
      - Update security policies

  eradication:
    - Remove malware and unauthorized access
    - Close attack vectors
    - Apply security updates
    - Validate system integrity

  recovery:
    - Restore systems from clean backups
    - Return to normal operations
    - Monitor for recurring issues
    - Conduct lessons learned session

  lessons_learned:
    - Document incident details
    - Analyze response effectiveness
    - Update incident response plan
    - Improve security controls
```

### Automated Incident Response

**Automated Response Actions:**
```typescript
// backend/src/services/incident-response.ts
class AutomatedIncidentResponse {
  async respondToIncident(incident: SecurityIncident): Promise<void> {
    logger.info('Automated incident response triggered', {
      incidentId: incident.id,
      severity: incident.severity
    });

    switch (incident.type) {
      case 'brute_force_attack':
        await this.handleBruteForceAttack(incident);
        break;

      case 'data_exfiltration':
        await this.handleDataExfiltration(incident);
        break;

      case 'malware_detection':
        await this.handleMalwareDetection(incident);
        break;

      case 'privilege_escalation':
        await this.handlePrivilegeEscalation(incident);
        break;

      default:
        await this.handleGenericIncident(incident);
    }
  }

  private async handleBruteForceAttack(incident: SecurityIncident): Promise<void> {
    const attackerIP = incident.details.sourceIP;

    // Immediate containment
    await this.blockIP(attackerIP, '24h');

    // Disable affected accounts temporarily
    if (incident.details.targetAccounts) {
      await this.temporaryAccountLockdown(incident.details.targetAccounts);
    }

    // Enhance monitoring for related IPs
    await this.enhanceMonitoring(this.getRelatedIPs(attackerIP));

    // Notify security team
    await this.notifySecurityTeam(incident);

    logger.info('Brute force attack response completed', {
      blockedIP: attackerIP,
      affectedAccounts: incident.details.targetAccounts?.length || 0
    });
  }

  private async handleDataExfiltration(incident: SecurityIncident): Promise<void> {
    // Critical response - escalate immediately
    await this.escalateToSOC(incident);

    // Block network traffic from affected systems
    await this.isolateAffectedSystems(incident.details.affectedSystems);

    // Force password reset for potentially compromised accounts
    await this.forcePasswordReset(incident.details.userAccounts);

    // Enable enhanced logging
    await this.enableEnhancedLogging();

    // Preserve forensic evidence
    await this.preserveEvidence(incident);

    logger.critical('Data exfiltration response initiated', {
      incidentId: incident.id,
      affectedSystems: incident.details.affectedSystems
    });
  }

  private async blockIP(ip: string, duration: string): Promise<void> {
    // Add to firewall block list
    await firewallService.blockIP(ip, duration);

    // Add to rate limiting blacklist
    await rateLimitingService.blacklistIP(ip);

    // Log the action
    SecurityMonitor.logSecurityEvent(
      SecurityEventType.SUSPICIOUS_ACTIVITY,
      { action: 'ip_blocked', ip, duration }
    );
  }
}
```

### Communication Plan

**Stakeholder Communication Matrix:**

```typescript
const communicationPlan = {
  internal: {
    security_team: {
      channels: ['slack:#security', 'email:security@company.com'],
      incidents: ['all'],
      response_time: '5 minutes'
    },

    executive_team: {
      channels: ['email:executives@company.com', 'sms'],
      incidents: ['critical', 'high'],
      response_time: '30 minutes'
    },

    development_team: {
      channels: ['slack:#dev-alerts', 'email:dev@company.com'],
      incidents: ['system_compromise', 'vulnerability'],
      response_time: '15 minutes'
    },

    legal_team: {
      channels: ['email:legal@company.com'],
      incidents: ['data_breach', 'compliance_violation'],
      response_time: '1 hour'
    }
  },

  external: {
    customers: {
      channels: ['status_page', 'email_notification'],
      incidents: ['service_disruption', 'data_breach'],
      approval_required: true,
      approver: 'ciso'
    },

    regulators: {
      channels: ['formal_notification', 'regulatory_portal'],
      incidents: ['data_breach', 'gdpr_violation'],
      timeline: '72 hours',
      approval_required: true,
      approver: 'legal_team'
    }
  }
};
```

---

**Document Status:**
- Version: 1.0
- Classification: Internal Security Documentation
- Last Updated: 2025-09-26
- Next Security Review: 2026-01-26
- Approved By: CISO, Security Team Lead
- Distribution: DevOps Team, Security Team, Engineering Management