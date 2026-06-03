import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

export const planRouter = Router();
planRouter.use(authenticate);

const createPlanSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(1).max(200),
  startDate: z.string(),
  endDate: z.string(),
  items: z.array(z.object({
    title: z.string().min(1).max(200),
    scheduledDate: z.string(),
    sortOrder: z.number().int().optional().default(0),
  })),
});

const updatePlanSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
});

// List plans
planRouter.get('/', async (req, res, next) => {
  try {
    const { courseId, status, page = '1', pageSize = '20' } = req.query;
    const where: any = { userId: req.user!.userId };
    if (courseId) where.courseId = courseId;
    if (status) where.status = status;

    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      prisma.learningPlan.findMany({
        where, skip, take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        include: { items: { select: { id: true, status: true } }, course: { select: { id: true, title: true } } },
      }),
      prisma.learningPlan.count({ where }),
    ]);

    const data = items.map(plan => ({
      ...plan,
      progress: {
        total: plan.items.length,
        completed: plan.items.filter(i => i.status === 'completed').length,
      },
    }));

    res.json({
      success: true,
      data: { items: data, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    });
  } catch (err) { next(err); }
});

// Create plan with items
planRouter.post('/', validate(createPlanSchema), async (req, res, next) => {
  try {
    const { courseId, title, startDate, endDate, items } = req.body;

    // Verify course belongs to user
    const course = await prisma.course.findFirst({ where: { id: courseId, userId: req.user!.userId } });
    if (!course) throw new AppError('Course not found', 404);

    const plan = await prisma.learningPlan.create({
      data: {
        userId: req.user!.userId,
        courseId,
        title,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        originalEndDate: new Date(endDate),
        items: {
          create: items.map((item: any, index: number) => ({
            title: item.title,
            scheduledDate: new Date(item.scheduledDate),
            originalDate: new Date(item.scheduledDate),
            sortOrder: item.sortOrder ?? index,
          })),
        },
      },
      include: { items: true },
    });

    res.status(201).json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// Get plan detail
planRouter.get('/:id', async (req, res, next) => {
  try {
    const plan = await prisma.learningPlan.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        items: { orderBy: { scheduledDate: 'asc' }, include: { checkIns: true } },
        course: { select: { id: true, title: true, category: true } },
      },
    });
    if (!plan) throw new AppError('Plan not found', 404);

    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// Update plan
planRouter.put('/:id', validate(updatePlanSchema), async (req, res, next) => {
  try {
    const plan = await prisma.learningPlan.findFirst({ where: { id: req.params.id, userId: req.user!.userId } });
    if (!plan) throw new AppError('Plan not found', 404);

    const updated = await prisma.learningPlan.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// Handle plan delay - KEY BUSINESS LOGIC
planRouter.post('/:id/delay', async (req, res, next) => {
  try {
    const plan = await prisma.learningPlan.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: { items: { orderBy: { scheduledDate: 'asc' } } },
    });
    if (!plan) throw new AppError('Plan not found', 404);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find overdue pending items (scheduled before or on today, still pending)
    const overdueItems = plan.items.filter(
      item => item.status === 'pending' && new Date(item.scheduledDate) < today
    );

    if (overdueItems.length === 0) {
      throw new AppError('No overdue items to delay', 400);
    }

    const delayDays = overdueItems.length;

    // Get future pending items (scheduled today or later)
    const futureItems = plan.items.filter(
      item => item.status === 'pending' && new Date(item.scheduledDate) >= today
    );

    // Transaction: mark overdue as skipped, shift future items, update plan end date
    await prisma.$transaction(async (tx) => {
      // Mark overdue items as skipped
      await tx.planItem.updateMany({
        where: { id: { in: overdueItems.map(i => i.id) } },
        data: { status: 'skipped' },
      });

      // Shift each future item's scheduled_date by delayDays
      for (const item of futureItems) {
        const newDate = new Date(item.scheduledDate);
        newDate.setDate(newDate.getDate() + delayDays);
        await tx.planItem.update({
          where: { id: item.id },
          data: { scheduledDate: newDate },
        });
      }

      // Update plan end date and status
      const newEndDate = new Date(plan.endDate);
      newEndDate.setDate(newEndDate.getDate() + delayDays);
      await tx.learningPlan.update({
        where: { id: plan.id },
        data: {
          endDate: newEndDate,
          status: 'delayed',
          originalEndDate: plan.originalEndDate || plan.endDate,
        },
      });
    });

    // Return updated plan
    const updatedPlan = await prisma.learningPlan.findUnique({
      where: { id: plan.id },
      include: { items: { orderBy: { scheduledDate: 'asc' } } },
    });

    res.json({
      success: true,
      data: updatedPlan,
      message: `已延期 ${delayDays} 天，${overdueItems.length} 个逾期项目已标记为跳过`,
    });
  } catch (err) { next(err); }
});

// Soft delete plan
planRouter.delete('/:id', async (req, res, next) => {
  try {
    const plan = await prisma.learningPlan.findFirst({ where: { id: req.params.id, userId: req.user!.userId } });
    if (!plan) throw new AppError('Plan not found', 404);

    await prisma.learningPlan.update({
      where: { id: req.params.id },
      data: { status: 'paused' },
    });
    res.json({ success: true, message: 'Plan archived' });
  } catch (err) { next(err); }
});
