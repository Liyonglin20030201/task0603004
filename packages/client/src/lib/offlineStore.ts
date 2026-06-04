import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'study-platform-offline';
const DB_VERSION = 1;

export interface SyncQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  entityType: 'note' | 'checkin' | 'wrong_answer';
  entityId?: string;
  payload: Record<string, any>;
  timestamp: number;
}

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('checkins')) {
        db.createObjectStore('checkins', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('wrongAnswers')) {
        db.createObjectStore('wrongAnswers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('syncMeta')) {
        db.createObjectStore('syncMeta', { keyPath: 'key' });
      }
    },
  });
}

export async function saveToOfflineStore(storeName: string, data: any): Promise<void> {
  const db = await getDB();
  await db.put(storeName, data);
}

export async function getFromOfflineStore(storeName: string, id: string): Promise<any> {
  const db = await getDB();
  return db.get(storeName, id);
}

export async function getAllFromOfflineStore(storeName: string): Promise<any[]> {
  const db = await getDB();
  return db.getAll(storeName);
}

export async function deleteFromOfflineStore(storeName: string, id: string): Promise<void> {
  const db = await getDB();
  await db.delete(storeName, id);
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<void> {
  const db = await getDB();
  await db.add('syncQueue', { ...item, id: crypto.randomUUID() });
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAll('syncQueue');
}

export async function clearSyncQueue(): Promise<void> {
  const db = await getDB();
  await db.clear('syncQueue');
}

export async function getLastSyncTime(): Promise<number> {
  const db = await getDB();
  const meta = await db.get('syncMeta', 'lastSync');
  return meta?.value || 0;
}

export async function setLastSyncTime(timestamp: number): Promise<void> {
  const db = await getDB();
  await db.put('syncMeta', { key: 'lastSync', value: timestamp });
}

export async function bulkSaveToOfflineStore(storeName: string, items: any[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  for (const item of items) {
    await tx.store.put(item);
  }
  await tx.done;
}
