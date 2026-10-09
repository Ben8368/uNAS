import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { FileRef } from '#contracts'
import { detectPreview } from 'unas-src/features/file-manager/previewRegistry'
import { MarkdownSafeView } from 'unas-src/features/file-manager/MarkdownSafeView'
import { readPreviewFile, type PreviewReadService } from './previewRead'
import { useWindowCloseGuard } from 'unas-src/shared/window-close/WindowCloseScope'
import 'unas-src/shared/styles/file-manager-preview.css'

export type { PreviewReadService } from './previewRead'
export type FilePreviewHandle = { confirmLeave(): boolean }

export type FilePreviewPanelProps = {
  file: FileRef
  reader: PreviewReadService
  onClose?: () => void
  onDownload?: (ref: FileRef) => void | Promise<void>
  onSaveText?: (ref: FileRef, value: string) => Promise<void>
}

type ReadState = { status: 'loading' } | { status: 'ready'; bytes: Uint8Array } | { status: 'error'; message: string }

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') return '读取已取消。'
  if (error instanceof Error && /limit|large|size|budget/i.test(error.message)) return '文件超过预览读取上限。请下载后使用本地应用打开。'
  return error instanceof Error ? error.message : '读取文件失败。'
}

export const FilePreviewPanel = forwardRef<FilePreviewHandle, FilePreviewPanelProps>(function FilePreviewPanel({ file, reader, onClose, onDownload, onSaveText }, ref) {
  const [readState, setReadState] = useState<ReadState>({ status: 'loading' })
  const [text, setText] = useState('')
  const [originalText, setOriginalText] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [imageScale, setImageScale] = useState<'fit' | 'actual'>('fit')
  const [actionMessage, setActionMessage] = useState('')
  const savingInFlight = useRef(false)
  const dirty = Boolean(onSaveText && text !== originalText)
  const confirmLeave = useCallback(() => {
    if (savingInFlight.current) { setActionMessage('正在保存，请等待结果后再关闭或切换文件。'); return false }
    return !dirty || window.confirm(`放弃“${file.name}”尚未保存的修改？`)
  }, [dirty, file.name])
  useImperativeHandle(ref, () => ({ confirmLeave }), [confirmLeave])
  useWindowCloseGuard(confirmLeave)

  useEffect(() => {
    if (!dirty && !saving) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty, saving])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setReadState({ status: 'loading' })
    void readPreviewFile(file, reader, controller.signal).then((bytes) => {
      if (active) setReadState({ status: 'ready', bytes })
    }).catch((error: unknown) => {
      if (active) setReadState({ status: 'error', message: errorMessage(error) })
    })
    return () => { active = false; controller.abort() }
  }, [file, reader])

  const descriptor = useMemo(() => readState.status === 'ready'
    ? detectPreview(readState.bytes, { name: file.name, declaredType: file.declaredType })
    : undefined, [file.declaredType, file.name, readState])
  const imageUrl = useMemo(() => {
    if (readState.status !== 'ready' || descriptor?.kind !== 'image' || !descriptor.mediaType) return undefined
    const copy = new Uint8Array(readState.bytes.byteLength)
    copy.set(readState.bytes)
    return URL.createObjectURL(new Blob([copy.buffer], { type: descriptor.mediaType }))
  }, [descriptor, readState])
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl) }, [imageUrl])

  useEffect(() => {
    if (readState.status !== 'ready' || (descriptor?.kind !== 'text' && descriptor?.kind !== 'markdown')) return
    try {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(readState.bytes)
      setText(decoded)
      setOriginalText(decoded)
    } catch {
      setReadState({ status: 'error', message: '文本不是有效的 UTF-8 内容，未显示为文本。' })
    }
  }, [descriptor?.kind, readState])

  async function saveText() {
    if (!onSaveText || savingInFlight.current) return
    savingInFlight.current = true
    const savedText = text
    setSaving(true); setSaveMessage('正在保存…')
    try { await onSaveText(file, savedText); setOriginalText(savedText); setEditing(false); setSaveMessage('保存成功。') }
    catch (error) { setSaveMessage(error instanceof Error ? `保存失败：${error.message}` : '保存结果未知，请重新检查文件内容。') }
    finally { savingInFlight.current = false; setSaving(false) }
  }

  async function download() {
    if (!onDownload) return
    setActionMessage('')
    try { await onDownload(file) }
    catch (error) { setActionMessage(error instanceof Error ? error.message : '下载 / 导出失败。') }
  }

  return <section className="fm-preview" aria-label={`预览 ${file.name}`}>
    <header className="fm-preview__header">
      <strong title={file.name}>{file.name}</strong>
      <div className="fm-preview__actions">
        {descriptor?.kind === 'image' && <>
          <button type="button" onClick={() => setImageScale('fit')}>适应窗口</button>
          <button type="button" onClick={() => setImageScale('actual')}>原始大小</button>
        </>}
        {(descriptor?.kind === 'text' || descriptor?.kind === 'markdown') && onSaveText && <button type="button" disabled={saving} onClick={() => setEditing(value => !value)}>{editing ? '预览' : dirty ? '编辑 · 已修改' : '编辑'}</button>}
        {onDownload && <button type="button" onClick={() => void download()}>下载 / 导出</button>}
        {onClose && <button type="button" aria-label="关闭预览" disabled={saving} onClick={() => { if (confirmLeave()) onClose() }}>关闭</button>}
      </div>
    </header>
    {readState.status === 'loading' && <p className="fm-preview__message" role="status">正在读取文件（有限大小）…</p>}
    {actionMessage && <p className="fm-preview__message fm-preview__message--error" role="alert">{actionMessage}</p>}
    {readState.status === 'error' && <p className="fm-preview__message fm-preview__message--error" role="alert">{readState.message} {onDownload && <button type="button" onClick={() => void download()}>下载文件</button>}</p>}
    {readState.status === 'ready' && descriptor?.kind === 'image' && imageUrl && <div className="fm-preview__canvas"><img className={`fm-preview__image ${imageScale === 'actual' ? 'is-actual' : ''}`} src={imageUrl} alt={file.name} /></div>}
    {readState.status === 'ready' && (descriptor?.kind === 'text' || descriptor?.kind === 'markdown') && <div className="fm-preview__document">
      {editing ? <textarea aria-label="编辑文本" disabled={saving} value={text} onChange={event => setText(event.target.value)} spellCheck={false} />
        : descriptor.kind === 'markdown' ? <MarkdownSafeView source={text} /> : <pre>{text}</pre>}
      {saveMessage && <p role="status">{saveMessage}</p>}
      {editing && onSaveText && <button type="button" disabled={saving} onClick={() => void saveText()}>{saving ? '正在保存…' : '保存'}</button>}
    </div>}
    {readState.status === 'ready' && descriptor?.kind === 'unsupported' && <div className="fm-preview__message">
      <p>{descriptor.reason}</p>
      <p>文件大小：{file.size.toLocaleString()} 字节 · 内容已读取且未执行。</p>
      {onDownload ? <button type="button" onClick={() => void download()}>下载 / 导出</button> : <p>当前来源没有提供下载或导出操作。</p>}
    </div>}
  </section>
})
