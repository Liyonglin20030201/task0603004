import { syncPush, syncPull } from '../api/sync.api';
import {
  getSyncQueue,
  clearSyncQueue,
  getLastSyncTime,
  setLastSyncTime,
  bulkSaveToOfflineStore,
} from './offlineStore';

let isSyncing = false;

function getDeviceId(): string {
  let deviceId = localStorage.getItem('study_platform_device_id');
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem('study_platform_device_id', deviceId);
  }
  return deviceId;
}

export async function performSync(): Promise<{ pushed: number; pulled: number; conflicts: number }> {
  if (isSyncing) return { pushed: 0, pulled: 0, conflicts: 0 };
  if (!navigator.onLine) return { pushed: 0, pulled: 0, conflicts: 0 };

  isSyncing = true;
  try {
    const deviceId = getDeviceId();
    let pushed = 0;
    let conflicts = 0;

    // Push offline queue
    const queue = await getSyncQueue();
    if (queue.length > 0) {
      const items = queue.map(q => ({
        action: q.action,
        entityType: q.entityType,
        entityId: q.entityId,
        payload: q.payload,
        clientTimestamp: new Date(q.timestamp).toISOString(),
      }));

      const result = await syncPush(deviceId, items);
      pushed = result.results.filter(r => r.status === 'synced').length;
      conflicts = result.results.filter(r => r.status === 'conflict').length;
      await clearSyncQueue();
    }

    // Pull server changes
    const lastSync = await getLastSyncTime();
    const since = lastSync > 0 ? new Date(lastSync).toISOString() : undefined;
    const pullData = await syncPull(since);

    // Store pulled data in IndexedDB
    if (pullData.notes.length > 0) {
      await bulkSaveToOfflineStore('notes', pullData.notes);
    }
    if (pullData.checkIns.length > 0) {
      await bulkSaveToOfflineStore('checkins', pullData.checkIns);
    }
    if (pullData.wrongAnswers.length > 0) {
      await bulkSaveToOfflineStore('wrongAnswers', pullData.wrongAnswers);
    }

    await setLastSyncTime(new Date(pullData.serverTime).getTime());

    const pulled = pullData.notes.length + pullData.checkIns.length + pullData.wrongAnswers.length;
    return { pushed, pulled, conflicts };
  } finally {
    isSyncing = false;
  }
}

export function setupAutoSync() {
  // Sync on reconnect
  window.addEventListener('online', () => {
    performSync().catch(console.error);
  });

  // Periodic sync every 5 minutes when online
  setInterval(() => {
    if (navigator.onLine) {
      performSync().catch(console.error);
    }
  }, 5 * 60 * 1000);

  // Initial sync
  if (navigator.onLine) {
    performSync().catch(console.error);
  }
}
