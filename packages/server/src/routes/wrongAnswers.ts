import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

export const wrongAnswerRouter = Router();
wrongAnswerRouter.use(authenticate);

// --- SM-2 Spaced Repetition Algorithm ---
// Uses reviewCount to track the current interval step.
// Intervals follow a simplified SM-2 schedule: [1, 3, 7, 14, 30, 60, 120] days.
// If quality < 3 (incorrect/hard), reviewCount resets to 0 and interval becomes 1 day.
// An item is considered "mastered" when reviewCount >= 5 (interval >= 30 days).

const SM2_INTERVALS = [1, 3, 7, 14, 30, 60, 120];

function calculateNextReview(reviewCount: number, quality: number): { newReviewCount: number; nextReviewDate: Date } {
  let newReviewCount: number;

  if (quality < 3) {
    // Incorrect or very hard - reset to beginning
    newReviewCount = 0;
  } else {
    // Correct - advance to next interval
    newReviewCount = reviewCount + 1;
  }

  const intervalIndex = Math.min(newReviewCount, SM2_INTERVALS.length - 1);
  const intervalDays = SM2_INTERVALS[intervalIndex];

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);
  nextReviewDate.setHours(0, 0, 0, 0);

  return { newReviewCount, nextReviewDate };
}

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

const reviewSchema = z.object({
  quality: z.number().int().min(0).max(5),
});

// GET /api/wrong-answers - list all wrong answers with pagination
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

// GET /api/wrong-answers/due - items due for review today (includes overdue)
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

// GET /api/wrong-answers/stats - review statistics
wrongAnswerRouter.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user!.userId;

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [total, dueToday, mastered, learning] = await Promise.all([
      // Total wrong answers
      prisma.wrongAnswer.count({ where: { userId } }),
      // Due today (nextReviewDate <= end of today)
      prisma.wrongAnswer.count({
        where: {
          userId,
          nextReviewDate: { lte: today },
        },
      }),
      // Mastered (reviewCount >= 5, meaning interval is 30+ days)
      prisma.wrongAnswer.count({
        where: {
          userId,
          reviewCount: { gte: 5 },
        },
      }),
      // Learning (reviewCount between 1 and 4)
      prisma.wrongAnswer.count({
        where: {
          userId,
          reviewCount: { gte: 1, lt: 5 },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        dueToday,
        mastered,
        learning,
        newItems: total - mastered - learning, // items with reviewCount = 0
      },
    });
  } catch (err) { next(err); }
});

// POST /api/wrong-answers/:id/review - log a review with SM-2 quality rating
wrongAnswerRouter.post('/:id/review', validate(reviewSchema), async (req, res, next) => {
  try {
    const existing = await prisma.wrongAnswer.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!existing) throw new AppError('Wrong answer not found', 404);

    const { quality } = req.body;
    const { newReviewCount, nextReviewDate } = calculateNextReview(existing.reviewCount, quality);

    const updated = await prisma.wrongAnswer.update({
      where: { id: req.params.id },
      data: {
        reviewCount: newReviewCount,
        nextReviewDate,
      },
      include: { course: { select: { id: true, title: true } } },
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// POST /api/wrong-answers - create a new wrong answer
wrongAnswerRouter.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const course = await prisma.course.findFirst({ where: { id: req.body.courseId, userId: req.user!.userId } });
    if (!course) throw new AppError('Course not found', 404);

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 1);
    nextReview.setHours(0, 0, 0, 0);

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

// PUT /api/wrong-answers/:id - update a wrong answer
wrongAnswerRouter.put('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.wrongAnswer.findFirst({ where: { id: req.params.id, userId: req.user!.userId } });
    if (!existing) throw new AppError('Wrong answer not found', 404);

    const data: any = { ...req.body };
    if (data.nextReviewDate) data.nextReviewDate = new Date(data.nextReviewDate);

    if (data.reviewCount !== undefined && data.reviewCount > existing.reviewCount) {
      const idx = Math.min(data.reviewCount - 1, SM2_INTERVALS.length - 1);
      const next = new Date();
      next.setDate(next.getDate() + SM2_INTERVALS[idx]);
      next.setHours(0, 0, 0, 0);
      data.nextReviewDate = next;
    }

    const updated = await prisma.wrongAnswer.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// DELETE /api/wrong-answers/:id - delete a wrong answer
wrongAnswerRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.wrongAnswer.findFirst({ where: { id: req.params.id, userId: req.user!.userId } });
    if (!existing) throw new AppError('Wrong answer not found', 404);

    await prisma.wrongAnswer.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});
