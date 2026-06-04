import { Router } from 'express';
import { prisma } from '../app';
import { authenticate } from '../middleware/auth';
import { processSyncPush, getChangesSince } from '../lib/syncEngine';

export const syncRouter = Router();
syncRouter.use(authenticate);

syncRouter.post('/push', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { deviceId, items } = req.body;

    if (!deviceId || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: '缺少 deviceId 或 items' });
    }

    const results = await processSyncPush(prisma, userId, deviceId, items);

    const hasConflicts = results.some(r => r.status === 'conflict');

    res.json({
      success: true,
      data: {
        results,
        hasConflicts,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (err) { next(err); }
});

syncRouter.get('/pull', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { since } = req.query;

    const sinceDate = since ? new Date(since as string) : new Date(0);
    const changes = await getChangesSince(prisma, userId, sinceDate);

    res.json({
      success: true,
      data: {
        ...changes,
        serverTime: new Date().toISOString(),
      },
    });
  } catch (err) { next(err); }
});

syncRouter.post('/resolve-conflict', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { entityType, entityId, resolution, payload } = req.body;

    if (resolution === 'client') {
      // Use client version - force update
      if (entityType === 'note') {
        const existing = await prisma.note.findFirst({ where: { id: entityId, userId } });
        if (existing) {
          await prisma.note.update({
            where: { id: entityId },
            data: { ...payload, version: existing.version + 1 },
          });
        }
      } else if (entityType === 'wrong_answer') {
        const existing = await prisma.wrongAnswer.findFirst({ where: { id: entityId, userId } });
        if (existing) {
          await prisma.wrongAnswer.update({
            where: { id: entityId },
            data: { ...payload, version: existing.version + 1 },
          });
        }
      }
    }
    // resolution === 'server' means keep server version, nothing to do

    // Log conflict resolution
    await prisma.syncLog.create({
      data: {
        userId,
        deviceId: req.body.deviceId || 'unknown',
        syncType: 'conflict_resolved',
        entityType,
        entityId,
        payload: { resolution },
      },
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

syncRouter.get('/status', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { deviceId } = req.query;

    const lastSync = await prisma.syncLog.findFirst({
      where: { userId, deviceId: deviceId as string },
      orderBy: { syncedAt: 'desc' },
    });

    const pendingConflicts = await prisma.offlineQueue.count({
      where: { userId, status: 'conflict' },
    });

    res.json({
      success: true,
      data: {
        lastSyncAt: lastSync?.syncedAt || null,
        pendingConflicts,
      },
    });
  } catch (err) { next(err); }
});
