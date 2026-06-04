import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { upload, UPLOAD_DIR } from '../lib/upload';

export const resourceRouter = Router();
resourceRouter.use(authenticate);

resourceRouter.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('未上传文件', 400);

    const { title, description, courseId, planId, isPublic } = req.body;

    const resource = await prisma.resource.create({
      data: {
        userId: req.user!.userId,
        title: title || req.file.originalname,
        description: description || '',
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        courseId: courseId || null,
        planId: planId || null,
        isPublic: isPublic === 'true',
      },
    });

    res.status(201).json({ success: true, data: resource });
  } catch (err) { next(err); }
});

resourceRouter.get('/', async (req, res, next) => {
  try {
    const { page = '1', pageSize = '20', courseId, planId } = req.query;
    const where: any = { userId: req.user!.userId };
    if (courseId) where.courseId = courseId;
    if (planId) where.planId = planId;

    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      prisma.resource.findMany({
        where, skip, take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        include: { course: { select: { id: true, title: true } }, plan: { select: { id: true, title: true } } },
      }),
      prisma.resource.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    });
  } catch (err) { next(err); }
});

resourceRouter.get('/public', async (req, res, next) => {
  try {
    const { page = '1', pageSize = '20', search } = req.query;
    const where: any = { isPublic: true };
    if (search) where.title = { contains: search, mode: 'insensitive' };

    const skip = (Number(page) - 1) * Number(pageSize);
    const [items, total] = await Promise.all([
      prisma.resource.findMany({
        where, skip, take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, nickname: true } },
          course: { select: { id: true, title: true } },
        },
      }),
      prisma.resource.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    });
  } catch (err) { next(err); }
});

resourceRouter.get('/:id', async (req, res, next) => {
  try {
    const resource = await prisma.resource.findFirst({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, nickname: true } },
        course: { select: { id: true, title: true } },
        plan: { select: { id: true, title: true } },
      },
    });
    if (!resource) throw new AppError('资源不存在', 404);
    if (!resource.isPublic && resource.userId !== req.user!.userId) {
      throw new AppError('无权访问', 403);
    }
    res.json({ success: true, data: resource });
  } catch (err) { next(err); }
});

resourceRouter.get('/:id/download', async (req, res, next) => {
  try {
    const resource = await prisma.resource.findFirst({ where: { id: req.params.id } });
    if (!resource) throw new AppError('资源不存在', 404);
    if (!resource.isPublic && resource.userId !== req.user!.userId) {
      throw new AppError('无权访问', 403);
    }

    if (!fs.existsSync(resource.filePath)) {
      throw new AppError('文件不存在', 404);
    }

    await prisma.resource.update({
      where: { id: resource.id },
      data: { downloads: { increment: 1 } },
    });

    res.download(resource.filePath, resource.fileName);
  } catch (err) { next(err); }
});

resourceRouter.put('/:id', async (req, res, next) => {
  try {
    const resource = await prisma.resource.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!resource) throw new AppError('资源不存在', 404);

    const { title, description, isPublic, courseId, planId } = req.body;
    const updated = await prisma.resource.update({
      where: { id: resource.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic }),
        ...(courseId !== undefined && { courseId: courseId || null }),
        ...(planId !== undefined && { planId: planId || null }),
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

resourceRouter.delete('/:id', async (req, res, next) => {
  try {
    const resource = await prisma.resource.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!resource) throw new AppError('资源不存在', 404);

    if (fs.existsSync(resource.filePath)) {
      fs.unlinkSync(resource.filePath);
    }

    await prisma.resource.delete({ where: { id: resource.id } });
    res.json({ success: true, message: '资源已删除' });
  } catch (err) { next(err); }
});
