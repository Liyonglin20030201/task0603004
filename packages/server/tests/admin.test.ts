import request from 'supertest';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Admin API', () => {
  let adminToken: string;
  let adminUserId: string;
  let regularToken: string;
  let regularUserId: string;

  beforeAll(async () => {
    // Register regular user
    const regularRes = await request(API_URL)
      .post('/api/auth/register')
      .send({
        email: `admin-regular-${Date.now()}@example.com`,
        password: 'password123',
        nickname: 'RegularUser',
      });
    regularToken = regularRes.body.data.token;
    regularUserId = regularRes.body.data.user.id;

    // Register admin user (using the admin registration endpoint or seed)
    const adminRes = await request(API_URL)
      .post('/api/auth/register')
      .send({
        email: `admin-${Date.now()}@example.com`,
        password: 'password123',
        nickname: 'AdminUser',
      });
    adminToken = adminRes.body.data.token;
    adminUserId = adminRes.body.data.user.id;

    // Promote to admin (via direct API or database seed endpoint)
    // Try the admin promotion endpoint; if this test environment has a bootstrap mechanism
    await request(API_URL)
      .post('/api/admin/bootstrap')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ secret: process.env.ADMIN_SECRET || 'admin-bootstrap-secret' });

    // If bootstrap doesn't exist, try self-promotion via test endpoint
    const promoteRes = await request(API_URL)
      .put(`/api/admin/users/${adminUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });

    // Re-login to get updated token with admin role if needed
    if (promoteRes.status === 403) {
      // Alternative: use environment-seeded admin credentials
      const loginRes = await request(API_URL)
        .post('/api/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL || 'admin@example.com',
          password: process.env.ADMIN_PASSWORD || 'admin123',
        });
      if (loginRes.status === 200) {
        adminToken = loginRes.body.data.token;
        adminUserId = loginRes.body.data.user?.id;
      }
    }
  });

  describe('Regular user access control', () => {
    it('should return 403 for regular user on admin endpoints', async () => {
      await request(API_URL)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });
  });

  describe('GET /api/admin/users', () => {
    it('should allow admin to list users', async () => {
      const res = await request(API_URL)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      // Each user should have id, email, nickname, role
      const user = res.body.data[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('nickname');
      expect(user).toHaveProperty('role');
    });
  });

  describe('PUT /api/admin/users/:id/role', () => {
    it('should allow admin to change user role', async () => {
      const res = await request(API_URL)
        .put(`/api/admin/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('moderator');
    });

    it('should return 400 when admin tries to change own role', async () => {
      await request(API_URL)
        .put(`/api/admin/users/${adminUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' })
        .expect(400);
    });
  });

  describe('Admin configs', () => {
    it('should allow admin to get configs', async () => {
      const res = await request(API_URL)
        .get('/api/admin/configs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should allow admin to set configs', async () => {
      const res = await request(API_URL)
        .put('/api/admin/configs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maxCoursesPerUser: 50,
          enableNotifications: true,
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify the config was saved
      const getRes = await request(API_URL)
        .get('/api/admin/configs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(getRes.body.data.maxCoursesPerUser).toBe(50);
      expect(getRes.body.data.enableNotifications).toBe(true);
    });
  });
});
