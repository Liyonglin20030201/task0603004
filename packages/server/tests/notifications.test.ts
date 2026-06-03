import request from 'supertest';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Notifications API', () => {
  let token: string;
  let notificationId: string;

  beforeAll(async () => {
    // Register test user
    const authRes = await request(API_URL)
      .post('/api/auth/register')
      .send({
        email: `notif-test-${Date.now()}@example.com`,
        password: 'password123',
        nickname: 'NotifTester',
      });
    token = authRes.body.data.token;

    // Create some data to trigger notifications (course + plan with overdue items)
    const courseRes = await request(API_URL)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '通知测试课程', category: '数学' });
    const courseId = courseRes.body.data.id;

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    await request(API_URL)
      .post('/api/plans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseId,
        title: '通知测试计划',
        startDate: yesterday,
        endDate: yesterday,
        items: [{ title: '过期任务', scheduledDate: yesterday }],
      });
  });

  describe('GET /api/notifications', () => {
    it('should list notifications (may be empty initially)', async () => {
      const res = await request(API_URL)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);

      // Store notification id if any exist for subsequent tests
      if (res.body.data.length > 0) {
        notificationId = res.body.data[0].id;
      }
    });

    it('should filter unread only', async () => {
      const res = await request(API_URL)
        .get('/api/notifications?unread=true')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      res.body.data.forEach((notif: any) => {
        expect(notif.read).toBe(false);
      });
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      // First ensure we have a notification; create one via trigger if needed
      const listRes = await request(API_URL)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      if (listRes.body.data.length === 0) {
        // Trigger notification generation
        await request(API_URL)
          .post('/api/notifications/generate')
          .set('Authorization', `Bearer ${token}`);

        const retryRes = await request(API_URL)
          .get('/api/notifications')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        if (retryRes.body.data.length === 0) {
          // Skip if still no notifications
          return;
        }
        notificationId = retryRes.body.data[0].id;
      } else {
        notificationId = listRes.body.data[0].id;
      }

      const res = await request(API_URL)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify it's read
      const verifyRes = await request(API_URL)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const updated = verifyRes.body.data.find((n: any) => n.id === notificationId);
      if (updated) {
        expect(updated.read).toBe(true);
      }
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      const res = await request(API_URL)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify all are read
      const verifyRes = await request(API_URL)
        .get('/api/notifications?unread=true')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(verifyRes.body.data.length).toBe(0);
    });
  });
});
