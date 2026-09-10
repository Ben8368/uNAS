import { describe, expect, it } from 'vitest'
import { isDirectDownloadUrl, isMediaPlaylistUrl } from './browserDownloads'

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
})
