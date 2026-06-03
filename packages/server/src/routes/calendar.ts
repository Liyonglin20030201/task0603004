import { Router } from 'express';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';

export const calendarRouter = Router();
calendarRouter.use(authenticate);

calendarRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { month } = req.query;

    let startDate: Date;
    let endDate: Date;

    if (month) {
      const [year, m] = (month as string).split('-').map(Number);
      startDate = new Date(year, m - 1, 1);
      endDate = new Date(year, m, 0);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const [planItems, checkIns] = await Promise.all([
      prisma.planItem.findMany({
        where: {
          plan: { userId },
          scheduledDate: { gte: startDate, lte: endDate },
        },
        include: {
          plan: { select: { id: true, title: true, course: { select: { title: true } } } },
        },
        orderBy: { scheduledDate: 'asc' },
      }),
      prisma.checkIn.findMany({
        where: {
          userId,
          checkInDate: { gte: startDate, lte: endDate },
        },
        include: {
          planItem: { select: { title: true } },
        },
      }),
    ]);

    const events: any[] = [];

    for (const item of planItems) {
      events.push({
        type: item.status === 'completed' ? 'completed' : item.status === 'skipped' ? 'skipped' : 'planned',
        date: new Date(item.scheduledDate).toISOString().slice(0, 10),
        title: item.title,
        planTitle: item.plan.title,
        courseName: item.plan.course.title,
        status: item.status,
      });
    }

    for (const ci of checkIns) {
      events.push({
        type: 'checkin',
        date: new Date(ci.checkInDate).toISOString().slice(0, 10),
        title: ci.planItem.title,
        durationMinutes: ci.durationMinutes,
      });
    }

    res.json({ success: true, data: events });
  } catch (err) { next(err); }
});
