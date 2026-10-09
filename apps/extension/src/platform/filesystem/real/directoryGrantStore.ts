export type StoredDirectoryGrant<T> = { schemaVersion: 1; id: string; createdAt: number; handle: T }

const DATABASE_NAME = 'unas-file-workspace-v1'
const STORE_NAME = 'directory-grants'
// Preserve the existing storage key so previously selected directories still restore.
const RECORD_KEY = 'active-read-directory'

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onerror = () => reject(request.error ?? new Error('无法打开目录授权存储。'))
    request.onsuccess = () => resolve(request.result)
  })
}

export async function readStoredGrant<T>(): Promise<StoredDirectoryGrant<T> | undefined> {
  const database = await openDatabase()
  try {
    return await new Promise<StoredDirectoryGrant<T> | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(RECORD_KEY)
      request.onerror = () => reject(request.error ?? new Error('无法读取目录授权。'))
      request.onsuccess = () => resolve(request.result as StoredDirectoryGrant<T> | undefined)
    })
  } finally { database.close() }
}

export async function writeStoredGrant<T>(grant: StoredDirectoryGrant<T>) {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(grant, RECORD_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('无法保存目录授权。'))
      transaction.onabort = () => reject(transaction.error ?? new Error('保存目录授权已中止。'))
    })
  } finally { database.close() }
}

export async function removeStoredGrant() {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(RECORD_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('无法清除目录授权。'))
      transaction.onabort = () => reject(transaction.error ?? new Error('清除目录授权已中止。'))
    })
  } finally { database.close() }
}
