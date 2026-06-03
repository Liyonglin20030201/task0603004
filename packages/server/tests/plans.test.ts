import request from 'supertest';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Plans API', () => {
  let token: string;
  let courseId: string;
  let secondCourseId: string;
  let planId: string;

  beforeAll(async () => {
    // Register test user
    const authRes = await request(API_URL)
      .post('/api/auth/register')
      .send({
        email: `plans-test-${Date.now()}@example.com`,
        password: 'password123',
        nickname: 'PlansTester',
      });
    token = authRes.body.data.token;

    // Create courses for plan tests
    const courseRes = await request(API_URL)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '计划测试课程A', category: '数学' });
    courseId = courseRes.body.data.id;

    const courseRes2 = await request(API_URL)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '计划测试课程B', category: '英语' });
    secondCourseId = courseRes2.body.data.id;
  });

  describe('POST /api/plans', () => {
    it('should create a plan with multiple items', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

      const res = await request(API_URL)
        .post('/api/plans')
        .set('Authorization', `Bearer ${token}`)
        .send({
          courseId,
          title: '第一周学习计划',
          startDate: today,
          endDate: dayAfter,
          items: [
            { title: '学习第一章', scheduledDate: today },
            { title: '学习第二章', scheduledDate: tomorrow },
            { title: '复习总结', scheduledDate: dayAfter },
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('第一周学习计划');
      expect(res.body.data.courseId).toBe(courseId);
      expect(res.body.data.items).toHaveLength(3);
      planId = res.body.data.id;
    });

    it('should return 404 for non-existent course', async () => {
      const today = new Date().toISOString().slice(0, 10);

      await request(API_URL)
        .post('/api/plans')
        .set('Authorization', `Bearer ${token}`)
        .send({
          courseId: '00000000-0000-0000-0000-000000000000',
          title: '无效计划',
          startDate: today,
          endDate: today,
          items: [{ title: 'Item', scheduledDate: today }],
        })
        .expect(404);
    });
  });

  describe('GET /api/plans', () => {
    beforeAll(async () => {
      // Create a plan for the second course
      const today = new Date().toISOString().slice(0, 10);
      await request(API_URL)
        .post('/api/plans')
        .set('Authorization', `Bearer ${token}`)
        .send({
          courseId: secondCourseId,
          title: '英语计划',
          startDate: today,
          endDate: today,
          items: [{ title: '背单词', scheduledDate: today }],
        });
    });

    it('should list plans filtered by courseId', async () => {
      const res = await request(API_URL)
        .get(`/api/plans?courseId=${courseId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      res.body.data.forEach((plan: any) => {
        expect(plan.courseId).toBe(courseId);
      });
    });

    it('should list plans filtered by status', async () => {
      const res = await request(API_URL)
        .get('/api/plans?status=active')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      res.body.data.forEach((plan: any) => {
        expect(plan.status).toBe('active');
      });
    });
  });

  describe('GET /api/plans/:id', () => {
    it('should get plan detail with items', async () => {
      const res = await request(API_URL)
        .get(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(planId);
      expect(res.body.data.title).toBe('第一周学习计划');
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBe(3);
    });

    it('should verify items have correct scheduled dates', async () => {
      const res = await request(API_URL)
        .get(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const items = res.body.data.items;
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

      expect(items[0].scheduledDate).toContain(today);
      expect(items[1].scheduledDate).toContain(tomorrow);
      expect(items[2].scheduledDate).toContain(dayAfter);
    });
  });

  describe('PUT /api/plans/:id', () => {
    it('should update plan title', async () => {
      const res = await request(API_URL)
        .put(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '更新后的学习计划' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('更新后的学习计划');
    });

    it('should update plan status to completed', async () => {
      const res = await request(API_URL)
        .put(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'completed' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
    });
  });
});
