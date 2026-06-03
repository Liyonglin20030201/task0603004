import request from 'supertest';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Plan Delay Logic', () => {
  let token: string;
  let courseId: string;
  let planId: string;

  beforeAll(async () => {
    const authRes = await request(API_URL)
      .post('/api/auth/register')
      .send({
        email: `delay-test-${Date.now()}@example.com`,
        password: 'password123',
        nickname: 'DelayTester',
      });
    token = authRes.body.data.token;

    const courseRes = await request(API_URL)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Delay Test Course', category: '编程' });
    courseId = courseRes.body.data.id;
  });

  it('should handle delay correctly', async () => {
    // Create plan with past dates (to simulate overdue items)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

    const planRes = await request(API_URL)
      .post('/api/plans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseId,
        title: 'Delay Test Plan',
        startDate: twoDaysAgo,
        endDate: dayAfter,
        items: [
          { title: 'Item 1 (overdue)', scheduledDate: twoDaysAgo },
          { title: 'Item 2 (overdue)', scheduledDate: yesterday },
          { title: 'Item 3 (future)', scheduledDate: tomorrow },
          { title: 'Item 4 (future)', scheduledDate: dayAfter },
        ],
      })
      .expect(201);

    planId = planRes.body.data.id;

    // Trigger delay
    const delayRes = await request(API_URL)
      .post(`/api/plans/${planId}/delay`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(delayRes.body.success).toBe(true);

    // Verify: overdue items should be marked as skipped
    const planDetail = await request(API_URL)
      .get(`/api/plans/${planId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const items = planDetail.body.data.items;
    const skippedItems = items.filter((i: any) => i.status === 'skipped');
    const pendingItems = items.filter((i: any) => i.status === 'pending');

    expect(skippedItems.length).toBe(2);
    expect(pendingItems.length).toBe(2);

    // Future items should have been shifted by 2 days
    expect(planDetail.body.data.status).toBe('delayed');
  });

  it('should return 400 when no overdue items', async () => {
    // Create a plan with only future items
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const planRes = await request(API_URL)
      .post('/api/plans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseId,
        title: 'No Delay Plan',
        startDate: tomorrow,
        endDate: tomorrow,
        items: [{ title: 'Future Item', scheduledDate: tomorrow }],
      })
      .expect(201);

    await request(API_URL)
      .post(`/api/plans/${planRes.body.data.id}/delay`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});
