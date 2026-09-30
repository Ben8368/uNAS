export type PreviewKind = 'image' | 'text' | 'markdown' | 'unsupported'

export type PreviewDescriptor = {
  kind: PreviewKind
  mediaType?: string
  reason?: string
}

export type PreviewHints = { name: string; declaredType?: string }

const TEXT_EXTENSIONS = new Set([
  'txt', 'text', 'log', 'json', 'jsonc', 'xml', 'yaml', 'yml', 'md', 'markdown',
  'csv', 'tsv', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm', 'py', 'rs', 'go',
  'java', 'c', 'h', 'cpp', 'sh', 'sql', 'toml', 'ini', 'conf', 'svg',
])

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

function bytesStart(bytes: Uint8Array, values: number[]): boolean {
  return values.every((value, index) => bytes[index] === value)
}

function rasterType(bytes: Uint8Array): string | undefined {
  if (bytesStart(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (bytesStart(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (bytesStart(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || bytesStart(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return 'image/gif'
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp'
  return undefined
}

function isTextLike(bytes: Uint8Array): boolean {
  if (!bytes.length) return true
  let controls = 0
  const sampleLength = Math.min(bytes.length, 4096)
  for (let i = 0; i < sampleLength; i += 1) {
    const byte = bytes[i]
    if (byte === 0) return false
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d && byte !== 0x0c) controls += 1
  }
  return controls / sampleLength < 0.02
}

/** Detects only formats rendered by the bundled viewer. Extension and MIME are hints, never proof. */
export function detectPreview(bytes: Uint8Array, hints: PreviewHints): PreviewDescriptor {
  const raster = rasterType(bytes)
  if (raster) return { kind: 'image', mediaType: raster }

  const ext = extensionOf(hints.name)
  const type = (hints.declaredType ?? '').split(';', 1)[0].trim().toLowerCase()
  if (type === 'application/pdf' || bytesStart(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { kind: 'unsupported', reason: 'PDF 查看器尚未集成；可以下载后使用系统查看器打开。' }
  }
  if (type === 'text/html' || type === 'image/svg+xml' || ext === 'html' || ext === 'htm' || ext === 'svg') {
    return { kind: 'unsupported', reason: 'HTML 和 SVG 可能包含活动内容，当前不会在预览器中执行或渲染。' }
  }
  if (isTextLike(bytes) && (type.startsWith('text/') || TEXT_EXTENSIONS.has(ext) || !type)) {
    return { kind: ext === 'md' || ext === 'markdown' ? 'markdown' : 'text', mediaType: 'text/plain' }
  }
  return { kind: 'unsupported', reason: '当前没有适用于此文件内容的安全预览器。' }
}

export const PREVIEW_READ_LIMITS = { imageBytes: 8 * 1024 * 1024, textBytes: 2 * 1024 * 1024 } as const
