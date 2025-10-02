/**
 * Test JWT Helper
 * Fake JWT signing and verification for A2A tests
 */

import * as jwt from 'jsonwebtoken';
import type { A2AJWTClaims, JWTVerificationConfig } from '../../src/a2a/security/jwt.js';

/**
 * Test secret (NEVER use in production)
 */
export const TEST_SECRET = 'test-secret-key-for-a2a-tests-only';

/**
 * Test RSA key pair (2048-bit, generated for tests only, NEVER use in production)
 */
export const TEST_RSA_KEYS = {
  private: `-----BEGIN RSA PRIVATE KEY-----
MIIEogIBAAKCAQEA2WO91KQy2kb4Ix9dpXgD3oPLQi0iLq+Mzo/Z2YlKbe0L1kLD
Re2LaeB7VYWAfj2H5S7zA7bBsKIUZWg406H/Lg7BJpXMCP4fGCOyLHjK3n7m9prE
0voLw5GRXkhzZlyXZNHo5yVXFFnFRhWDLehIcU6tm3drYrdcC5m1bJw3nZNy5nJo
K25XeJb063qhSmLOpt6mGmJDsd3jw/In67vIomSeaqSHiJRiFWvTlRbKAZIPtyfj
pQZOow8ewcAJ2WbTzCChjMchhJ0ELnqeUvbxrgKXOizyPZLhwhCMlsMhOdJpE/k3
4sOXa6lz1rTKDDKcta/LQtV04ZIAfn3uGE2lfwIDAQABAoIBACJeM2+/uc5qc+ZR
miOD0tDF80d2DTZmSJOLiHxsyRiR5lIsYeTXRjgp5jXCEmti3O4tuvu2U+7R4Pmb
PYivzsEAUicAfa5aRp4xXoTLX/9G/sqz8zQLlfqIM/w85gmjz8d/rBuG+rpb6uVG
l2OVmoZXUvkGKzMDHAk1dspB9ETz9PBynAvrE9G1sydAj5qANl58qUarvnLvZVV/
dpDDVEudZlecGJEP68MnKDijSF883kKVVZ+NhpynJzxqfjLDmClLzmBHL9uFO3bq
Hj2yS0wCXAXBBRLefE+Frb89bFFky5aORRm+8GAtyeH4a50UuRluQ+oxU1OO7f91
U5ennZkCgYEA+/ZLUYjZnAMDHv8sv6Y/xQRSUYPzcRNYAOAeaE4pVRCahywO0QKf
lCBA464MyU3FU7dxhLBNByDcoJRWeUBZujvqUnJyvoL65py+D55vkjZdzoh568D2
KGFcF00T758KW4daMYQHzgc1zzqkCyWgyCvW1Y/K4veQclzaKzEOB30CgYEA3N+c
BPSux/Et0cxKJ3CZtqw7o8scJYwejPVAVrlrrt7DMsTcuDMSze5gADCuaOhyVw4t
NiQcLnmUdodOkYfJDkZDBFvkD4Zvz3BXcsPVpe1cfMnJ4nDDY0UhiZmPrV8ofSWX
mKQpgxhYzv1oWJKBLCyQzcKG/KGH9ASM4WS8SasCgYAlMzvzkczvJ9KyJOKqeRU5
NWYh+uVacIyxtGVI6SFZGdZ21p5pZYXCDPEHrI7eucjEj3UHLjBxOPzaCIyr4kBd
KrNx8MvYLOZ2XfYBwFags74t3CCEGj09wQIjvpGO82BIGzfJz8CHPrFHI1VNAAU5
CJ/zcAN4dyywdd0QO3Hi0QKBgBAW4eCiilDaSsIrpYM1+pyJ81Y9J3G8wUT3YJZw
r11vsLx0BrgMUGRb5vZclXfi5uFckQKOotbn2F7CAIEtaQH3ME6S+wv+eQqdXmFn
zpplrgURFfm+yRzkHktNul+gvOxQ3rgpzTRVg7KgVweMtIgpPuseLoMcqTCnXDPX
CLg9AoGAagVgB6q9YelidLr1yvGOTOqA9XiCTglyc5Ldj4dwfU8naVEQeu6xeg2I
Q4S7DZUrnk3SNJImLMOL7lzR52Bl3brlZcwFIHWqXExe84p0Ezr/rgczQ+gAFIYT
MXco4RROA3D1L0LKe4n90RAVVxRWNgfJMi0P2Ea4syrquukziuE=
-----END RSA PRIVATE KEY-----`,
  public: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2WO91KQy2kb4Ix9dpXgD
3oPLQi0iLq+Mzo/Z2YlKbe0L1kLDRe2LaeB7VYWAfj2H5S7zA7bBsKIUZWg406H/
Lg7BJpXMCP4fGCOyLHjK3n7m9prE0voLw5GRXkhzZlyXZNHo5yVXFFnFRhWDLehI
cU6tm3drYrdcC5m1bJw3nZNy5nJoK25XeJb063qhSmLOpt6mGmJDsd3jw/In67vI
omSeaqSHiJRiFWvTlRbKAZIPtyfjpQZOow8ewcAJ2WbTzCChjMchhJ0ELnqeUvbx
rgKXOizyPZLhwhCMlsMhOdJpE/k34sOXa6lz1rTKDDKcta/LQtV04ZIAfn3uGE2l
fwIDAQAB
-----END PUBLIC KEY-----`,
};

/**
 * Default test claims
 */
export interface FakeJWTOptions {
  agentId?: string;
  tenant?: string;
  project?: string;
  scopes?: string[];
  expiresIn?: string | number;
  algorithm?: 'HS256' | 'RS256';
  issuer?: string;
  audience?: string | string[];
}

/**
 * Create a fake JWT for testing
 */
export function createFakeJWT(options: FakeJWTOptions = {}): string {
  const claims: A2AJWTClaims = {
    sub: options.agentId || 'test-agent-001',
    tenant: options.tenant || 'test-tenant',
    project: options.project || 'test-project',
    scopes: options.scopes || ['*'],
  };

  const algorithm = options.algorithm || 'HS256';
  const secretOrKey = algorithm === 'RS256' ? TEST_RSA_KEYS.private : TEST_SECRET;

  return jwt.sign(claims, secretOrKey, {
    algorithm,
    expiresIn: options.expiresIn || '1h',
    issuer: options.issuer || 'qa-intel-test',
    audience: options.audience || 'a2a',
  });
}

/**
 * Create an expired JWT for testing
 */
export function createExpiredJWT(options: FakeJWTOptions = {}): string {
  return createFakeJWT({
    ...options,
    expiresIn: -1, // Expired 1 second ago
  });
}

/**
 * Create a malformed JWT (invalid signature)
 */
export function createMalformedJWT(options: FakeJWTOptions = {}): string {
  const token = createFakeJWT(options);
  const parts = token.split('.');
  // Corrupt the signature
  const corruptedSig = parts[2].split('').reverse().join('');
  return `${parts[0]}.${parts[1]}.${corruptedSig}`;
}

/**
 * Create test verification config
 */
export function createTestVerificationConfig(
  algorithm: 'HS256' | 'RS256' = 'HS256'
): JWTVerificationConfig {
  return {
    key: algorithm === 'RS256' ? TEST_RSA_KEYS.public : TEST_SECRET,
    algorithm,
    issuer: 'qa-intel-test',
    audience: 'a2a',
    clockTolerance: 0,
  };
}

/**
 * Create JWT with missing required claims
 */
export function createJWTMissingClaims(missingClaim: 'sub' | 'tenant' | 'project' | 'scopes'): string {
  const claims: any = {
    sub: 'test-agent-001',
    tenant: 'test-tenant',
    project: 'test-project',
    scopes: ['*'],
  };

  delete claims[missingClaim];

  return jwt.sign(claims, TEST_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
    issuer: 'qa-intel-test',
    audience: 'a2a',
  });
}

/**
 * Decode a JWT without verification (for test assertions)
 */
export function decodeJWT(token: string): A2AJWTClaims {
  return jwt.decode(token) as A2AJWTClaims;
}

/**
 * Create JWT with custom scopes
 */
export function createJWTWithScopes(scopes: string[], options: FakeJWTOptions = {}): string {
  return createFakeJWT({ ...options, scopes });
}

/**
 * Create JWT for a specific tenant/project
 */
export function createJWTForTenantProject(
  tenant: string,
  project: string,
  options: FakeJWTOptions = {}
): string {
  return createFakeJWT({ ...options, tenant, project });
}
