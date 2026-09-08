import { test, expect } from './fixtures'
import { writeFile } from 'node:fs/promises'

const probeName = 'unas-sp02-storage-probe'
const probeFile = 'payload.txt'
const probeValue = 'uNAS SP-02 extension storage probe v1'

type ProbeResult = {
  indexedDb: boolean
  opfs: boolean
  idbValue?: string
  opfsValue?: string
  usage?: number
  quota?: number
}

async function runStorageProbe(page: import('@playwright/test').Page, action: 'write' | 'read' | 'cleanup'): Promise<ProbeResult> {
  return await page.evaluate(async ({ action, probeName, probeFile, probeValue }) => {
    const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(probeName, 1)
      request.onupgradeneeded = () => request.result.createObjectStore('records')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    const readRecord = async () => {
      const database = await openDatabase()
      try {
        return await new Promise<string | undefined>((resolve, reject) => {
          const request = database.transaction('records', 'readonly').objectStore('records').get('payload')
          request.onerror = () => reject(request.error)
          request.onsuccess = () => resolve(request.result as string | undefined)
        })
      } finally { database.close() }
    }
    const writeRecord = async () => {
      const database = await openDatabase()
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction('records', 'readwrite')
          transaction.objectStore('records').put(probeValue, 'payload')
          transaction.oncomplete = () => resolve()
          transaction.onerror = () => reject(transaction.error)
          transaction.onabort = () => reject(transaction.error)
        })
      } finally { database.close() }
    }
    const deleteDatabase = () => new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(probeName)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('IndexedDB cleanup was blocked.'))
      request.onsuccess = () => resolve()
    })

    const storage = navigator.storage
    const getDirectory = storage.getDirectory?.bind(storage)
    if (!getDirectory) throw new Error('OPFS getDirectory is unavailable in this extension page.')
    const root = await getDirectory()

    if (action === 'write') {
      await writeRecord()
      const directory = await root.getDirectoryHandle(probeName, { create: true })
      const handle = await directory.getFileHandle(probeFile, { create: true })
      const writable = await handle.createWritable()
      await writable.write(probeValue)
      await writable.close()
    }

    if (action === 'cleanup') {
      await deleteDatabase()
      await root.removeEntry(probeName, { recursive: true })
      let absent = false
      try { await root.getDirectoryHandle(probeName) } catch (error) { absent = error instanceof DOMException && error.name === 'NotFoundError' }
      if (!absent) throw new Error('OPFS probe directory remained after cleanup.')
      return { indexedDb: true, opfs: true }
    }

    const directory = await root.getDirectoryHandle(probeName)
    const file = await (await directory.getFileHandle(probeFile)).getFile()
    const estimate = await storage.estimate()
    return {
      indexedDb: true,
      opfs: true,
      idbValue: await readRecord(),
      opfsValue: await file.text(),
      usage: estimate.usage,
      quota: estimate.quota,
    }
  }, { action, probeName, probeFile, probeValue })
}

test('extension page persists a small staged payload in IndexedDB and OPFS, then cleans it up', async ({ extension }, testInfo) => {
  const first = await extension.context.newPage()
  await first.goto('chrome-extension://' + extension.extensionId + '/newtab.html')
  await runStorageProbe(first, 'cleanup').catch(() => undefined)
  await runStorageProbe(first, 'write')
  await first.close()

  const reopened = await extension.context.newPage()
  await reopened.goto('chrome-extension://' + extension.extensionId + '/newtab.html')
  const persisted = await runStorageProbe(reopened, 'read')
  expect(persisted).toMatchObject({ indexedDb: true, opfs: true, idbValue: probeValue, opfsValue: probeValue })
  expect(persisted.quota).toBeGreaterThan(0)
  expect(persisted.usage).toBeGreaterThan(0)
  await runStorageProbe(reopened, 'cleanup')
  expect(extension.errors).toEqual([])
  await writeFile(testInfo.outputPath('storage-probe.json'), JSON.stringify({
    ...persisted,
    probeName,
    payloadBytes: probeValue.length,
    cleanup: 'IndexedDB database and OPFS probe directory explicitly deleted.',
  }, null, 2), 'utf8')
  await testInfo.attach('storage-probe', {
    body: JSON.stringify({ ...persisted, probeName, payloadBytes: probeValue.length, cleanup: 'IndexedDB database and OPFS probe directory explicitly deleted.' }, null, 2),
    contentType: 'application/json',
  })
})
