import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../app';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

export const adminRouter = Router();
adminRouter.use(authenticate);
adminRouter.use(requireAdmin);

adminRouter.get('/users', async (req, res, next) => {
  try {
    const { page = '1', pageSize = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip, take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, nickname: true, role: true, timezone: true, createdAt: true,
          _count: { select: { courses: true, learningPlans: true, checkIns: true } },
        },
      }),
      prisma.user.count(),
    ]);

    res.json({
      success: true,
      data: { items: users, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    });
  } catch (err) { next(err); }
});

const roleSchema = z.object({
  role: z.enum(['admin', 'user']),
});

adminRouter.put('/users/:id/role', validate(roleSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError('User not found', 404);

    if (user.id === req.user!.userId) {
      throw new AppError('Cannot change own role', 400);
    }

    await prisma.user.update({ where: { id: req.params.id }, data: { role: req.body.role } });
    res.json({ success: true, message: 'Role updated' });
  } catch (err) { next(err); }
});

adminRouter.get('/configs', async (_req, res, next) => {
  try {
    const configs = await prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });
    res.json({ success: true, data: configs });
  } catch (err) { next(err); }
});

const configSchema = z.object({
  value: z.any(),
});

adminRouter.put('/configs/:key', validate(configSchema), async (req, res, next) => {
  try {
    const config = await prisma.systemConfig.upsert({
      where: { key: req.params.key },
      update: { value: req.body.value, updatedBy: req.user!.userId },
      create: { key: req.params.key, value: req.body.value, updatedBy: req.user!.userId },
    });
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
});

adminRouter.delete('/configs/:key', async (req, res, next) => {
  try {
    const existing = await prisma.systemConfig.findUnique({ where: { key: req.params.key } });
    if (!existing) throw new AppError('Config not found', 404);

    await prisma.systemConfig.delete({ where: { key: req.params.key } });
    res.json({ success: true, message: 'Config deleted' });
  } catch (err) { next(err); }
});
