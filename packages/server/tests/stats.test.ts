import request from 'supertest';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Stats API', () => {
  let token: string;
  let courseId: string;
  let archivedCourseId: string;

  beforeAll(async () => {
    // Register test user
    const authRes = await request(API_URL)
      .post('/api/auth/register')
      .send({
        email: `stats-test-${Date.now()}@example.com`,
        password: 'password123',
        nickname: 'StatsTester',
      });
    token = authRes.body.data.token;

    // Create an active course with a plan and check-in
    const courseRes = await request(API_URL)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '统计测试课程', category: '数学' });
    courseId = courseRes.body.data.id;

    const today = new Date().toISOString().slice(0, 10);
    const planRes = await request(API_URL)
      .post('/api/plans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseId,
        title: '统计测试计划',
        startDate: today,
        endDate: today,
        items: [{ title: '统计学习项', scheduledDate: today }],
      });

    const planItemId = planRes.body.data.items[0].id;
    await request(API_URL)
      .post('/api/checkins')
      .set('Authorization', `Bearer ${token}`)
      .send({ planItemId });

    // Create an archived course
    const archiveRes = await request(API_URL)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '已归档课程', category: '历史' });
    archivedCourseId = archiveRes.body.data.id;

    await request(API_URL)
      .put(`/api/courses/${archivedCourseId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'archived' });
  });

  describe('GET /api/stats/overview', () => {
    it('should get overview stats with all fields present', async () => {
      const res = await request(API_URL)
        .get('/api/stats/overview')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalCourses');
      expect(res.body.data).toHaveProperty('activePlans');
      expect(res.body.data).toHaveProperty('totalCheckIns');
      expect(res.body.data).toHaveProperty('currentStreak');
      expect(res.body.data).toHaveProperty('completionRate');
      expect(typeof res.body.data.totalCourses).toBe('number');
      expect(typeof res.body.data.totalCheckIns).toBe('number');
    });
  });

  describe('GET /api/stats/daily', () => {
    it('should get daily stats with date range', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

      const res = await request(API_URL)
        .get(`/api/stats/daily?startDate=${weekAgo}&endDate=${today}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      // Each entry should have date and count
      if (res.body.data.length > 0) {
        expect(res.body.data[0]).toHaveProperty('date');
        expect(res.body.data[0]).toHaveProperty('count');
      }
    });
  });

  describe('GET /api/stats/courses', () => {
    it('should get course stats with completion rate calculation', async () => {
      const res = await request(API_URL)
        .get('/api/stats/courses')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const courseStat = res.body.data.find((c: any) => c.courseId === courseId);
      expect(courseStat).toBeDefined();
      expect(courseStat).toHaveProperty('completionRate');
      expect(typeof courseStat.completionRate).toBe('number');
      expect(courseStat.completionRate).toBeGreaterThanOrEqual(0);
      expect(courseStat.completionRate).toBeLessThanOrEqual(100);
    });

    it('should include archived courses with includeArchived=true', async () => {
      const res = await request(API_URL)
        .get('/api/stats/courses?includeArchived=true')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const courseIds = res.body.data.map((c: any) => c.courseId);
      expect(courseIds).toContain(archivedCourseId);
    });
  });

  describe('GET /api/stats/weekly', () => {
    it('should get weekly report', async () => {
      const res = await request(API_URL)
        .get('/api/stats/weekly')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('weekStart');
      expect(res.body.data).toHaveProperty('weekEnd');
      expect(res.body.data).toHaveProperty('totalCheckIns');
      expect(res.body.data).toHaveProperty('completedItems');
    });
  });
});
