import request from 'supertest';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Auth API', () => {
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'password123',
    nickname: 'TestUser',
  };
  let token: string;
  let refreshToken: string;

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(API_URL)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.user.nickname).toBe(testUser.nickname);

      token = res.body.data.token;
      refreshToken = res.body.data.refreshToken;
    });

    it('should reject duplicate email', async () => {
      const res = await request(API_URL)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already registered');
    });

    it('should reject invalid email', async () => {
      const res = await request(API_URL)
        .post('/api/auth/register')
        .send({ email: 'invalid', password: 'password123', nickname: 'Test' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject short password', async () => {
      const res = await request(API_URL)
        .post('/api/auth/register')
        .send({ email: 'new@example.com', password: '123', nickname: 'Test' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(API_URL)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      token = res.body.data.token;
    });

    it('should reject invalid password', async () => {
      await request(API_URL)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .expect(401);
    });

    it('should reject non-existent email', async () => {
      await request(API_URL)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user', async () => {
      const res = await request(API_URL)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testUser.email);
    });

    it('should reject without token', async () => {
      await request(API_URL)
        .get('/api/auth/me')
        .expect(401);
    });

    it('should reject invalid token', async () => {
      await request(API_URL)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token', async () => {
      const res = await request(API_URL)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });
  });
});
