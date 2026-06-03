import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

export const courseRouter = Router();
courseRouter.use(authenticate);

const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(50),
  description: z.string().optional().default(''),
});

const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
});

// List courses with filters
courseRouter.get('/', async (req, res, next) => {
  try {
    const { status, category, page = '1', pageSize = '20' } = req.query;
    const where: any = { userId: req.user!.userId };
    if (status) where.status = status;
    if (category) where.category = category;

    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      prisma.course.findMany({ where, skip, take: Number(pageSize), orderBy: { createdAt: 'desc' } }),
      prisma.course.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    });
  } catch (err) { next(err); }
});

// Create course
courseRouter.post('/', validate(createCourseSchema), async (req, res, next) => {
  try {
    const course = await prisma.course.create({
      data: { ...req.body, userId: req.user!.userId },
    });
    res.status(201).json({ success: true, data: course });
  } catch (err) { next(err); }
});

// Get course detail with progress
courseRouter.get('/:id', async (req, res, next) => {
  try {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        learningPlans: { include: { items: true } },
      },
    });
    if (!course) throw new AppError('Course not found', 404);

    const totalItems = course.learningPlans.reduce((sum, p) => sum + p.items.length, 0);
    const completedItems = course.learningPlans.reduce(
      (sum, p) => sum + p.items.filter(i => i.status === 'completed').length, 0
    );

    res.json({
      success: true,
      data: {
        ...course,
        progress: { totalItems, completedItems, completionRate: totalItems > 0 ? completedItems / totalItems : 0 },
      },
    });
  } catch (err) { next(err); }
});

// Update course
courseRouter.put('/:id', validate(updateCourseSchema), async (req, res, next) => {
  try {
    const course = await prisma.course.findFirst({ where: { id: req.params.id, userId: req.user!.userId } });
    if (!course) throw new AppError('Course not found', 404);

    const updated = await prisma.course.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// Archive course (preserve history)
courseRouter.put('/:id/archive', async (req, res, next) => {
  try {
    const course = await prisma.course.findFirst({ where: { id: req.params.id, userId: req.user!.userId } });
    if (!course) throw new AppError('Course not found', 404);

    const updated = await prisma.course.update({
      where: { id: req.params.id },
      data: { status: 'archived' },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// Course-specific statistics
courseRouter.get('/:id/stats', async (req, res, next) => {
  try {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        learningPlans: { include: { items: { include: { checkIns: true } } } },
        wrongAnswers: true,
        notes: true,
      },
    });
    if (!course) throw new AppError('Course not found', 404);

    const totalItems = course.learningPlans.reduce((sum, p) => sum + p.items.length, 0);
    const completedItems = course.learningPlans.reduce(
      (sum, p) => sum + p.items.filter(i => i.status === 'completed').length, 0
    );
    const totalStudyMinutes = course.learningPlans.reduce(
      (sum, p) => sum + p.items.reduce(
        (s, i) => s + i.checkIns.reduce((m, c) => m + (c.durationMinutes || 0), 0), 0
      ), 0
    );

    res.json({
      success: true,
      data: {
        totalPlans: course.learningPlans.length,
        totalItems,
        completedItems,
        completionRate: totalItems > 0 ? completedItems / totalItems : 0,
        totalStudyMinutes,
        wrongAnswerCount: course.wrongAnswers.length,
        noteCount: course.notes.length,
      },
    });
  } catch (err) { next(err); }
});
