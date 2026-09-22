const DB_NAME = 'pogo-showdown';
const DB_VERSION = 4; // 3: added pogs + battleLog; 4: added realm (Forever Realm world saves)

export const STORES = ['profile', 'standings', 'matchLog', 'season', 'loadout', 'pogs', 'battleLog', 'realm'] as const;
export type StoreName = (typeof STORES)[number];

type Row = { id: string };

/**
 * Local-only persistence, entirely on-device via IndexedDB - no network
 * calls, no accounts. Falls back to an in-memory store if IndexedDB is
 * unavailable (e.g. a locked-down webview), so the game still runs,
 * just without cross-session persistence in that case.
 */
const memoryFallback: Map<StoreName, Map<string, Row>> = new Map(STORES.map((s) => [s, new Map()]));
let useMemoryFallback = false;

function hasIndexedDB(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      useMemoryFallback = true;
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      useMemoryFallback = true;
      reject(req.error);
    };
  });
  return dbPromise;
}

export async function dbGet<T extends Row>(store: StoreName, id: string): Promise<T | undefined> {
  if (useMemoryFallback) return memoryFallback.get(store)?.get(id) as T | undefined;
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return memoryFallback.get(store)?.get(id) as T | undefined;
  }
}

export async function dbGetAll<T extends Row>(store: StoreName): Promise<T[]> {
  if (useMemoryFallback) return [...(memoryFallback.get(store)?.values() ?? [])] as T[];
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [...(memoryFallback.get(store)?.values() ?? [])] as T[];
  }
}

export async function dbPut<T extends Row>(store: StoreName, value: T): Promise<void> {
  memoryFallback.get(store)?.set(value.id, value);
  if (useMemoryFallback) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // already written to memoryFallback above
  }
}

export async function dbPutMany<T extends Row>(store: StoreName, values: T[]): Promise<void> {
  for (const v of values) memoryFallback.get(store)?.set(v.id, v);
  if (useMemoryFallback) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      for (const v of values) os.put(v);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // already written to memoryFallback above
  }
}

export async function dbDelete(store: StoreName, id: string): Promise<void> {
  memoryFallback.get(store)?.delete(id);
  if (useMemoryFallback) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // already removed from memoryFallback above
  }
}
