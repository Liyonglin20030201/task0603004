import request from 'supertest';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Courses API', () => {
  let token: string;
  let userId: string;
  let courseId: string;
  let otherToken: string;

  beforeAll(async () => {
    // Register main test user
    const authRes = await request(API_URL)
      .post('/api/auth/register')
      .send({
        email: `courses-test-${Date.now()}@example.com`,
        password: 'password123',
        nickname: 'CoursesTester',
      });
    token = authRes.body.data.token;
    userId = authRes.body.data.user.id;

    // Register another user for isolation tests
    const otherRes = await request(API_URL)
      .post('/api/auth/register')
      .send({
        email: `courses-other-${Date.now()}@example.com`,
        password: 'password123',
        nickname: 'OtherUser',
      });
    otherToken = otherRes.body.data.token;
  });

  describe('POST /api/courses', () => {
    it('should create a course', async () => {
      const res = await request(API_URL)
        .post('/api/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '高等数学', category: '数学' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('高等数学');
      expect(res.body.data.category).toBe('数学');
      expect(res.body.data.status).toBe('active');
      courseId = res.body.data.id;
    });

    it('should reject course without title (400)', async () => {
      const res = await request(API_URL)
        .post('/api/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: '数学' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/courses', () => {
    beforeAll(async () => {
      // Create additional courses for pagination testing
      for (let i = 1; i <= 5; i++) {
        await request(API_URL)
          .post('/api/courses')
          .set('Authorization', `Bearer ${token}`)
          .send({ title: `测试课程 ${i}`, category: '编程' });
      }
    });

    it('should list courses with pagination', async () => {
      const res = await request(API_URL)
        .get('/api/courses?page=1&limit=3')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeLessThanOrEqual(3);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(6);
    });
  });

  describe('GET /api/courses/:id', () => {
    it('should get course detail with progress', async () => {
      const res = await request(API_URL)
        .get(`/api/courses/${courseId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(courseId);
      expect(res.body.data.title).toBe('高等数学');
      expect(res.body.data).toHaveProperty('progress');
    });

    it('should return 404 for other user\'s course', async () => {
      await request(API_URL)
        .get(`/api/courses/${courseId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/courses/:id', () => {
    it('should update course title and category', async () => {
      const res = await request(API_URL)
        .put(`/api/courses/${courseId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '线性代数', category: '数学基础' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('线性代数');
      expect(res.body.data.category).toBe('数学基础');
    });
  });

  describe('Archive course', () => {
    let archiveCourseId: string;

    beforeAll(async () => {
      const res = await request(API_URL)
        .post('/api/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '待归档课程', category: '历史' });
      archiveCourseId = res.body.data.id;
    });

    it('should archive a course', async () => {
      const res = await request(API_URL)
        .put(`/api/courses/${archiveCourseId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'archived' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('archived');
    });

    it('should appear when filtered with status=archived', async () => {
      const res = await request(API_URL)
        .get('/api/courses?status=archived')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const archivedIds = res.body.data.map((c: any) => c.id);
      expect(archivedIds).toContain(archiveCourseId);
    });
  });
});
