import { Router } from 'express';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { findMatches } from '../lib/partnerMatcher';
import { sendNotification } from '../lib/notificationSender';

export const partnerRouter = Router();
partnerRouter.use(authenticate);

partnerRouter.get('/profile', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const profile = await prisma.partnerProfile.findUnique({ where: { userId } });
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

partnerRouter.put('/profile', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { isSearching, bio, courseIds, goalKeywords, availableHours, studyPreferences } = req.body;

    const profile = await prisma.partnerProfile.upsert({
      where: { userId },
      update: {
        isSearching: isSearching ?? true,
        bio: bio ?? '',
        courseIds: courseIds ?? [],
        goalKeywords: goalKeywords ?? [],
        availableHours: availableHours ?? [],
        studyPreferences: studyPreferences ?? null,
        lastActive: new Date(),
      },
      create: {
        userId,
        isSearching: isSearching ?? true,
        bio: bio ?? '',
        courseIds: courseIds ?? [],
        goalKeywords: goalKeywords ?? [],
        availableHours: availableHours ?? [],
        studyPreferences: studyPreferences ?? null,
      },
    });

    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

partnerRouter.get('/matches', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const matches = await findMatches(prisma, userId);
    res.json({ success: true, data: matches });
  } catch (err) { next(err); }
});

partnerRouter.post('/request', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { toUserId, message, score } = req.body;

    if (toUserId === userId) {
      return res.status(400).json({ success: false, error: '不能向自己发送请求' });
    }

    const existing = await prisma.partnerRequest.findUnique({
      where: { fromUserId_toUserId: { fromUserId: userId, toUserId } },
    });
    if (existing) {
      return res.status(409).json({ success: false, error: '已经发送过请求' });
    }

    const request = await prisma.partnerRequest.create({
      data: {
        fromUserId: userId,
        toUserId,
        message: message || null,
        score: score || 0,
      },
    });

    const fromUser = await prisma.user.findUnique({ where: { id: userId }, select: { nickname: true } });
    await sendNotification({
      userId: toUserId,
      type: 'system',
      title: '收到学习伙伴请求',
      content: `${fromUser?.nickname || '某位同学'} 想成为你的学习伙伴，匹配度 ${Math.round(score || 0)}%`,
    });

    res.json({ success: true, data: request });
  } catch (err) { next(err); }
});

partnerRouter.get('/requests', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { direction } = req.query;

    let where: any;
    if (direction === 'sent') {
      where = { fromUserId: userId };
    } else if (direction === 'received') {
      where = { toUserId: userId };
    } else {
      where = { OR: [{ fromUserId: userId }, { toUserId: userId }] };
    }

    const requests = await prisma.partnerRequest.findMany({
      where,
      include: {
        fromUser: { select: { id: true, nickname: true, avatarUrl: true } },
        toUser: { select: { id: true, nickname: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: requests });
  } catch (err) { next(err); }
});

partnerRouter.put('/requests/:id', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { status } = req.body;

    const request = await prisma.partnerRequest.findUnique({ where: { id } });
    if (!request || request.toUserId !== userId) {
      return res.status(404).json({ success: false, error: '请求不存在' });
    }

    await prisma.partnerRequest.update({
      where: { id },
      data: { status },
    });

    if (status === 'accepted') {
      const [u1, u2] = [request.fromUserId, request.toUserId].sort();
      await prisma.partnership.create({
        data: { user1Id: u1, user2Id: u2 },
      });

      const toUser = await prisma.user.findUnique({ where: { id: userId }, select: { nickname: true } });
      await sendNotification({
        userId: request.fromUserId,
        type: 'system',
        title: '学习伙伴请求已接受',
        content: `${toUser?.nickname || '某位同学'} 接受了你的学习伙伴请求！`,
      });
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

partnerRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.userId;

    const partnerships = await prisma.partnership.findMany({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }], isActive: true },
      include: {
        user1: { select: { id: true, nickname: true, avatarUrl: true } },
        user2: { select: { id: true, nickname: true, avatarUrl: true } },
      },
    });

    const partners = partnerships.map((p: any) => ({
      partnershipId: p.id,
      partner: p.user1Id === userId ? p.user2 : p.user1,
      startedAt: p.startedAt,
    }));

    res.json({ success: true, data: partners });
  } catch (err) { next(err); }
});

partnerRouter.get('/:userId/progress', async (req, res, next) => {
  try {
    const myUserId = req.user!.userId;
    const { userId: partnerId } = req.params;

    // Verify partnership exists
    const partnership = await prisma.partnership.findFirst({
      where: {
        isActive: true,
        OR: [
          { user1Id: myUserId, user2Id: partnerId },
          { user1Id: partnerId, user2Id: myUserId },
        ],
      },
    });

    if (!partnership) {
      return res.status(403).json({ success: false, error: '非学习伙伴关系' });
    }

    const weekAgo = new Date(Date.now() - 7 * 86400000);

    const [streak, weeklyCheckIns, weeklyMinutes] = await Promise.all([
      prisma.checkIn.findMany({
        where: { userId: partnerId },
        select: { checkInDate: true },
        distinct: ['checkInDate'],
        orderBy: { checkInDate: 'desc' },
        take: 60,
      }),
      prisma.checkIn.count({
        where: { userId: partnerId, checkInDate: { gte: weekAgo } },
      }),
      prisma.checkIn.findMany({
        where: { userId: partnerId, checkInDate: { gte: weekAgo } },
        select: { durationMinutes: true },
      }),
    ]);

    // Calculate streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (streak.length > 0) {
      const dates = streak.map((c: any) => {
        const d = new Date(c.checkInDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      });
      const todayTime = today.getTime();
      if (dates[0] === todayTime || dates[0] === todayTime - 86400000) {
        currentStreak = 1;
        for (let i = 1; i < dates.length; i++) {
          if (dates[i - 1] - dates[i] === 86400000) currentStreak++;
          else break;
        }
      }
    }

    res.json({
      success: true,
      data: {
        currentStreak,
        weeklyCheckIns,
        weeklyStudyMinutes: weeklyMinutes.reduce((s: number, c: any) => s + (c.durationMinutes || 0), 0),
      },
    });
  } catch (err) { next(err); }
});

partnerRouter.delete('/:userId', async (req, res, next) => {
  try {
    const myUserId = req.user!.userId;
    const { userId: partnerId } = req.params;

    await prisma.partnership.updateMany({
      where: {
        isActive: true,
        OR: [
          { user1Id: myUserId, user2Id: partnerId },
          { user1Id: partnerId, user2Id: myUserId },
        ],
      },
      data: { isActive: false },
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});
