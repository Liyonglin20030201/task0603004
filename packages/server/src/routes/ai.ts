import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import Anthropic from '@anthropic-ai/sdk';

export const aiRouter = Router();
aiRouter.use(authenticate);

const generateSchema = z.object({
  courseId: z.string().uuid().optional(),
});

aiRouter.post('/generate-review', validate(generateSchema), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { courseId } = req.body;

    const wrongAnswerWhere: any = { userId };
    if (courseId) wrongAnswerWhere.courseId = courseId;

    const [wrongAnswers, checkIns, plans] = await Promise.all([
      prisma.wrongAnswer.findMany({
        where: wrongAnswerWhere,
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { course: { select: { title: true } } },
      }),
      prisma.checkIn.findMany({
        where: { userId },
        orderBy: { checkInDate: 'desc' },
        take: 30,
        include: { planItem: { select: { title: true } } },
      }),
      prisma.learningPlan.findMany({
        where: { userId, status: { in: ['active', 'delayed'] } },
        include: { items: true, course: { select: { title: true } } },
      }),
    ]);

    const completedItems = plans.reduce(
      (sum, p) => sum + p.items.filter(i => i.status === 'completed').length, 0
    );
    const totalItems = plans.reduce((sum, p) => sum + p.items.length, 0);
    const completionRate = totalItems > 0 ? (completedItems / totalItems * 100).toFixed(1) : '0';

    const avgDuration = checkIns.length > 0
      ? Math.round(checkIns.reduce((sum, c) => sum + (c.durationMinutes || 30), 0) / checkIns.length)
      : 30;

    const wrongAnswerSummary = wrongAnswers.map(wa => ({
      course: wa.course.title,
      question: wa.question.slice(0, 100),
      tags: wa.tags,
      reviewCount: wa.reviewCount,
    }));

    const prompt = `你是一位学习规划专家。根据以下学生学习数据，生成一个7天的复习计划。

## 学生数据

### 错题记录 (最近30条)
${JSON.stringify(wrongAnswerSummary, null, 2)}

### 学习进度
- 总完成率: ${completionRate}%
- 活跃计划数: ${plans.length}
- 平均每日学习时长: ${avgDuration}分钟

### 薄弱环节
${wrongAnswers.length > 0 ? [...new Set(wrongAnswers.flatMap(wa => wa.tags))].join(', ') : '暂无数据'}

## 要求
1. 基于艾宾浩斯遗忘曲线安排复习间隔
2. 优先复习错误率高的知识点
3. 每天学习时长不超过${avgDuration + 15}分钟
4. 返回严格的JSON格式

请返回以下JSON格式（不要包含其他文字）：
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "topics": ["要复习的主题1", "主题2"],
      "durationMinutes": 30,
      "priority": "high|medium|low"
    }
  ],
  "summary": "总结建议"
}`;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new AppError('AI service not configured', 503);
    }

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new AppError('AI response invalid', 500);
    }

    let suggestionContent: any;
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      suggestionContent = JSON.parse(jsonMatch[0]);
    } catch {
      throw new AppError('Failed to parse AI response', 500);
    }

    const today = new Date();
    suggestionContent.days = suggestionContent.days.map((day: any, index: number) => {
      const date = new Date(today);
      date.setDate(date.getDate() + index + 1);
      return { ...day, date: date.toISOString().slice(0, 10) };
    });

    const suggestion = await prisma.aIReviewSuggestion.create({
      data: {
        userId,
        courseId: courseId || null,
        suggestionContent,
      },
    });

    res.status(201).json({ success: true, data: suggestion });
  } catch (err) { next(err); }
});

aiRouter.get('/suggestions', async (req, res, next) => {
  try {
    const suggestions = await prisma.aIReviewSuggestion.findMany({
      where: { userId: req.user!.userId },
      orderBy: { generatedAt: 'desc' },
      take: 10,
      include: { course: { select: { id: true, title: true } } },
    });
    res.json({ success: true, data: suggestions });
  } catch (err) { next(err); }
});

aiRouter.put('/suggestions/:id/accept', async (req, res, next) => {
  try {
    const suggestion = await prisma.aIReviewSuggestion.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!suggestion) throw new AppError('Suggestion not found', 404);

    const content = suggestion.suggestionContent as any;
    if (!content.days || content.days.length === 0) {
      throw new AppError('Suggestion has no review items', 400);
    }

    const courseId = suggestion.courseId;
    if (!courseId) {
      throw new AppError('Cannot create plan without course association', 400);
    }

    const startDate = new Date(content.days[0].date);
    const endDate = new Date(content.days[content.days.length - 1].date);

    await prisma.$transaction(async (tx) => {
      await tx.learningPlan.create({
        data: {
          userId: req.user!.userId,
          courseId,
          title: `AI复习计划 - ${startDate.toISOString().slice(0, 10)}`,
          startDate,
          endDate,
          originalEndDate: endDate,
          items: {
            create: content.days.flatMap((day: any, dayIdx: number) =>
              day.topics.map((topic: string, topicIdx: number) => ({
                title: `[复习] ${topic}`,
                scheduledDate: new Date(day.date),
                originalDate: new Date(day.date),
                sortOrder: dayIdx * 10 + topicIdx,
              }))
            ),
          },
        },
      });

      await tx.aIReviewSuggestion.update({
        where: { id: suggestion.id },
        data: { accepted: true },
      });
    });

    res.json({ success: true, message: '已采纳建议并创建复习计划' });
  } catch (err) { next(err); }
});
