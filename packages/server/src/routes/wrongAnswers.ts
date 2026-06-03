import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

export const wrongAnswerRouter = Router();
wrongAnswerRouter.use(authenticate);

const createSchema = z.object({
  courseId: z.string().uuid(),
  question: z.string().min(1),
  wrongAnswer: z.string().min(1),
  correctAnswer: z.string().min(1),
  explanation: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
});

const updateSchema = z.object({
  question: z.string().min(1).optional(),
  wrongAnswer: z.string().min(1).optional(),
  correctAnswer: z.string().min(1).optional(),
  explanation: z.string().optional(),
  tags: z.array(z.string()).optional(),
  reviewCount: z.number().int().optional(),
  nextReviewDate: z.string().optional(),
});

wrongAnswerRouter.get('/', async (req, res, next) => {
  try {
    const { courseId, tag, page = '1', pageSize = '20' } = req.query;
    const where: any = { userId: req.user!.userId };
    if (courseId) where.courseId = courseId;
    if (tag) where.tags = { has: tag as string };

    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      prisma.wrongAnswer.findMany({
        where, skip, take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        include: { course: { select: { id: true, title: true } } },
      }),
      prisma.wrongAnswer.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    });
  } catch (err) { next(err); }
});

wrongAnswerRouter.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const course = await prisma.course.findFirst({ where: { id: req.body.courseId, userId: req.user!.userId } });
    if (!course) throw new AppError('Course not found', 404);

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 1);

    const wrongAnswer = await prisma.wrongAnswer.create({
      data: {
        ...req.body,
        userId: req.user!.userId,
        nextReviewDate: nextReview,
      },
    });
    res.status(201).json({ success: true, data: wrongAnswer });
  } catch (err) { next(err); }
});

wrongAnswerRouter.put('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.wrongAnswer.findFirst({ where: { id: req.params.id, userId: req.user!.userId } });
    if (!existing) throw new AppError('Wrong answer not found', 404);

    const data: any = { ...req.body };
    if (data.nextReviewDate) data.nextReviewDate = new Date(data.nextReviewDate);

    if (data.reviewCount !== undefined && data.reviewCount > existing.reviewCount) {
      const intervals = [1, 3, 7, 14, 30, 60];
      const idx = Math.min(data.reviewCount - 1, intervals.length - 1);
      const next = new Date();
      next.setDate(next.getDate() + intervals[idx]);
      data.nextReviewDate = next;
    }

    const updated = await prisma.wrongAnswer.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

wrongAnswerRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.wrongAnswer.findFirst({ where: { id: req.params.id, userId: req.user!.userId } });
    if (!existing) throw new AppError('Wrong answer not found', 404);

    await prisma.wrongAnswer.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

wrongAnswerRouter.get('/due', async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const items = await prisma.wrongAnswer.findMany({
      where: {
        userId: req.user!.userId,
        nextReviewDate: { lte: today },
      },
      include: { course: { select: { id: true, title: true } } },
      orderBy: { nextReviewDate: 'asc' },
    });

    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});
