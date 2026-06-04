import { Router } from 'express';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { redis } from '../lib/redis';
import { sendNotification } from '../lib/notificationSender';
import { updateGroupGoalProgress } from '../lib/groupGoalProgress';

export const groupRouter = Router();
groupRouter.use(authenticate);

// Create group
groupRouter.post('/', async (req, res, next) => {
  try {
    const { name, description, joinPolicy, maxMembers } = req.body;
    const group = await prisma.$transaction(async (tx: any) => {
      const g = await tx.studyGroup.create({
        data: {
          name,
          description: description || '',
          ownerId: req.user!.userId,
          joinPolicy: joinPolicy || 'open',
          maxMembers: maxMembers || 20,
        },
      });
      await tx.groupMember.create({
        data: { groupId: g.id, userId: req.user!.userId, role: 'owner' },
      });
      return g;
    });
    res.status(201).json({ success: true, data: group });
  } catch (err) { next(err); }
});

// List my groups
groupRouter.get('/', async (req, res, next) => {
  try {
    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.user!.userId },
      include: {
        group: {
          include: {
            _count: { select: { members: true } },
            owner: { select: { id: true, nickname: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    const groups = memberships.map((m: any) => ({ ...m.group, myRole: m.role }));
    res.json({ success: true, data: groups });
  } catch (err) { next(err); }
});

// Discover groups
groupRouter.get('/discover', async (req, res, next) => {
  try {
    const { page = '1', pageSize = '20', search } = req.query;
    const where: any = { joinPolicy: { in: ['open', 'approval'] } };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const myGroupIds = (await prisma.groupMember.findMany({
      where: { userId: req.user!.userId },
      select: { groupId: true },
    })).map((m: any) => m.groupId);

    if (myGroupIds.length > 0) {
      where.id = { notIn: myGroupIds };
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      prisma.studyGroup.findMany({
        where, skip, take: Number(pageSize),
        include: {
          _count: { select: { members: true } },
          owner: { select: { id: true, nickname: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.studyGroup.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    });
  } catch (err) { next(err); }
});

// Get group detail
groupRouter.get('/:id', async (req, res, next) => {
  try {
    const group = await prisma.studyGroup.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, nickname: true, avatarUrl: true } },
        members: {
          include: { user: { select: { id: true, nickname: true, avatarUrl: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { members: true, goals: true, sharedItems: true } },
      },
    });
    if (!group) throw new AppError('小组不存在', 404);

    const membership = group.members.find((m: any) => m.userId === req.user!.userId);
    res.json({ success: true, data: { ...group, myRole: membership?.role || null } });
  } catch (err) { next(err); }
});

// Update group
groupRouter.put('/:id', async (req, res, next) => {
  try {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: req.user!.userId } },
    });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new AppError('无权操作', 403);
    }

    const { name, description, joinPolicy, maxMembers } = req.body;
    const updated = await prisma.studyGroup.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(joinPolicy !== undefined && { joinPolicy }),
        ...(maxMembers !== undefined && { maxMembers }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// Delete group
groupRouter.delete('/:id', async (req, res, next) => {
  try {
    const group = await prisma.studyGroup.findUnique({ where: { id: req.params.id } });
    if (!group || group.ownerId !== req.user!.userId) {
      throw new AppError('只有组长可以解散小组', 403);
    }
    await prisma.studyGroup.delete({ where: { id: group.id } });
    res.json({ success: true, message: '小组已解散' });
  } catch (err) { next(err); }
});

// Join group
groupRouter.post('/:id/join', async (req, res, next) => {
  try {
    const group = await prisma.studyGroup.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { members: true } } },
    });
    if (!group) throw new AppError('小组不存在', 404);
    if (group.joinPolicy === 'invite') throw new AppError('此小组仅限邀请加入', 403);
    if (group._count.members >= group.maxMembers) throw new AppError('小组人数已满', 400);

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: req.user!.userId } },
    });
    if (existing) throw new AppError('你已是小组成员', 400);

    await prisma.groupMember.create({
      data: { groupId: group.id, userId: req.user!.userId, role: 'member' },
    });

    await sendNotification({
      userId: group.ownerId,
      type: 'group',
      title: '新成员加入',
      content: `有新成员加入了你的小组「${group.name}」`,
    });

    await redis.del(`group:lb:${group.id}`).catch(() => {});
    res.json({ success: true, message: '已加入小组' });
  } catch (err) { next(err); }
});

// Leave group
groupRouter.post('/:id/leave', async (req, res, next) => {
  try {
    const group = await prisma.studyGroup.findUnique({ where: { id: req.params.id } });
    if (!group) throw new AppError('小组不存在', 404);
    if (group.ownerId === req.user!.userId) throw new AppError('组长不能退出，请先转让或解散', 400);

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId: group.id, userId: req.user!.userId } },
    });
    await redis.del(`group:lb:${group.id}`).catch(() => {});
    res.json({ success: true, message: '已退出小组' });
  } catch (err) { next(err); }
});

