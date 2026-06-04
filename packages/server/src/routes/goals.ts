import { Router } from 'express';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { sendNotification } from '../lib/notificationSender';
import Anthropic from '@anthropic-ai/sdk';

export const goalRouter = Router();
goalRouter.use(authenticate);

goalRouter.post('/', async (req, res, next) => {
  try {
    const { title, description, type, targetDate, parentId, courseId } = req.body;
    const goal = await prisma.learningGoal.create({
      data: {
        userId: req.user!.userId,
        title,
        description: description || '',
        type,
        targetDate: targetDate ? new Date(targetDate) : null,
        parentId: parentId || null,
        courseId: courseId || null,
      },
    });
    res.status(201).json({ success: true, data: goal });
  } catch (err) { next(err); }
});

goalRouter.get('/', async (req, res, next) => {
  try {
    const { type, status, page = '1', pageSize = '20' } = req.query;
    const where: any = { userId: req.user!.userId, parentId: null };
    if (type) where.type = type;
    if (status) where.status = status;

    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      prisma.learningGoal.findMany({
        where, skip, take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        include: {
          children: { select: { id: true, title: true, status: true, progress: true } },
          course: { select: { id: true, title: true } },
          _count: { select: { plans: true, badges: true } },
        },
      }),
      prisma.learningGoal.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    });
  } catch (err) { next(err); }
});

goalRouter.get('/:id', async (req, res, next) => {
  try {
    const goal = await prisma.learningGoal.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        children: true,
        course: { select: { id: true, title: true } },
        plans: { select: { id: true, title: true, status: true, startDate: true, endDate: true } },
        badges: { include: { badge: true } },
      },
    });
    if (!goal) throw new AppError('目标不存在', 404);
    res.json({ success: true, data: goal });
  } catch (err) { next(err); }
});

goalRouter.put('/:id', async (req, res, next) => {
  try {
    const goal = await prisma.learningGoal.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!goal) throw new AppError('目标不存在', 404);

    const { title, description, type, targetDate, status, progress } = req.body;
    const updated = await prisma.learningGoal.update({
      where: { id: goal.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(type !== undefined && { type }),
        ...(targetDate !== undefined && { targetDate: targetDate ? new Date(targetDate) : null }),
        ...(status !== undefined && { status }),
        ...(progress !== undefined && { progress }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

goalRouter.delete('/:id', async (req, res, next) => {
  try {
    const goal = await prisma.learningGoal.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!goal) throw new AppError('目标不存在', 404);

    await prisma.learningGoal.update({
      where: { id: goal.id },
      data: { status: 'abandoned' },
    });
    res.json({ success: true, message: '目标已放弃' });
  } catch (err) { next(err); }
});

goalRouter.post('/:id/decompose', async (req, res, next) => {
  try {
    const goal = await prisma.learningGoal.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: { course: { select: { title: true, category: true } } },
    });
    if (!goal) throw new AppError('目标不存在', 404);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new AppError('AI服务未配置', 500);

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `请将以下学习目标分解为具体的子目标和学习计划。

目标标题：${goal.title}
目标描述：${goal.description}
目标类型：${goal.type === 'long_term' ? '长期目标' : '短期目标'}
${goal.targetDate ? `截止日期：${goal.targetDate.toISOString().split('T')[0]}` : ''}
${goal.course ? `关联课程：${goal.course.title}（${goal.course.category}）` : ''}

请以JSON格式返回，结构如下：
{
  "subGoals": [
    { "title": "子目标标题", "description": "描述", "type": "short_term" }
  ],
  "suggestedPlans": [
    { "title": "计划名称", "durationDays": 14, "items": ["学习项1", "学习项2"] }
  ]
}
只返回JSON，不要其他内容。`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    let decomposition;
    try {
      decomposition = JSON.parse(text);
    } catch {
      decomposition = { raw: text };
    }

    if (decomposition.subGoals && Array.isArray(decomposition.subGoals)) {
      for (const sub of decomposition.subGoals) {
        await prisma.learningGoal.create({
          data: {
            userId: req.user!.userId,
            title: sub.title,
            description: sub.description || '',
            type: sub.type || 'short_term',
            parentId: goal.id,
            courseId: goal.courseId,
            targetDate: goal.targetDate,
          },
        });
      }
    }

    res.json({ success: true, data: decomposition });
  } catch (err) { next(err); }
});

goalRouter.post('/:id/complete', async (req, res, next) => {
  try {
    const goal = await prisma.learningGoal.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!goal) throw new AppError('目标不存在', 404);

    await prisma.learningGoal.update({
      where: { id: goal.id },
      data: { status: 'completed', progress: 1.0 },
    });

    // Check badge eligibility
    const completedCount = await prisma.learningGoal.count({
      where: { userId: req.user!.userId, status: 'completed' },
    });

    const badgeConditions = [
      { count: 1, name: '首个目标完成' },
      { count: 5, name: '5个目标完成' },
    ];

    for (const cond of badgeConditions) {
      if (completedCount >= cond.count) {
        const badge = await prisma.badge.findUnique({ where: { name: cond.name } });
        if (badge) {
          const existing = await prisma.userBadge.findUnique({
            where: { userId_badgeId: { userId: req.user!.userId, badgeId: badge.id } },
          });
          if (!existing) {
            await prisma.userBadge.create({
              data: { userId: req.user!.userId, badgeId: badge.id, goalId: goal.id },
            });
            await sendNotification({
              userId: req.user!.userId,
              type: 'achievement',
              title: '获得新徽章！',
              content: `恭喜你获得「${badge.name}」徽章：${badge.description}`,
            });
          }
        }
      }
    }

    await sendNotification({
      userId: req.user!.userId,
      type: 'goal',
      title: '目标完成！',
      content: `恭喜你完成了目标「${goal.title}」！`,
    });

    res.json({ success: true, message: '目标已完成' });
  } catch (err) { next(err); }
});

// Badge routes
goalRouter.get('/badges/all', async (req, res, next) => {
  try {
    const badges = await prisma.badge.findMany({ orderBy: { createdAt: 'asc' } });
    res.json({ success: true, data: badges });
  } catch (err) { next(err); }
});

goalRouter.get('/badges/my', async (req, res, next) => {
  try {
    const userBadges = await prisma.userBadge.findMany({
      where: { userId: req.user!.userId },
      include: { badge: true, goal: { select: { id: true, title: true } } },
      orderBy: { earnedAt: 'desc' },
    });
    res.json({ success: true, data: userBadges });
  } catch (err) { next(err); }
});
