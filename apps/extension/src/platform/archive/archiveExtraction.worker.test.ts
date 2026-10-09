import { afterEach, expect, it, vi } from 'vitest'
const fixtures = vi.hoisted(() => ({ yielded: 0, close: vi.fn(), getData: vi.fn() }))
vi.mock('@zip.js/zip.js', () => ({
  configure() {}, BlobReader: class {}, BlobWriter: class {},
  ZipReader: class {
    async *getEntriesGenerator() {
      for (let i = 0; i < 1000; i++) { fixtures.yielded++; yield { filename: `file-${i}`, directory: false, uncompressedSize: 1, getData: fixtures.getData } }
    }
    close = fixtures.close
  },
}))
afterEach(() => vi.unstubAllGlobals())
it('stops enumerating at the first entry exceeding the budget without decompressing', async () => {
  let receive!: (event: unknown) => void
  const postMessage = vi.fn()
  vi.stubGlobal('self', { addEventListener: (_name: string, callback: typeof receive) => { receive = callback }, postMessage })
  fixtures.close.mockResolvedValue(undefined)
  await import('./archiveExtraction.worker')
  receive({ data: { type: 'extract', id: 'test', file: new File([], 'test.zip') } })
  await vi.waitFor(() => expect(fixtures.close).toHaveBeenCalledOnce())
  expect(fixtures.yielded).toBe(201)
  expect(fixtures.getData).not.toHaveBeenCalled()
  expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
})
