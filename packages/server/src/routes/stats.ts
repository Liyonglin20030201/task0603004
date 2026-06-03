import { Router } from 'express';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';

export const statsRouter = Router();
statsRouter.use(authenticate);

statsRouter.get('/overview', async (req, res, next) => {
  try {
    const userId = req.user!.userId;

    const [courses, plans, checkIns, todayCheckIns] = await Promise.all([
      prisma.course.count({ where: { userId, status: { not: 'archived' } } }),
      prisma.learningPlan.findMany({
        where: { userId, status: { in: ['active', 'delayed'] } },
        include: { items: true },
      }),
      prisma.checkIn.findMany({
        where: { userId },
        select: { checkInDate: true, durationMinutes: true },
        distinct: ['checkInDate'],
        orderBy: { checkInDate: 'desc' },
      }),
      prisma.checkIn.count({
        where: {
          userId,
          checkInDate: new Date(new Date().toISOString().slice(0, 10)),
        },
      }),
    ]);

    const totalItems = plans.reduce((sum, p) => sum + p.items.length, 0);
    const completedItems = plans.reduce(
      (sum, p) => sum + p.items.filter(i => i.status === 'completed').length, 0
    );

    // Streak calculation
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneDayMs = 86400000;

    if (checkIns.length > 0) {
      const dates = checkIns.map(c => {
        const d = new Date(c.checkInDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      });

      const todayTime = today.getTime();
      if (dates[0] === todayTime || dates[0] === todayTime - oneDayMs) {
        currentStreak = 1;
        for (let i = 1; i < dates.length; i++) {
          if (dates[i - 1] - dates[i] === oneDayMs) {
            currentStreak++;
          } else break;
        }
      }
    }

    const allCheckIns = await prisma.checkIn.findMany({
      where: { userId },
      select: { durationMinutes: true },
    });
    const totalStudyMinutes = allCheckIns.reduce((sum, c) => sum + (c.durationMinutes || 0), 0);

    res.json({
      success: true,
      data: {
        totalCourses: courses,
        activePlans: plans.length,
        currentStreak,
        longestStreak: currentStreak,
        completionRate: totalItems > 0 ? completedItems / totalItems : 0,
        todayCheckins: todayCheckIns,
        totalStudyMinutes,
      },
    });
  } catch (err) { next(err); }
});

statsRouter.get('/daily', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { from, to } = req.query;

    const startDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 86400000);
    const endDate = to ? new Date(to as string) : new Date();

    const checkIns = await prisma.checkIn.findMany({
      where: {
        userId,
        checkInDate: { gte: startDate, lte: endDate },
      },
      select: { checkInDate: true, durationMinutes: true, planItemId: true },
    });

    const dailyMap = new Map<string, { checkIns: number; studyMinutes: number; itemsCompleted: number }>();

    for (const ci of checkIns) {
      const dateKey = new Date(ci.checkInDate).toISOString().slice(0, 10);
      const existing = dailyMap.get(dateKey) || { checkIns: 0, studyMinutes: 0, itemsCompleted: 0 };
      existing.checkIns++;
      existing.studyMinutes += ci.durationMinutes || 0;
      existing.itemsCompleted++;
      dailyMap.set(dateKey, existing);
    }

    const data = Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      ...stats,
    })).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ success: true, data });
  } catch (err) { next(err); }
});

statsRouter.get('/courses', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { includeArchived } = req.query;

    const statusFilter: any = includeArchived === 'true' ? {} : { status: { not: 'archived' } };

    const courses = await prisma.course.findMany({
      where: { userId, ...statusFilter },
      include: {
        learningPlans: { include: { items: true } },
      },
    });

    const data = courses.map(course => {
      const totalItems = course.learningPlans.reduce((sum, p) => sum + p.items.length, 0);
      const completedItems = course.learningPlans.reduce(
        (sum, p) => sum + p.items.filter(i => i.status === 'completed').length, 0
      );
      return {
        courseId: course.id,
        courseTitle: course.title,
        status: course.status,
        totalItems,
        completedItems,
        completionRate: totalItems > 0 ? completedItems / totalItems : 0,
      };
    });

    res.json({ success: true, data });
  } catch (err) { next(err); }
});

statsRouter.get('/weekly-report', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const weekAgo = new Date(Date.now() - 7 * 86400000);

    const [checkIns, newWrongAnswers, completedItems] = await Promise.all([
      prisma.checkIn.findMany({
        where: { userId, checkInDate: { gte: weekAgo } },
        select: { durationMinutes: true, checkInDate: true },
      }),
      prisma.wrongAnswer.count({ where: { userId, createdAt: { gte: weekAgo } } }),
      prisma.planItem.count({
        where: {
          plan: { userId },
          status: 'completed',
          updatedAt: { gte: weekAgo },
        },
      }),
    ]);

    const totalMinutes = checkIns.reduce((sum, c) => sum + (c.durationMinutes || 0), 0);
    const activeDays = new Set(checkIns.map(c => new Date(c.checkInDate).toISOString().slice(0, 10))).size;

    res.json({
      success: true,
      data: {
        period: { from: weekAgo.toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) },
        totalStudyMinutes: totalMinutes,
        activeDays,
        checkInCount: checkIns.length,
        completedItems,
        newWrongAnswers,
      },
    });
  } catch (err) { next(err); }
});
