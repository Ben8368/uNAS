import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { inlineWorkspace } from 'unas-src/runtime/inlineWorkspace'
import { prepareMusicDecrypt, probeMusicCapability, type MusicDecryptRun } from 'unas-src/api/musicDecryption'
import type { MusicCapability, MusicDecryptResult } from 'unas-src/music/types'

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`
  return `${(value / 1024 / 1024).toFixed(1)} MiB`
}

function outputName(input: string, format: string) {
  const base = input.replace(/\.[^.]+$/, '') || 'decrypted-audio'
  return `${base}.${format}`
}

export function MusicApp() {
  const workspaceState = inlineWorkspace.getState()
  const capability = useMemo<MusicCapability>(() => probeMusicCapability(), [])
  const run = useRef<MusicDecryptRun>()
  const objectUrl = useRef<string>()
  const [file, setFile] = useState<File | undefined>()
  const [result, setResult] = useState<MusicDecryptResult | undefined>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [processed, setProcessed] = useState(0)

  const cleanup = useCallback(async () => {
    if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = undefined }
    const active = run.current
    run.current = undefined
    await active?.cleanup()
    setResult(undefined)
    setProcessed(0)
  }, [])

  useEffect(() => {
    const onPageHide = () => { void run.current?.cleanup() }
    window.addEventListener('pagehide', onPageHide)
    return () => { window.removeEventListener('pagehide', onPageHide); void cleanup() }
  }, [cleanup])

  const select = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (!selected) return
    setFile(selected); setResult(undefined); setError(''); setNotice(''); setProcessed(0)
    if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = undefined }
  }, [])

  const start = useCallback(async () => {
    if (!file || busy) return
    await cleanup()
    setBusy(true); setError(''); setNotice('正在 Worker 中探测并解密；输出尚未提交。'); setProcessed(0)
    const current = prepareMusicDecrypt(file, ({ processedBytes }) => setProcessed(processedBytes))
    run.current = current
    let succeeded = false
    try {
      const next = await current.result
      if (run.current !== current) return
      succeeded = true
      setResult(next)
      setNotice(`已验证 ${next.outputFormat.toUpperCase()} 输出，${formatBytes(next.outputBytes)} 暂存在 OPFS。`)
    } catch (reason) {
      if (run.current === current) setError(reason instanceof Error ? reason.message : '本地音乐解密失败。')
    } finally {
      if (run.current === current) { if (!succeeded) run.current = undefined; setBusy(false) }
    }
  }, [busy, cleanup, file])

  const cancel = useCallback(() => {
    const current = run.current
    if (!current) return
    setNotice('正在取消并清理 Worker/OPFS 暂存…')
    void current.cancel().then(() => {
      if (run.current !== current) return
      run.current = undefined
      setBusy(false)
      setResult(undefined)
      setProcessed(0)
      setNotice('已取消；Worker 和 OPFS 暂存已清理。')
    })
  }, [])

  const download = useCallback(() => {
    if (!result) return
    const url = URL.createObjectURL(result.outputFile)
    objectUrl.current = url
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = outputName(file?.name ?? 'decrypted-audio', result.outputFormat)
    anchor.click()
    setNotice('已提交浏览器下载；本次 OPFS 暂存将在下载触发后清理。')
    window.setTimeout(() => { void cleanup() }, 1000)
  }, [cleanup, file?.name, result])

  if (workspaceState !== 'owner') return <section className="music-app music-app--blocked" role="status"><h2>本地音乐处理需要 Workspace owner</h2><p>当前页面只是任务投影，不能取得本地文件或启动 Worker。请回到实际 Workspace 页面。</p></section>

  return <section className="music-app" aria-label="本地音乐解密">
    <header className="music-app__header">
      <div><p className="music-app__eyebrow">LOCAL MUSIC ENGINE · executionSource: real</p><h2>本地音乐解密</h2><p>仅处理你主动选择的本地 KGM v3、NCM 和 QMC `.mgg` 文件；不联网、不读取外部 key、不覆盖原文件。</p></div>
      <span className={`music-app__badge ${capability.supported ? 'music-app__badge--ready' : ''}`}>{capability.supported ? 'Worker READY' : 'UNAVAILABLE'}</span>
    </header>
    {!capability.supported && <div className="music-app__error" role="alert">{capability.reasons.join(' ')}</div>}
    <div className="music-app__limits"><span>输入上限 {formatBytes(capability.limits.maxInputBytes)}</span><span>输出上限 {formatBytes(capability.limits.maxOutputBytes)}</span><span>Worker 分块 {formatBytes(capability.limits.workerChunkBytes)}</span><span>OPFS staged output</span></div>
    <div className="music-app__controls">
      <label className="music-app__picker">
        <span>选择本地加密音乐</span>
        <input type="file" accept=".kgm,.ncm,.mgg,.qmc0,.qmc3,.qmcflac,.mflac" onChange={select} disabled={busy || !capability.supported} />
      </label>
      <button type="button" className="mt-btn mt-btn--primary" onClick={() => void start()} disabled={!file || busy || !capability.supported}>{busy ? '处理中…' : '开始解密'}</button>
      <button type="button" className="mt-btn" onClick={cancel} disabled={!busy}>取消并清理</button>
    </div>
    <div className="music-app__file" aria-live="polite">{file ? <><strong>{file.name}</strong><span>{formatBytes(file.size)}</span></> : '尚未选择文件；原文件不会被修改。'}</div>
    {busy && <div className="music-app__progress" role="status"><span style={{ width: `${Math.min(100, file ? processed / file.size * 100 : 0)}%` }} /><small>{processed ? `${formatBytes(processed)} 已写入 OPFS staged output` : '正在读取与验证输入…'}</small></div>}
    {notice && <p className="music-app__notice" role="status">{notice}</p>}
    {error && <p className="music-app__error" role="alert">{error}</p>}
    {result && !busy && <div className="music-app__result"><div><strong>{result.outputFormat.toUpperCase()} 已验证</strong><span>{formatBytes(result.outputBytes)} · {result.format}</span></div><button type="button" className="mt-btn mt-btn--primary" onClick={download}>下载解密结果</button><button type="button" className="mt-btn" onClick={() => void cleanup()}>清理暂存</button></div>}
  </section>
}
