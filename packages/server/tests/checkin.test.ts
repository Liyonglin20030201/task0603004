import request from 'supertest';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Check-in API - Duplicate Prevention', () => {
  let token: string;
  let courseId: string;
  let planId: string;
  let planItemId: string;

  beforeAll(async () => {
    // Register and get token
    const authRes = await request(API_URL)
      .post('/api/auth/register')
      .send({
        email: `checkin-test-${Date.now()}@example.com`,
        password: 'password123',
        nickname: 'CheckInTester',
      });
    token = authRes.body.data.token;

    // Create course
    const courseRes = await request(API_URL)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test Course', category: '数学' });
    courseId = courseRes.body.data.id;

    // Create plan with item for today
    const today = new Date().toISOString().slice(0, 10);
    const planRes = await request(API_URL)
      .post('/api/plans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseId,
        title: 'Test Plan',
        startDate: today,
        endDate: today,
        items: [{ title: 'Test Item', scheduledDate: today }],
      });
    planId = planRes.body.data.id;
    planItemId = planRes.body.data.items[0].id;
  });

  it('should create a check-in successfully', async () => {
    const res = await request(API_URL)
      .post('/api/checkins')
      .set('Authorization', `Bearer ${token}`)
      .send({ planItemId })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.planItemId).toBe(planItemId);
  });

  it('should return 409 for duplicate check-in', async () => {
    const res = await request(API_URL)
      .post('/api/checkins')
      .set('Authorization', `Bearer ${token}`)
      .send({ planItemId })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('重复打卡');
  });

  it('should allow undo of today check-in', async () => {
    // Get today's check-ins
    const today = new Date().toISOString().slice(0, 10);
    const listRes = await request(API_URL)
      .get(`/api/checkins?date=${today}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const checkInId = listRes.body.data[0]?.id;
    if (checkInId) {
      await request(API_URL)
        .delete(`/api/checkins/${checkInId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    }
  });

  it('should get streak info', async () => {
    const res = await request(API_URL)
      .get('/api/checkins/streak')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('currentStreak');
    expect(res.body.data).toHaveProperty('longestStreak');
  });
});
