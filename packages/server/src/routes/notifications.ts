import { Router } from 'express';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const notificationRouter = Router();
notificationRouter.use(authenticate);

notificationRouter.get('/', async (req, res, next) => {
  try {
    const { unreadOnly, page = '1', pageSize = '20' } = req.query;
    const where: any = { userId: req.user!.userId };
    if (unreadOnly === 'true') where.read = false;

    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where, skip, take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user!.userId, read: false } }),
    ]);

    res.json({
      success: true,
      data: {
        items,
        total,
        unreadCount,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    });
  } catch (err) { next(err); }
});

notificationRouter.put('/:id/read', async (req, res, next) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!notification) throw new AppError('Notification not found', 404);

    await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

notificationRouter.put('/read-all', async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, read: false },
      data: { read: true },
    });
    res.json({ success: true, message: '已全部标为已读' });
  } catch (err) { next(err); }
});
