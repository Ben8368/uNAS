import { extensionApi } from 'unas-src/platform/extension/extensionPlatform'

export function requireExtensionFiles() {
  if (!extensionApi()?.runtime?.id || location.protocol !== 'chrome-extension:') throw new Error('真实文件能力仅在 uNAS 扩展页面开放；Web Demo 不读取你的文件。')
}

/** Keep user files and native file selection outside React and Desktop state. */
export function selectOneFile(): Promise<File | null> {
  requireExtensionFiles()
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.hidden = true
    const finish = (file: File | null) => { input.remove(); resolve(file) }
    input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true })
    input.addEventListener('cancel', () => finish(null), { once: true })
    document.body.append(input)
    input.click()
  })
}

/** This hands an export to the browser; it does not claim the file has been saved. */
export function offerFileExport(blob: Blob, name: string) {
  requireExtensionFiles()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = [...name].map(char => /[\\/]/.test(char) || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? '_' : char).join('')
  document.body.append(link)
  try { link.click() } finally {
    link.remove()
    // Give the browser time to consume the Blob URL; always release it on page teardown.
    const release = () => { clearTimeout(timer); URL.revokeObjectURL(url); window.removeEventListener('pagehide', release) }
    const timer = setTimeout(release, 60_000)
    window.addEventListener('pagehide', release, { once: true })
  }
}