// Remove member
groupRouter.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    const myMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: req.user!.userId } },
    });
    if (!myMember || !['owner', 'admin'].includes(myMember.role)) {
      throw new AppError('无权操作', 403);
    }

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } },
    });
    await redis.del(`group:lb:${req.params.id}`).catch(() => {});
    res.json({ success: true, message: '成员已移除' });
  } catch (err) { next(err); }
});

// Update member role
groupRouter.put('/:id/members/:userId/role', async (req, res, next) => {
  try {
    const group = await prisma.studyGroup.findUnique({ where: { id: req.params.id } });
    if (!group || group.ownerId !== req.user!.userId) {
      throw new AppError('只有组长可以修改角色', 403);
    }

    const { role } = req.body;
    await prisma.groupMember.update({
      where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } },
      data: { role },
    });
    res.json({ success: true, message: '角色已更新' });
  } catch (err) { next(err); }
});

// Share item
groupRouter.post('/:id/share', async (req, res, next) => {
  try {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: req.user!.userId } },
    });
    if (!member) throw new AppError('你不是小组成员', 403);

    const { itemType, itemId } = req.body;
    if (!['course', 'plan', 'resource'].includes(itemType)) throw new AppError('无效的分享类型', 400);

    const shared = await prisma.groupSharedItem.create({
      data: { groupId: req.params.id, userId: req.user!.userId, itemType, itemId },
    });
    res.status(201).json({ success: true, data: shared });
  } catch (err) { next(err); }
});

// List shared items
groupRouter.get('/:id/shared', async (req, res, next) => {
  try {
    const items = await prisma.groupSharedItem.findMany({
      where: { groupId: req.params.id },
      include: { user: { select: { id: true, nickname: true } } },
      orderBy: { sharedAt: 'desc' },
    });

    const enriched = await Promise.all(items.map(async (item: any) => {
      let detail: any = null;
      if (item.itemType === 'course') {
        detail = await prisma.course.findUnique({ where: { id: item.itemId }, select: { id: true, title: true, category: true } });
      } else if (item.itemType === 'plan') {
        detail = await prisma.learningPlan.findUnique({ where: { id: item.itemId }, select: { id: true, title: true, status: true } });
      } else if (item.itemType === 'resource') {
        detail = await prisma.resource.findUnique({ where: { id: item.itemId }, select: { id: true, title: true, fileName: true, fileSize: true, mimeType: true } });
      }
      return { ...item, detail };
    }));

    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
});

// Group check-in feed
groupRouter.get('/:id/checkins', async (req, res, next) => {
  try {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: req.user!.userId } },
    });
    if (!member) throw new AppError('你不是小组成员', 403);

    const memberIds = (await prisma.groupMember.findMany({
      where: { groupId: req.params.id },
      select: { userId: true },
    })).map((m: any) => m.userId);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const checkIns = await prisma.checkIn.findMany({
      where: { userId: { in: memberIds }, checkInDate: { gte: sevenDaysAgo } },
      include: {
        user: { select: { id: true, nickname: true, avatarUrl: true } },
        planItem: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: checkIns });
  } catch (err) { next(err); }
});

// Group leaderboard
groupRouter.get('/:id/leaderboard', async (req, res, next) => {
  try {
    const cacheKey = `group:lb:${req.params.id}`;
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      return res.json({ success: true, data: JSON.parse(cached) });
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId: req.params.id },
      include: { user: { select: { id: true, nickname: true, avatarUrl: true } } },
    });

    const memberIds = members.map((m: any) => m.userId);
    if (memberIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyStats = await prisma.checkIn.groupBy({
      by: ['userId'],
      where: { userId: { in: memberIds }, checkInDate: { gte: weekAgo } },
      _count: { id: true },
      _sum: { durationMinutes: true },
    });

    const statsMap = new Map<string, { count: number; minutes: number }>(weeklyStats.map((s: any) => [s.userId, {
      count: s._count.id,
      minutes: s._sum.durationMinutes || 0,
    }]));

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const recentCheckIns = await prisma.checkIn.findMany({
      where: { userId: { in: memberIds }, checkInDate: { gte: sixtyDaysAgo } },
      orderBy: { checkInDate: 'desc' },
      select: { userId: true, checkInDate: true },
    });

    const checkInsByUser = new Map<string, Set<string>>();
    for (const c of recentCheckIns) {
      if (!checkInsByUser.has(c.userId)) checkInsByUser.set(c.userId, new Set());
      checkInsByUser.get(c.userId)!.add(c.checkInDate.toISOString().split('T')[0]);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const leaderboard = members.map((m: any) => {
      const stats = statsMap.get(m.userId) || { count: 0, minutes: 0 };
      const dates = checkInsByUser.get(m.userId);
      let streak = 0;
      if (dates) {
        for (let i = 0; i < 60; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          if (dates.has(d.toISOString().split('T')[0])) {
            streak++;
          } else {
            break;
          }
        }
      }

      return {
        userId: m.userId,
        nickname: m.user.nickname,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        weeklyMinutes: stats.minutes,
        weeklyCheckIns: stats.count,
        streak,
        score: streak * 100 + stats.minutes,
      };
    });

    leaderboard.sort((a: any, b: any) => b.score - a.score);

    await redis.set(cacheKey, JSON.stringify(leaderboard), 'EX', 900).catch(() => {});
    res.json({ success: true, data: leaderboard });
  } catch (err) { next(err); }
});

