// Minimal IndexedDB key-value store (CryptoKey objects can only be persisted here, not in localStorage).
const DB = 'trip-app'
const STORE = 'kv'

let db: Promise<IDBDatabase> | undefined

function open(): Promise<IDBDatabase> {
  db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return db
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const store = (await open()).transaction(STORE, mode).objectStore(STORE)
  return new Promise((resolve, reject) => {
    const req = fn(store)
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  })
}

export const idbGet = <T>(key: string) => run<T | undefined>('readonly', (s) => s.get(key))
export const idbSet = (key: string, value: unknown) => run<void>('readwrite', (s) => s.put(value, key))
export const idbDel = (key: string) => run<void>('readwrite', (s) => s.delete(key))
