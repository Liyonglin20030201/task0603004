import request from 'supertest';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Notes API', () => {
  let token: string;
  let otherToken: string;
  let courseId: string;
  let noteId: string;
  let noteWithoutCourseId: string;

  beforeAll(async () => {
    // Register main test user
    const authRes = await request(API_URL)
      .post('/api/auth/register')
      .send({
        email: `notes-test-${Date.now()}@example.com`,
        password: 'password123',
        nickname: 'NotesTester',
      });
    token = authRes.body.data.token;

    // Register another user for isolation tests
    const otherRes = await request(API_URL)
      .post('/api/auth/register')
      .send({
        email: `notes-other-${Date.now()}@example.com`,
        password: 'password123',
        nickname: 'OtherNoteUser',
      });
    otherToken = otherRes.body.data.token;

    // Create a course
    const courseRes = await request(API_URL)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '笔记测试课程', category: '语文' });
    courseId = courseRes.body.data.id;
  });

  describe('POST /api/notes', () => {
    it('should create a note with courseId', async () => {
      const res = await request(API_URL)
        .post('/api/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '第一章笔记',
          content: '# 重点内容\n\n这是第一章的学习笔记，包含了核心知识点。',
          courseId,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('第一章笔记');
      expect(res.body.data.courseId).toBe(courseId);
      expect(res.body.data.content).toContain('重点内容');
      noteId = res.body.data.id;
    });

    it('should create a note without courseId', async () => {
      const res = await request(API_URL)
        .post('/api/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '独立笔记',
          content: '这是一个不属于任何课程的独立笔记。',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('独立笔记');
      expect(res.body.data.courseId).toBeNull();
      noteWithoutCourseId = res.body.data.id;
    });
  });

  describe('GET /api/notes', () => {
    beforeAll(async () => {
      // Create more notes for listing
      await request(API_URL)
        .post('/api/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '搜索测试笔记', content: '用于测试搜索功能的笔记内容' });

      await request(API_URL)
        .post('/api/notes')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '数据结构笔记', content: '链表、树、图等数据结构' });
    });

    it('should list notes', async () => {
      const res = await request(API_URL)
        .get('/api/notes')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    });

    it('should search notes by title', async () => {
      const res = await request(API_URL)
        .get('/api/notes?search=搜索测试')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].title).toContain('搜索测试');
    });
  });

  describe('PUT /api/notes/:id', () => {
    it('should update note content', async () => {
      const res = await request(API_URL)
        .put(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '更新后的笔记标题',
          content: '# 更新内容\n\n笔记内容已经更新。',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('更新后的笔记标题');
      expect(res.body.data.content).toContain('更新内容');
    });
  });

  describe('Access control', () => {
    it('should return 404 when accessing other user\'s note', async () => {
      await request(API_URL)
        .get(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('should delete a note', async () => {
      const res = await request(API_URL)
        .delete(`/api/notes/${noteWithoutCourseId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify it's gone
      await request(API_URL)
        .get(`/api/notes/${noteWithoutCourseId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
