import { describe, expect, it, vi } from 'vitest'
import { isDirectDownloadUrl, isMediaPlaylistUrl, startBrowserDownload } from './browserDownloads'

describe('browser download route', () => {
  it('accepts direct files and rejects pages or playlists', () => {
    expect(isDirectDownloadUrl('https://cdn.example.test/video.mp4?token=1')).toBe(true)
    expect(isDirectDownloadUrl('https://cdn.example.test/QQPCDownload320005.exe')).toBe(true)
    expect(isDirectDownloadUrl('https://cdn.example.test/archive.zip')).toBe(true)
    expect(isDirectDownloadUrl('https://example.test/watch/video')).toBe(false)
    expect(isDirectDownloadUrl('https://cdn.example.test/stream.m3u8')).toBe(false)
    expect(isDirectDownloadUrl('https://cdn.example.test/manifest.mpd')).toBe(false)
    expect(isDirectDownloadUrl('http://cdn.example.test/video.mp4')).toBe(false)
    expect(isDirectDownloadUrl('http://127.0.0.1:8080/video.mp4')).toBe(true)
    expect(isMediaPlaylistUrl('https://cdn.example.test/stream.m3u8?token=1')).toBe(true)
    expect(isMediaPlaylistUrl('https://cdn.example.test/video.mp4')).toBe(false)
  })

  it('keeps a started but untracked download distinct from a failed start', async () => {
    const warning = 'Chrome 已启动下载（ID 42），但 uNAS 未能保存记录。'
    vi.stubGlobal('browser', { runtime: { id: 'unas', sendMessage: async () => ({ ok: true, downloadId: 42, trackingWarning: warning }) } })
    try {
      await expect(startBrowserDownload('https://example.test/file.zip')).resolves.toEqual({ downloadId: 42, tracked: false, warning })
    } finally { vi.unstubAllGlobals() }
  })
})
