import { describe, expect, it, vi } from 'vitest'
import { formatMediaTime, getDecodeHints, MAX_SUBTITLE_BYTES, subtitlesToVtt } from 'unas-src/apps/real/media/playerHelpers'

describe('media player helpers', () => {
  it('reports browser decode responses as hints without claiming certainty', () => {
    const media = { canPlayType: vi.fn((type: string) => type.startsWith('audio/mpeg') ? 'probably' : '') } as unknown as HTMLMediaElement
    const hints = getDecodeHints(media, 'audio')
    expect(hints[0]).toEqual({ label: 'MP3', support: 'probably' })
    expect(hints.every(hint => ['probably', 'maybe', 'no'].includes(hint.support))).toBe(true)
  })

  it('normalizes SRT timestamps and escapes subtitle markup', () => {
    expect(subtitlesToVtt('1\n00:01:02,3 --> 00:01:04,045\n<b>unsafe & text</b>')).toBe(
      'WEBVTT\n\n00:01:02.300 --> 00:01:04.045\n&lt;b&gt;unsafe &amp; text&lt;/b&gt;\n',
    )
  })

  it('drops malformed cues and ignores VTT metadata blocks', () => {
    expect(subtitlesToVtt('WEBVTT\n\nNOTE metadata\nignore\n\n00:99:00,000 --> 01:00:00,000\ninvalid')).toBe('WEBVTT\n\n')
    expect(MAX_SUBTITLE_BYTES).toBe(2 * 1024 * 1024)
  })

  it('formats media time without showing invalid values', () => {
    expect(formatMediaTime(3723)).toBe('1:02:03')
    expect(formatMediaTime(Number.NaN)).toBe('0:00')
  })
})
