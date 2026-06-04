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
  status: 'synced' | 'conflict' | 'auto_merged' | 'error';
  serverVersion?: number;
  serverData?: any;
  mergedData?: any;
  mergeStrategy?: string;
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
    return await handleUpdateWithSmartMerge(prisma, userId, deviceId, entityType, entityId, payload, clientVersion, item.clientTimestamp);
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
    // Dedup: check if same user+planItem+date already exists
    const existing = await prisma.checkIn.findFirst({
      where: {
        userId,
        planItemId: payload.planItemId,
        checkInDate: new Date(payload.checkInDate),
      },
    });
    if (existing) {
      // Auto-merge: take the longer duration
      if (payload.durationMinutes && (!existing.durationMinutes || payload.durationMinutes > existing.durationMinutes)) {
        await prisma.checkIn.update({
          where: { id: existing.id },
          data: { durationMinutes: payload.durationMinutes, note: payload.note || existing.note },
        });
      }
      return { entityId: existing.id, status: 'auto_merged', mergeStrategy: '打卡去重：保留较长时长', serverVersion: existing.version };
    }
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

async function handleUpdateWithSmartMerge(
  prisma: PrismaClient,
  userId: string,
  deviceId: string,
  entityType: string,
  entityId: string,
  payload: Record<string, any>,
  clientVersion: number | undefined,
  clientTimestamp: string
): Promise<SyncResult> {
  if (entityType === 'note') {
    const existing = await prisma.note.findFirst({ where: { id: entityId, userId } });
    if (!existing) return { entityId, status: 'error', error: 'Not found' };

    // No version conflict - direct update
    if (clientVersion === undefined || existing.version === clientVersion) {
      await prisma.note.update({
        where: { id: entityId },
        data: { ...payload, version: existing.version + 1 },
      });
      return { entityId, status: 'synced', serverVersion: existing.version + 1 };
    }

    // Version conflict - attempt smart merge
    const mergeResult = smartMergeNote(existing, payload, clientTimestamp);

    if (mergeResult.canAutoMerge) {
      await prisma.note.update({
        where: { id: entityId },
        data: { ...mergeResult.merged, version: existing.version + 1 },
      });
      await prisma.syncLog.create({
        data: { userId, deviceId, syncType: 'conflict_resolved', entityType, entityId, payload: { strategy: mergeResult.strategy } },
      });
      return {
        entityId,
        status: 'auto_merged',
        serverVersion: existing.version + 1,
        mergedData: mergeResult.merged,
        mergeStrategy: mergeResult.strategy,
      };
    }

    // Cannot auto-merge - return conflict
    return { entityId, status: 'conflict', serverVersion: existing.version, serverData: existing };
  }

  if (entityType === 'wrong_answer') {
    const existing = await prisma.wrongAnswer.findFirst({ where: { id: entityId, userId } });
    if (!existing) return { entityId, status: 'error', error: 'Not found' };

    if (clientVersion === undefined || existing.version === clientVersion) {
      await prisma.wrongAnswer.update({
        where: { id: entityId },
        data: { ...payload, version: existing.version + 1 },
      });
      return { entityId, status: 'synced', serverVersion: existing.version + 1 };
    }

    // Smart merge for wrong answers: merge tags, keep higher reviewCount
    const mergeResult = smartMergeWrongAnswer(existing, payload);

    if (mergeResult.canAutoMerge) {
      await prisma.wrongAnswer.update({
        where: { id: entityId },
        data: { ...mergeResult.merged, version: existing.version + 1 },
      });
      await prisma.syncLog.create({
        data: { userId, deviceId, syncType: 'conflict_resolved', entityType, entityId, payload: { strategy: mergeResult.strategy } },
      });
      return {
        entityId,
        status: 'auto_merged',
        serverVersion: existing.version + 1,
        mergedData: mergeResult.merged,
        mergeStrategy: mergeResult.strategy,
      };
    }

    return { entityId, status: 'conflict', serverVersion: existing.version, serverData: existing };
  }

  return { entityId, status: 'error', error: 'Unsupported entity type for update' };
}

interface MergeResult {
  canAutoMerge: boolean;
  merged: Record<string, any>;
  strategy: string;
}