// Group progress comparison
groupRouter.get('/:id/progress', async (req, res, next) => {
  try {
    const members = await prisma.groupMember.findMany({
      where: { groupId: req.params.id },
      include: { user: { select: { id: true, nickname: true } } },
    });

    const progress = await Promise.all(members.map(async (m: any) => {
      const plans = await prisma.learningPlan.findMany({
        where: { userId: m.userId, status: { in: ['active', 'completed', 'delayed'] } },
        include: { items: true },
      });

      const totalItems = plans.reduce((sum: number, p: any) => sum + p.items.length, 0);
      const completedItems = plans.reduce((sum: number, p: any) => sum + p.items.filter((i: any) => i.status === 'completed').length, 0);

      return {
        userId: m.userId,
        nickname: m.user.nickname,
        totalPlans: plans.length,
        totalItems,
        completedItems,
        completionRate: totalItems > 0 ? completedItems / totalItems : 0,
      };
    }));

    progress.sort((a, b) => b.completionRate - a.completionRate);
    res.json({ success: true, data: progress });
  } catch (err) { next(err); }
});

// Group goals
groupRouter.post('/:id/goals', async (req, res, next) => {
  try {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: req.user!.userId } },
    });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new AppError('只有组长或管理员可以创建小组目标', 403);
    }

    const { title, description, targetDate, targetType, targetValue } = req.body;
    let goal = await prisma.groupGoal.create({
      data: {
        groupId: req.params.id,
        title,
        description: description || '',
        targetDate: targetDate ? new Date(targetDate) : null,
        targetType: targetType || null,
        targetValue: targetValue ? Number(targetValue) : null,
      },
    });

    // Immediately calculate initial progress based on existing member data
    if (targetType && targetValue) {
      await updateGroupGoalProgress(req.params.id).catch(() => {});
      goal = await prisma.groupGoal.findUnique({ where: { id: goal.id } }) || goal;
    }

    res.status(201).json({ success: true, data: goal });
  } catch (err) { next(err); }
});

groupRouter.get('/:id/goals', async (req, res, next) => {
  try {
    const goals = await prisma.groupGoal.findMany({
      where: { groupId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: goals });
  } catch (err) { next(err); }
});

groupRouter.put('/:id/goals/:goalId', async (req, res, next) => {
  try {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: req.user!.userId } },
    });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new AppError('无权操作', 403);
    }

    const { title, description, targetDate, status } = req.body;
    const updated = await prisma.groupGoal.update({
      where: { id: req.params.goalId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(targetDate !== undefined && { targetDate: targetDate ? new Date(targetDate) : null }),
        ...(status !== undefined && { status }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// Group messages
groupRouter.get('/:id/messages', async (req, res, next) => {
  try {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: req.user!.userId } },
    });
    if (!member) throw new AppError('你不是小组成员', 403);

    const { page = '1', pageSize = '30' } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);

    const [items, total] = await Promise.all([
      prisma.groupMessage.findMany({
        where: { groupId: req.params.id },
        include: { user: { select: { id: true, nickname: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip, take: Number(pageSize),
      }),
      prisma.groupMessage.count({ where: { groupId: req.params.id } }),
    ]);

    res.json({
      success: true,
      data: { items: items.reverse(), total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    });
  } catch (err) { next(err); }
});

groupRouter.post('/:id/messages', async (req, res, next) => {
  try {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: req.user!.userId } },
    });
    if (!member) throw new AppError('你不是小组成员', 403);

    const { content } = req.body;
    if (!content?.trim()) throw new AppError('消息内容不能为空', 400);

    const message = await prisma.groupMessage.create({
      data: { groupId: req.params.id, userId: req.user!.userId, content: content.trim() },
      include: { user: { select: { id: true, nickname: true, avatarUrl: true } } },
    });
    res.status(201).json({ success: true, data: message });
  } catch (err) { next(err); }
});
