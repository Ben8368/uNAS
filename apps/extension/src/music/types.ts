export const MUSIC_LIMITS = Object.freeze({
  maxInputBytes: 128 * 1024 * 1024,
  maxOutputBytes: 128 * 1024 * 1024,
  maxSectionBytes: 16 * 1024 * 1024,
  maxFooterBytes: 64 * 1024,
  workerChunkBytes: 1024 * 1024,
  maxKeyBytes: 16 * 1024 * 1024,
})

export type MusicFormat = 'kgm-v3' | 'ncm' | 'qmc'
export type MusicOutputFormat = 'flac' | 'mp3' | 'ogg' | 'wav' | 'unknown'

export type MusicWorkerRequest =
  | { type: 'decrypt'; id: string; file: File }
  | { type: 'cancel'; id: string }
  | { type: 'ack'; id: string }

export type MusicWorkerMessage =
  | { type: 'started'; id: string; format: MusicFormat; outputFormat: MusicOutputFormat; inputBytes: number; audioBytes: number; cipher?: string }
  | { type: 'chunk'; id: string; buffer: ArrayBuffer; bytes: number }
  | { type: 'complete'; id: string; outputBytes: number; outputFormat: Exclude<MusicOutputFormat, 'unknown'> }
  | { type: 'error'; id: string; code: string; message: string }

export type MusicCapability = {
  supported: boolean
  reasons: string[]
  limits: {
    maxInputBytes: number
    maxOutputBytes: number
    workerChunkBytes: number
    opfsStaging: boolean
  }
}

export type MusicDecryptResult = {
  format: MusicFormat
  outputFormat: Exclude<MusicOutputFormat, 'unknown'>
  inputBytes: number
  outputBytes: number
  outputFile: File
}
