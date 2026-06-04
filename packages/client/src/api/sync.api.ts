import apiClient from './client';
import { ApiResponse, SyncPushItem, SyncResult, SyncPullResponse } from '@study-platform/shared';

export async function syncPush(deviceId: string, items: SyncPushItem[]) {
  const res = await apiClient.post<ApiResponse<{ results: SyncResult[]; hasConflicts: boolean; syncedAt: string }>>('/sync/push', { deviceId, items });
  return res.data.data!;
}

export async function syncPull(since?: string) {
  const res = await apiClient.get<ApiResponse<SyncPullResponse>>('/sync/pull', { params: { since } });
  return res.data.data!;
}

export async function resolveConflict(entityType: string, entityId: string, resolution: 'client' | 'server', payload?: any, deviceId?: string) {
  await apiClient.post('/sync/resolve-conflict', { entityType, entityId, resolution, payload, deviceId });
}

export async function getSyncStatus(deviceId: string) {
  const res = await apiClient.get<ApiResponse<{ lastSyncAt: string | null; pendingConflicts: number }>>('/sync/status', { params: { deviceId } });
  return res.data.data!;
}
