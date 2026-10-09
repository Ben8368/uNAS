import { describe, it, expect } from 'vitest'
import {
  MAX_MESSAGE_BYTES,
  validSnapshot,
  validEntry,
  validListing,
  validMessage,
  type ProjectionMessage,
} from './protocol'

describe('protocol validation', () => {
  describe('validSnapshot', () => {
    it('accepts valid idle snapshot', () => {
      expect(validSnapshot({ status: 'idle', message: 'test' })).toBe(true)
    })

    it('accepts valid ready snapshot with all fields', () => {
      expect(
        validSnapshot({
          status: 'ready',
          grantId: 'grant-123',
          displayName: 'Test Dir',
          message: 'Ready',
          writeAccess: 'granted',
        }),
      ).toBe(true)
    })

    it('rejects invalid status', () => {
      expect(validSnapshot({ status: 'invalid', message: 'test' })).toBe(false)
    })

    it('rejects non-string grantId', () => {
      expect(validSnapshot({ status: 'ready', grantId: 123 })).toBe(false)
    })

    it('rejects string longer than 4096 chars', () => {
      const longString = 'x'.repeat(4097)
      expect(validSnapshot({ status: 'ready', message: longString })).toBe(false)
    })

    it('rejects invalid writeAccess', () => {
      expect(validSnapshot({ status: 'ready', writeAccess: 'invalid' })).toBe(false)
    })
  })

  describe('validEntry', () => {
    it('accepts valid file entry', () => {
      expect(
        validEntry({
          executionSource: 'real',
          name: 'file.txt',
          path: '/dir/file.txt',
          size: 1024,
          modified: '2026-10-09T00:00:00Z',
          type: 'file',
          extension: 'txt',
        }),
      ).toBe(true)
    })

    it('accepts valid directory entry', () => {
      expect(
        validEntry({
          executionSource: 'real',
          name: 'dir',
          path: '/dir',
          size: 0,
          modified: '2026-10-09T00:00:00Z',
          type: 'directory',
        }),
      ).toBe(true)
    })

    it('rejects non-real executionSource', () => {
      expect(
        validEntry({
          executionSource: 'demo',
          name: 'file.txt',
          path: '/file.txt',
          size: 1024,
          modified: '2026-10-09T00:00:00Z',
          type: 'file',
        }),
      ).toBe(false)
    })

    it('rejects invalid type', () => {
      expect(
        validEntry({
          executionSource: 'real',
          name: 'file.txt',
          path: '/file.txt',
          size: 1024,
          modified: '2026-10-09T00:00:00Z',
          type: 'link',
        }),
      ).toBe(false)
    })
  })

  describe('validListing', () => {
    it('accepts valid listing', () => {
      expect(
        validListing({
          ok: true,
          executionSource: 'real',
          path: '/',
          displayPath: 'Root',
          truncated: false,
          directories: [],
          files: [],
        }),
      ).toBe(true)
    })

    it('rejects listing with too many directories', () => {
      const manyDirs = Array.from({ length: 201 }, (_, i) => ({
        executionSource: 'real',
        name: `dir${i}`,
        path: `/dir${i}`,
        size: 0,
        modified: '2026-10-09T00:00:00Z',
        type: 'directory',
      }))
      expect(
        validListing({
          ok: true,
          executionSource: 'real',
          path: '/',
          displayPath: 'Root',
          truncated: false,
          directories: manyDirs,
          files: [],
        }),
      ).toBe(false)
    })

    it('rejects listing with invalid entry', () => {
      expect(
        validListing({
          ok: true,
          executionSource: 'real',
          path: '/',
          displayPath: 'Root',
          truncated: false,
          directories: [],
          files: [{ invalid: true }],
        }),
      ).toBe(false)
    })

    it('rejects listing with ok: false', () => {
      expect(
        validListing({
          ok: false,
          executionSource: 'real',
          path: '/',
          displayPath: 'Root',
          truncated: false,
          directories: [],
          files: [],
        }),
      ).toBe(false)
    })
  })

  describe('validMessage', () => {
    it('accepts valid snapshot-request', () => {
      expect(
        validMessage({
          version: 1,
          type: 'snapshot-request',
          sender: 'sender-123',
          id: 'req-1',
        }),
      ).toBe(true)
    })

    it('accepts valid list-request without path', () => {
      expect(
        validMessage({
          version: 1,
          type: 'list-request',
          sender: 'sender-123',
          id: 'req-2',
        }),
      ).toBe(true)
    })

    it('accepts valid list-request with path', () => {
      expect(
        validMessage({
          version: 1,
          type: 'list-request',
          sender: 'sender-123',
          id: 'req-3',
          path: '/some/path',
        }),
      ).toBe(true)
    })

    it('accepts valid snapshot without target', () => {
      expect(
        validMessage({
          version: 1,
          type: 'snapshot',
          sender: 'sender-123',
          snapshot: { status: 'idle', message: 'test' },
        }),
      ).toBe(true)
    })

    it('accepts valid snapshot with target', () => {
      expect(
        validMessage({
          version: 1,
          type: 'snapshot',
          sender: 'sender-123',
          target: 'client-456',
          snapshot: { status: 'ready', message: 'test' },
        }),
      ).toBe(true)
    })

    it('accepts valid list-result with listing', () => {
      expect(
        validMessage({
          version: 1,
          type: 'list-result',
          sender: 'sender-123',
          target: 'client-456',
          id: 'req-4',
          listing: {
            ok: true,
            executionSource: 'real',
            path: '/',
            displayPath: 'Root',
            truncated: false,
            directories: [],
            files: [],
          },
        }),
      ).toBe(true)
    })

    it('accepts valid list-result with error', () => {
      expect(
        validMessage({
          version: 1,
          type: 'list-result',
          sender: 'sender-123',
          target: 'client-456',
          id: 'req-5',
          error: 'Failed to read directory',
        }),
      ).toBe(true)
    })

    it('rejects message without version', () => {
      expect(
        validMessage({
          type: 'snapshot-request',
          sender: 'sender-123',
          id: 'req-6',
        }),
      ).toBe(false)
    })

    it('rejects message with wrong version', () => {
      expect(
        validMessage({
          version: 2,
          type: 'snapshot-request',
          sender: 'sender-123',
          id: 'req-7',
        }),
      ).toBe(false)
    })

    it('rejects message without sender', () => {
      expect(
        validMessage({
          version: 1,
          type: 'snapshot-request',
          id: 'req-8',
        }),
      ).toBe(false)
    })

    it('rejects message with empty sender', () => {
      expect(
        validMessage({
          version: 1,
          type: 'snapshot-request',
          sender: '',
          id: 'req-9',
        }),
      ).toBe(false)
    })

    it('rejects snapshot-request with extra keys', () => {
      expect(
        validMessage({
          version: 1,
          type: 'snapshot-request',
          sender: 'sender-123',
          id: 'req-10',
          extra: 'field',
        }),
      ).toBe(false)
    })

    it('rejects list-request with unexpected extra keys', () => {
      expect(
        validMessage({
          version: 1,
          type: 'list-request',
          sender: 'sender-123',
          id: 'req-11',
          unexpected: 'field',
        }),
      ).toBe(false)
    })

    it('rejects message exceeding size budget', () => {
      const largeSnapshot = {
        status: 'ready' as const,
        message: 'x'.repeat(MAX_MESSAGE_BYTES),
      }
      expect(
        validMessage({
          version: 1,
          type: 'snapshot',
          sender: 'sender-123',
          snapshot: largeSnapshot,
        }),
      ).toBe(false)
    })

    it('rejects snapshot with invalid snapshot object', () => {
      expect(
        validMessage({
          version: 1,
          type: 'snapshot',
          sender: 'sender-123',
          snapshot: { invalid: true },
        }),
      ).toBe(false)
    })

    it('rejects list-result without target', () => {
      expect(
        validMessage({
          version: 1,
          type: 'list-result',
          sender: 'sender-123',
          id: 'req-12',
          listing: {
            ok: true,
            executionSource: 'real',
            path: '/',
            displayPath: 'Root',
            truncated: false,
            directories: [],
            files: [],
          },
        }),
      ).toBe(false)
    })

    it('rejects list-result without id', () => {
      expect(
        validMessage({
          version: 1,
          type: 'list-result',
          sender: 'sender-123',
          target: 'client-456',
          listing: {
            ok: true,
            executionSource: 'real',
            path: '/',
            displayPath: 'Root',
            truncated: false,
            directories: [],
            files: [],
          },
        }),
      ).toBe(false)
    })
  })
})
