/** 아주 작은 IndexedDB 저장소 (사진 올리기 실패 때 입력 내용을 기기에 임시 저장, 10.1·7.3) */
const DB = "telos";
const STORE = "kv";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    return await run<T | undefined>("readonly", (s) => s.get(key));
  } catch {
    return undefined;
  }
}
export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    await run("readwrite", (s) => s.put(value, key));
  } catch {
    // 저장하지 못해도 화면의 입력은 남아 있다
  }
}
export async function idbDelete(key: string): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(key));
  } catch {
    // 무시
  }
}
