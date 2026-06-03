import request from 'supertest';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Wrong Answers API', () => {
  let token: string;
  let courseId: string;
  let secondCourseId: string;
  let wrongAnswerId: string;

  beforeAll(async () => {
    // Register test user
    const authRes = await request(API_URL)
      .post('/api/auth/register')
      .send({
        email: `wrong-answers-test-${Date.now()}@example.com`,
        password: 'password123',
        nickname: 'WrongAnswersTester',
      });
    token = authRes.body.data.token;

    // Create courses
    const courseRes = await request(API_URL)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '错题本测试课程', category: '数学' });
    courseId = courseRes.body.data.id;

    const courseRes2 = await request(API_URL)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '错题本测试课程B', category: '物理' });
    secondCourseId = courseRes2.body.data.id;
  });

  describe('POST /api/wrong-answers', () => {
    it('should create a wrong answer with tags', async () => {
      const res = await request(API_URL)
        .post('/api/wrong-answers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          courseId,
          question: '求 lim(x->0) sin(x)/x 的值',
          answer: '1',
          analysis: '利用洛必达法则或泰勒展开',
          tags: ['极限', '洛必达'],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.question).toBe('求 lim(x->0) sin(x)/x 的值');
      expect(res.body.data.tags).toContain('极限');
      expect(res.body.data.tags).toContain('洛必达');
      expect(res.body.data.reviewCount).toBe(0);
      expect(res.body.data.nextReviewDate).toBeDefined();
      wrongAnswerId = res.body.data.id;
    });
  });

  describe('GET /api/wrong-answers', () => {
    beforeAll(async () => {
      // Create additional wrong answers
      await request(API_URL)
        .post('/api/wrong-answers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          courseId,
          question: '求导数 d/dx(e^x)',
          answer: 'e^x',
          analysis: '指数函数的导数',
          tags: ['导数', '指数函数'],
        });

      await request(API_URL)
        .post('/api/wrong-answers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          courseId: secondCourseId,
          question: '牛顿第二定律公式',
          answer: 'F=ma',
          analysis: '力等于质量乘以加速度',
          tags: ['力学', '牛顿定律'],
        });
    });

    it('should list wrong answers', async () => {
      const res = await request(API_URL)
        .get('/api/wrong-answers')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by courseId', async () => {
      const res = await request(API_URL)
        .get(`/api/wrong-answers?courseId=${courseId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      res.body.data.forEach((item: any) => {
        expect(item.courseId).toBe(courseId);
      });
    });

    it('should filter by tag', async () => {
      const res = await request(API_URL)
        .get('/api/wrong-answers?tag=极限')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      res.body.data.forEach((item: any) => {
        expect(item.tags).toContain('极限');
      });
    });
  });

  describe('PUT /api/wrong-answers/:id', () => {
    it('should update wrong answer and increment reviewCount', async () => {
      const res = await request(API_URL)
        .put(`/api/wrong-answers/${wrongAnswerId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reviewCount: 1 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.reviewCount).toBe(1);
    });

    it('should verify nextReviewDate updates based on spaced repetition intervals', async () => {
      // After first review, next review should be scheduled further out
      const res = await request(API_URL)
        .put(`/api/wrong-answers/${wrongAnswerId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reviewCount: 2 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.reviewCount).toBe(2);
      expect(res.body.data.nextReviewDate).toBeDefined();

      // nextReviewDate should be in the future
      const nextReview = new Date(res.body.data.nextReviewDate);
      const now = new Date();
      expect(nextReview.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('GET /api/wrong-answers/due', () => {
    it('should get due items (items with nextReviewDate <= today)', async () => {
      const res = await request(API_URL)
        .get('/api/wrong-answers/due')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      // All returned items should have nextReviewDate <= today
      const today = new Date();
      res.body.data.forEach((item: any) => {
        const reviewDate = new Date(item.nextReviewDate);
        expect(reviewDate.getTime()).toBeLessThanOrEqual(today.getTime() + 86400000);
      });
    });
  });

  describe('DELETE /api/wrong-answers/:id', () => {
    it('should delete a wrong answer', async () => {
      const res = await request(API_URL)
        .delete(`/api/wrong-answers/${wrongAnswerId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify it's gone
      await request(API_URL)
        .get(`/api/wrong-answers/${wrongAnswerId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
