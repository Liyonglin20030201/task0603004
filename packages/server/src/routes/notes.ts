import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

export const noteRouter = Router();
noteRouter.use(authenticate);

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional().default(''),
  courseId: z.string().uuid().optional(),
  planItemId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional().default([]),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

noteRouter.get('/', async (req, res, next) => {
  try {
    const { courseId, tag, search, page = '1', pageSize = '20' } = req.query;
    const where: any = { userId: req.user!.userId };
    if (courseId) where.courseId = courseId;
    if (tag) where.tags = { has: tag as string };
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { content: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      prisma.note.findMany({
        where, skip, take: Number(pageSize),
        orderBy: { updatedAt: 'desc' },
        include: { course: { select: { id: true, title: true } } },
      }),
      prisma.note.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    });
  } catch (err) { next(err); }
});

noteRouter.post('/', validate(createSchema), async (req, res, next) => {
  try {
    if (req.body.courseId) {
      const course = await prisma.course.findFirst({ where: { id: req.body.courseId, userId: req.user!.userId } });
      if (!course) throw new AppError('Course not found', 404);
    }

    const note = await prisma.note.create({
      data: { ...req.body, userId: req.user!.userId },
    });
    res.status(201).json({ success: true, data: note });
  } catch (err) { next(err); }
});

noteRouter.get('/:id', async (req, res, next) => {
  try {
    const note = await prisma.note.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: { course: { select: { id: true, title: true } } },
    });
    if (!note) throw new AppError('Note not found', 404);
    res.json({ success: true, data: note });
  } catch (err) { next(err); }
});

noteRouter.put('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.note.findFirst({ where: { id: req.params.id, userId: req.user!.userId } });
    if (!existing) throw new AppError('Note not found', 404);

    const updated = await prisma.note.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

noteRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.note.findFirst({ where: { id: req.params.id, userId: req.user!.userId } });
    if (!existing) throw new AppError('Note not found', 404);

    await prisma.note.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});
