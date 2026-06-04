import { PrismaClient } from '@prisma/client';

interface SyncItem {
  action: 'create' | 'update' | 'delete';
  entityType: 'note' | 'checkin' | 'wrong_answer';
  entityId?: string;
  payload: Record<string, any>;
  clientVersion?: number;
  clientTimestamp: string;
}

interface SyncResult {
  entityId: string;
  status: 'synced' | 'conflict' | 'error';
  serverVersion?: number;
  serverData?: any;
  error?: string;
}

export async function processSyncPush(
  prisma: PrismaClient,
  userId: string,
  deviceId: string,
  items: SyncItem[]
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const item of items) {
    try {
      const result = await processSingleSync(prisma, userId, deviceId, item);
      results.push(result);
    } catch (err: any) {
      results.push({
        entityId: item.entityId || 'unknown',
        status: 'error',
        error: err.message,
      });
    }
  }

  return results;
}

async function processSingleSync(
  prisma: PrismaClient,
  userId: string,
  deviceId: string,
  item: SyncItem
): Promise<SyncResult> {
  const { action, entityType, entityId, payload, clientVersion } = item;

  if (action === 'create') {
    return await handleCreate(prisma, userId, deviceId, entityType, payload);
  }

  if (!entityId) {
    return { entityId: 'unknown', status: 'error', error: 'Missing entityId for update/delete' };
  }

  if (action === 'update') {
    return await handleUpdate(prisma, userId, deviceId, entityType, entityId, payload, clientVersion);
  }

  if (action === 'delete') {
    return await handleDelete(prisma, userId, entityType, entityId);
  }

  return { entityId: entityId || 'unknown', status: 'error', error: 'Unknown action' };
}

async function handleCreate(
  prisma: PrismaClient,
  userId: string,
  deviceId: string,
  entityType: string,
  payload: Record<string, any>
): Promise<SyncResult> {
  let entity: any;

  if (entityType === 'note') {
    entity = await prisma.note.create({
      data: {
        userId,
        title: payload.title || '',
        content: payload.content || '',
        tags: payload.tags || [],
        courseId: payload.courseId || null,
        planItemId: payload.planItemId || null,
      },
    });
  } else if (entityType === 'checkin') {
    entity = await prisma.checkIn.create({
      data: {
        userId,
        planItemId: payload.planItemId,
        checkInDate: new Date(payload.checkInDate),
        durationMinutes: payload.durationMinutes || null,
        note: payload.note || null,
      },
    });
  } else if (entityType === 'wrong_answer') {
    entity = await prisma.wrongAnswer.create({
      data: {
        userId,
        courseId: payload.courseId,
        question: payload.question,
        wrongAnswer: payload.wrongAnswer,
        correctAnswer: payload.correctAnswer,
        explanation: payload.explanation || null,
        tags: payload.tags || [],
      },
    });
  }

  if (entity) {
    await prisma.syncLog.create({
      data: { userId, deviceId, syncType: 'push', entityType, entityId: entity.id, payload },
    });
    return { entityId: entity.id, status: 'synced', serverVersion: 1 };
  }

  return { entityId: 'unknown', status: 'error', error: 'Unsupported entity type' };
}

async function handleUpdate(
  prisma: PrismaClient,
  userId: string,
  deviceId: string,
  entityType: string,
  entityId: string,
  payload: Record<string, any>,
  clientVersion?: number
): Promise<SyncResult> {
  if (entityType === 'note') {
    const existing = await prisma.note.findFirst({ where: { id: entityId, userId } });
    if (!existing) return { entityId, status: 'error', error: 'Not found' };

    if (clientVersion !== undefined && existing.version !== clientVersion) {
      return { entityId, status: 'conflict', serverVersion: existing.version, serverData: existing };
    }

    await prisma.note.update({
      where: { id: entityId },
      data: { ...payload, version: existing.version + 1 },
    });
    return { entityId, status: 'synced', serverVersion: existing.version + 1 };
  }

  if (entityType === 'wrong_answer') {
    const existing = await prisma.wrongAnswer.findFirst({ where: { id: entityId, userId } });
    if (!existing) return { entityId, status: 'error', error: 'Not found' };

    if (clientVersion !== undefined && existing.version !== clientVersion) {
      return { entityId, status: 'conflict', serverVersion: existing.version, serverData: existing };
    }

    await prisma.wrongAnswer.update({
      where: { id: entityId },
      data: { ...payload, version: existing.version + 1 },
    });
    return { entityId, status: 'synced', serverVersion: existing.version + 1 };
  }

  return { entityId, status: 'error', error: 'Unsupported entity type for update' };
}

async function handleDelete(
  prisma: PrismaClient,
  userId: string,
  entityType: string,
  entityId: string
): Promise<SyncResult> {
  if (entityType === 'note') {
    await prisma.note.deleteMany({ where: { id: entityId, userId } });
  } else if (entityType === 'wrong_answer') {
    await prisma.wrongAnswer.deleteMany({ where: { id: entityId, userId } });
  } else {
    return { entityId, status: 'error', error: 'Unsupported entity type for delete' };
  }

  return { entityId, status: 'synced' };
}

export async function getChangesSince(
  prisma: PrismaClient,
  userId: string,
  since: Date
): Promise<{ notes: any[]; checkIns: any[]; wrongAnswers: any[] }> {
  const [notes, checkIns, wrongAnswers] = await Promise.all([
    prisma.note.findMany({ where: { userId, updatedAt: { gt: since } } }),
    prisma.checkIn.findMany({ where: { userId, createdAt: { gt: since } } }),
    prisma.wrongAnswer.findMany({ where: { userId, updatedAt: { gt: since } } }),
  ]);

  return { notes, checkIns, wrongAnswers };
}