function smartMergeNote(server: any, clientPayload: Record<string, any>, clientTimestamp: string): MergeResult {
  const clientTime = new Date(clientTimestamp).getTime();
  const serverTime = new Date(server.updatedAt).getTime();

  // Case 1: Only title changed on one side, content on the other → merge both
  const titleChanged = clientPayload.title !== undefined && clientPayload.title !== server.title;
  const contentChanged = clientPayload.content !== undefined && clientPayload.content !== server.content;
  const tagsChanged = clientPayload.tags !== undefined && JSON.stringify(clientPayload.tags) !== JSON.stringify(server.tags);

  // If only non-overlapping fields changed, merge them
  if (titleChanged && !contentChanged && !tagsChanged) {
    return {
      canAutoMerge: true,
      merged: { title: clientPayload.title },
      strategy: '仅标题变更，已自动合并',
    };
  }

  if (!titleChanged && !contentChanged && tagsChanged) {
    // Merge tags: union of both
    const serverTags = server.tags || [];
    const clientTags = clientPayload.tags || [];
    const mergedTags = [...new Set([...serverTags, ...clientTags])];
    return {
      canAutoMerge: true,
      merged: { tags: mergedTags },
      strategy: '标签合并：取并集',
    };
  }

  if (!titleChanged && contentChanged && !tagsChanged) {
    // Content conflict - try append strategy if content only got longer
    if (clientPayload.content && server.content &&
        (clientPayload.content.startsWith(server.content) || server.content.startsWith(clientPayload.content))) {
      // One is a prefix of the other - keep the longer one
      const merged = clientPayload.content.length > server.content.length ? clientPayload.content : server.content;
      return {
        canAutoMerge: true,
        merged: { content: merged },
        strategy: '内容追加：保留较长版本',
      };
    }

    // If one side's change is trivial (whitespace only), take the other
    if (clientPayload.content.trim() === server.content.trim()) {
      return {
        canAutoMerge: true,
        merged: { content: server.content },
        strategy: '仅空格差异，已自动合并',
      };
    }

    // Last resort: if client edit is more recent, prefer client
    if (clientTime > serverTime) {
      return {
        canAutoMerge: true,
        merged: { content: clientPayload.content },
        strategy: '内容冲突：采用较新修改',
      };
    }
  }

  // Multiple fields changed on both sides - cannot auto-merge
  return { canAutoMerge: false, merged: {}, strategy: '' };
}

function smartMergeWrongAnswer(server: any, clientPayload: Record<string, any>): MergeResult {
  // Wrong answers: almost always safe to merge
  const merged: Record<string, any> = {};
  const strategies: string[] = [];

  // Keep higher review count (represents more progress)
  if (clientPayload.reviewCount !== undefined) {
    merged.reviewCount = Math.max(server.reviewCount, clientPayload.reviewCount);
    if (merged.reviewCount !== server.reviewCount) strategies.push('保留较高复习次数');
  }

  // Keep the later next review date
  if (clientPayload.nextReviewDate !== undefined) {
    const serverDate = server.nextReviewDate ? new Date(server.nextReviewDate).getTime() : 0;
    const clientDate = new Date(clientPayload.nextReviewDate).getTime();
    merged.nextReviewDate = clientDate > serverDate ? clientPayload.nextReviewDate : server.nextReviewDate;
    strategies.push('保留较新复习日期');
  }

  // Tags: union
  if (clientPayload.tags !== undefined) {
    merged.tags = [...new Set([...(server.tags || []), ...(clientPayload.tags || [])])];
    strategies.push('标签取并集');
  }

  // Explanation: keep the longer/more detailed one
  if (clientPayload.explanation !== undefined && clientPayload.explanation !== server.explanation) {
    merged.explanation = (clientPayload.explanation || '').length > (server.explanation || '').length
      ? clientPayload.explanation
      : server.explanation;
    strategies.push('保留更详细解释');
  }

  // Question/answer text: if different, this is a real conflict
  if (clientPayload.question !== undefined && clientPayload.question !== server.question) {
    return { canAutoMerge: false, merged: {}, strategy: '' };
  }
  if (clientPayload.correctAnswer !== undefined && clientPayload.correctAnswer !== server.correctAnswer) {
    return { canAutoMerge: false, merged: {}, strategy: '' };
  }

  return {
    canAutoMerge: true,
    merged,
    strategy: strategies.join('；') || '无冲突字段',
  };
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
