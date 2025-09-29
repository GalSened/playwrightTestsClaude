// Integration tests for authentication API
import request from 'supertest';
import { TestDatabase } from '../setup/test-database';
import { TestHelpers } from '../helpers/test-helpers';
import { app } from '../../server-enterprise';

describe('Authentication API', () => {
  let testDb: TestDatabase;
  let server: any;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.setup();
    TestHelpers.setDatabase(testDb);
    TestHelpers.setTestEnvironment();
    
    server = app.listen(0); // Use random port for testing
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    await testDb.teardown();
  });

  beforeEach(async () => {
    await TestHelpers.clearAllTables();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const registrationData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'securepassword123',
        company: 'Acme Corp',
        subdomain: 'acme-test',
        plan: 'professional'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tenant');
      
      expect(response.body.user.email).toBe(registrationData.email);
      expect(response.body.user.name).toBe(registrationData.name);
      expect(response.body.tenant.name).toBe(registrationData.company);
      expect(response.body.tenant.subdomain).toBe(registrationData.subdomain);
      
      TestHelpers.expectValidUser(response.body.user);
      TestHelpers.expectValidTenant(response.body.tenant);
    });

    it('should reject registration with invalid email', async () => {
      const registrationData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'securepassword123',
        company: 'Acme Corp',
        subdomain: 'acme-test',
        plan: 'professional'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('email');
    });

    it('should reject registration with weak password', async () => {
      const registrationData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: '123',
        company: 'Acme Corp',
        subdomain: 'acme-test',
        plan: 'professional'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('password');
    });

    it('should reject duplicate email registration', async () => {
      const { tenant } = await TestHelpers.seedMinimalData();
      
      const registrationData = {
        name: 'John Doe',
        email: 'admin@acme.com', // Already exists in fixtures
        password: 'securepassword123',
        company: 'Another Corp',
        subdomain: 'another-test',
        plan: 'professional'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });

    it('should reject duplicate subdomain registration', async () => {
      const { tenant } = await TestHelpers.seedMinimalData();
      
      const registrationData = {
        name: 'John Doe',
        email: 'john@different.com',
        password: 'securepassword123',
        company: 'Another Corp',
        subdomain: 'acme', // Already exists in fixtures
        plan: 'professional'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('subdomain');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await TestHelpers.seedMinimalData();
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'admin@acme.com',
        password: 'testpass123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tenant');
      
      expect(response.body.user.email).toBe(loginData.email);
      TestHelpers.expectValidUser(response.body.user);
      TestHelpers.expectValidTenant(response.body.tenant);
    });

    it('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'testpass123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: 'admin@acme.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject login for inactive user', async () => {
      // Create an inactive user
      await testDb.insertUser({
        email: 'inactive@test.com',
        password_hash: '$2a$12$rQvK7sL8YQHfDcVgmRfpQeLF7lJ5zN5GxP3fKsH6l.Lx8KZN6xGDG',
        name: 'Inactive User',
        tenant_id: '11111111-1111-1111-1111-111111111111',
        is_active: false,
        role: 'user'
      });

      const loginData = {
        email: 'inactive@test.com',
        password: 'testpass123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('account is inactive');
    });

    it('should update last_login timestamp on successful login', async () => {
      const loginData = {
        email: 'admin@acme.com',
        password: 'testpass123'
      };

      const beforeLogin = new Date();
      
      await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      // Check database for updated last_login
      const userResult = await testDb.query(
        'SELECT last_login FROM users WHERE email = $1',
        [loginData.email]
      );

      const lastLogin = new Date(userResult.rows[0].last_login);
      expect(lastLogin.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
    });
  });

  describe('POST /api/auth/refresh', () => {
    beforeEach(async () => {
      await TestHelpers.seedMinimalData();
    });

    it('should refresh token with valid refresh token', async () => {
      // First login to get tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@acme.com',
          password: 'testpass123'
        })
        .expect(200);

      const { refreshToken } = loginResponse.body;

      // Use refresh token to get new access token
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.token).not.toBe(loginResponse.body.token);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid refresh token');
    });

    it('should reject expired refresh token', async () => {
      // Create expired token
      const expiredToken = TestHelpers.generateJwtToken(
        { userId: '123', tenantId: '456' },
        '-1h' // Already expired
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: expiredToken })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('expired');
    });
  });

  describe('GET /api/auth/me', () => {
    let userWithToken: any;

    beforeEach(async () => {
      const seeded = await TestHelpers.seedMinimalData();
      userWithToken = seeded.adminUser;
    });

    it('should return user info with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userWithToken.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tenant');
      expect(response.body.user.email).toBe(userWithToken.email);
      
      // Should not return sensitive info
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('No token provided');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid token');
    });

    it('should reject request with expired token', async () => {
      const expiredToken = TestHelpers.generateJwtToken(
        { userId: userWithToken.id, tenantId: userWithToken.tenant_id },
        '-1h'
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('expired');
    });
  });

  describe('POST /api/auth/logout', () => {
    let userWithToken: any;

    beforeEach(async () => {
      const seeded = await TestHelpers.seedMinimalData();
      userWithToken = seeded.adminUser;
    });

    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userWithToken.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('logged out');
    });

    it('should handle logout without token gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit login attempts', async () => {
      const loginData = {
        email: 'admin@acme.com',
        password: 'wrongpassword'
      };

      // Make multiple failed login attempts
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);
      
      // Should get rate limited after several attempts
      const rateLimitedResponse = responses.find(r => r.status === 429);
      expect(rateLimitedResponse).toBeDefined();
    });
  });

  describe('Multi-tenant Isolation', () => {
    beforeEach(async () => {
      await TestHelpers.seedMinimalData();
    });

    it('should isolate users by tenant', async () => {
      // Create user in different tenant
      const secondTenantId = await testDb.insertTenant({
        name: 'Second Tenant',
        subdomain: 'second',
        plan: 'professional',
        status: 'active'
      });

      const secondTenantUserId = await testDb.insertUser({
        email: 'user@second.com',
        password_hash: '$2a$12$rQvK7sL8YQHfDcVgmRfpQeLF7lJ5zN5GxP3fKsH6l.Lx8KZN6xGDG',
        name: 'Second User',
        tenant_id: secondTenantId,
        role: 'admin'
      });

      // Login as second tenant user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@second.com',
          password: 'testpass123'
        })
        .expect(200);

      expect(loginResponse.body.tenant.id).toBe(secondTenantId);
      expect(loginResponse.body.tenant.subdomain).toBe('second');
    });
  });
});