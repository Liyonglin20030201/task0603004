import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

export const checkinRouter = Router();
checkinRouter.use(authenticate);

const createCheckinSchema = z.object({
  planItemId: z.string().uuid(),
  durationMinutes: z.number().int().positive().optional(),
  note: z.string().optional(),
});

// Create check-in with duplicate prevention
checkinRouter.post('/', validate(createCheckinSchema), async (req, res, next) => {
  try {
    const { planItemId, durationMinutes, note } = req.body;
    const userId = req.user!.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Verify plan item belongs to user
    const planItem = await prisma.planItem.findFirst({
      where: { id: planItemId, plan: { userId } },
    });
    if (!planItem) throw new AppError('Plan item not found', 404);

    // Try to create - UNIQUE constraint will catch duplicates
    try {
      const checkIn = await prisma.checkIn.create({
        data: {
          userId,
          planItemId,
          checkInDate: today,
          durationMinutes,
          note,
        },
      });

      // Mark plan item as completed
      await prisma.planItem.update({
        where: { id: planItemId },
        data: { status: 'completed' },
      });

      res.status(201).json({ success: true, data: checkIn });
    } catch (err: any) {
      // Prisma unique constraint violation
      if (err.code === 'P2002') {
        throw new AppError('今日已打卡该项目，请勿重复打卡', 409);
      }
      throw err;
    }
  } catch (err) { next(err); }
});

// Get check-ins for date range
checkinRouter.get('/', async (req, res, next) => {
  try {
    const { date, from, to } = req.query;
    const userId = req.user!.userId;
    const where: any = { userId };

    if (date) {
      where.checkInDate = new Date(date as string);
    } else if (from && to) {
      where.checkInDate = {
        gte: new Date(from as string),
        lte: new Date(to as string),
      };
    }

    const checkIns = await prisma.checkIn.findMany({
      where,
      include: {
        planItem: { select: { id: true, title: true, plan: { select: { id: true, title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: checkIns });
  } catch (err) { next(err); }
});

// Get streak info
checkinRouter.get('/streak', async (req, res, next) => {
  try {
    const userId = req.user!.userId;

    // Get distinct check-in dates ordered descending
    const checkIns = await prisma.checkIn.findMany({
      where: { userId },
      select: { checkInDate: true },
      distinct: ['checkInDate'],
      orderBy: { checkInDate: 'desc' },
    });

    if (checkIns.length === 0) {
      return res.json({ success: true, data: { currentStreak: 0, longestStreak: 0 } });
    }

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates = checkIns.map(c => {
      const d = new Date(c.checkInDate);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    });

    const todayTime = today.getTime();
    const oneDayMs = 86400000;

    // Check if streak is active (today or yesterday)
    if (dates[0] !== todayTime && dates[0] !== todayTime - oneDayMs) {
      currentStreak = 0;
    } else {
      currentStreak = 1;
      for (let i = 1; i < dates.length; i++) {
        if (dates[i - 1] - dates[i] === oneDayMs) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 1;
    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
      if (dates[i - 1] - dates[i] === oneDayMs) {
        streak++;
        longestStreak = Math.max(longestStreak, streak);
      } else {
        streak = 1;
      }
    }

    res.json({ success: true, data: { currentStreak, longestStreak } });
  } catch (err) { next(err); }
});

// Undo check-in (same day only)
checkinRouter.delete('/:id', async (req, res, next) => {
  try {
    const checkIn = await prisma.checkIn.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!checkIn) throw new AppError('Check-in not found', 404);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(checkIn.checkInDate);
    checkInDate.setHours(0, 0, 0, 0);

    if (checkInDate.getTime() !== today.getTime()) {
      throw new AppError('只能撤销今日的打卡记录', 400);
    }

    await prisma.$transaction([
      prisma.checkIn.delete({ where: { id: checkIn.id } }),
      prisma.planItem.update({ where: { id: checkIn.planItemId }, data: { status: 'pending' } }),
    ]);

    res.json({ success: true, message: '打卡已撤销' });
  } catch (err) { next(err); }
});
