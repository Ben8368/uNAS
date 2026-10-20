export const MUSIC_LIMITS = Object.freeze({
  maxInputBytes: 128 * 1024 * 1024,
  maxOutputBytes: 128 * 1024 * 1024,
  maxSectionBytes: 16 * 1024 * 1024,
  maxFooterBytes: 64 * 1024,
  maxMusicExTagBytes: 64 * 1024,
  workerChunkBytes: 1024 * 1024,
  maxKeyBytes: 16 * 1024 * 1024,
  maxKeyFileBytes: 1024 * 1024,
  maxKeyEntries: 10_000,
  maxKeyNameChars: 4_096,
  maxKeyValueChars: 4_096,
})

export type MusicFormat = 'kgm-v3' | 'ncm' | 'qmc'
export type MusicOutputFormat = 'flac' | 'mp3' | 'ogg' | 'wav' | 'unknown'
export type MusicValidationDepth = 'audio-signature'
export type MusicKeySource = 'embedded' | 'imported' | 'static'

export type MusicWorkerRequest =
  | { type: 'hash'; id: string; file: File }
  | { type: 'decrypt'; id: string; file: File; keyFile?: File }
  | { type: 'cancel'; id: string }
  | { type: 'ack'; id: string }

export type MusicWorkerMessage =
  | { type: 'hashed'; id: string; sha256: string }
  | { type: 'started'; id: string; format: MusicFormat; outputFormat: MusicOutputFormat; inputBytes: number; audioBytes: number; cipher?: string; keySource?: MusicKeySource }
  | { type: 'chunk'; id: string; buffer: ArrayBuffer; bytes: number }
  | { type: 'complete'; id: string; outputBytes: number; outputFormat: Exclude<MusicOutputFormat, 'unknown'>; validationDepth: MusicValidationDepth }
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
  validationDepth: MusicValidationDepth
  inputBytes: number
  outputBytes: number
  outputSha256: string
  outputFile: File
  keySource?: MusicKeySource
}
