export const MAX_SUBTITLE_BYTES = 2 * 1024 * 1024

const AUDIO_TYPES = [
  ['audio/mpeg', 'MP3'],
  ['audio/mp4; codecs="mp4a.40.2"', 'AAC'],
  ['audio/aac', 'AAC'],
  ['audio/flac', 'FLAC'],
  ['audio/wav', 'WAV'],
  ['audio/ogg; codecs="vorbis"', 'OGG Vorbis'],
  ['audio/ogg; codecs="opus"', 'OGG Opus'],
] as const

const VIDEO_TYPES = [
  ['video/mp4; codecs="avc1.42E01E, mp4a.40.2"', 'MP4 H.264/AAC'],
  ['video/webm; codecs="vp8, vorbis"', 'WebM VP8/Vorbis'],
  ['video/webm; codecs="vp9, opus"', 'WebM VP9/Opus'],
] as const

export interface DecodeHint {
  label: string
  support: 'probably' | 'maybe' | 'no'
}

/** canPlayType is a browser-reported hint; only a real decode can establish playback. */
export function getDecodeHints(media: HTMLMediaElement, kind: 'audio' | 'video'): DecodeHint[] {
  const types = kind === 'audio' ? AUDIO_TYPES : VIDEO_TYPES
  return types.map(([mime, label]) => {
    const result = media.canPlayType(mime)
    return { label, support: result === 'probably' ? 'probably' : result === 'maybe' ? 'maybe' : 'no' }
  })
}

function escapeCueText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function normalizeTimestamp(value: string): string | undefined {
  const match = value.trim().match(/^(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{1,3})$/)
  if (!match) return undefined
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  const millis = match[4].padEnd(3, '0')
  if (minutes > 59 || seconds > 59) return undefined
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${millis}`
}

/** Convert local SRT/VTT text to a safe, script-free VTT track. */
export function subtitlesToVtt(source: string): string {
  const blocks = source.replace(/^\uFEFF/, '').split(/\r?\n\s*\r?\n/)
  const cues: string[] = []
  for (const block of blocks) {
    const lines = block.split(/\r?\n/)
    if (lines[0]?.trim().startsWith('WEBVTT') || lines[0]?.trim().startsWith('NOTE') || lines[0]?.trim().startsWith('STYLE')) continue
    const timingIndex = lines.findIndex(line => line.includes('-->'))
    if (timingIndex < 0) continue
    const timing = lines[timingIndex].match(/^\s*(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/)
    if (!timing) continue
    const start = normalizeTimestamp(timing[1])
    const end = normalizeTimestamp(timing[2])
    if (!start || !end) continue
    const text = lines.slice(timingIndex + 1).join('\n').trim()
    if (!text) continue
    cues.push(`${start} --> ${end}\n${escapeCueText(text)}`)
  }
  return `WEBVTT\n\n${cues.join('\n\n')}${cues.length ? '\n' : ''}`
}

export function formatMediaTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00'
  const whole = Math.floor(value)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const seconds = whole % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
}
