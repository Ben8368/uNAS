import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatMediaTime, getDecodeHints, MAX_SUBTITLE_BYTES, subtitlesToVtt, type DecodeHint } from './playerHelpers'
import '../../../styles/media-player.css'

export interface LocalMediaPlayerProps {
  /** User-authorized local files only. Remote streams must use a separate streaming adapter. */
  files: readonly File[]
  initialIndex?: number
  onClose?: () => void
}

type MediaKind = 'audio' | 'video'
type RepeatMode = 'off' | 'one' | 'all'

function kindFor(file: File): MediaKind {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  // Extension is only a fallback for local picker files with an empty/incorrect MIME type.
  return /\.(mp4|m4v|webm|mov|mkv|ogv)$/i.test(file.name) ? 'video' : 'audio'
}

function describeDecodeHint(hints: DecodeHint[]) {
  const available = hints.filter(hint => hint.support !== 'no').map(hint => hint.label)
  return available.length ? `canPlayType 提示可尝试：${available.join('、')}（不保证实际解码成功）` : 'canPlayType 未报告常见格式支持；仍可尝试播放，实际结果取决于容器和编码。'
}

function prettySize(size: number) {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KiB`
  return `${(size / 1024 / 1024).toFixed(1)} MiB`
}

export function LocalMediaPlayer({ files, initialIndex = 0, onClose }: LocalMediaPlayerProps) {
  const list = useMemo(() => files.filter(file => file instanceof File), [files])
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), Math.max(0, list.length - 1)))
  const file = list[index]
  const kind = file ? kindFor(file) : 'audio'
  const [mediaUrl, setMediaUrl] = useState('')
  const [subtitleUrl, setSubtitleUrl] = useState('')
  const [subtitleName, setSubtitleName] = useState('')
  const [subtitleError, setSubtitleError] = useState('')
  const [decodeHint, setDecodeHint] = useState('')
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [volume, setVolume] = useState(1)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [shuffle, setShuffle] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRef = kind === 'audio' ? audioRef : videoRef
  const media = mediaRef.current

  useEffect(() => {
    setIndex(current => Math.min(current, Math.max(0, list.length - 1)))
  }, [list.length])

  useEffect(() => {
    if (!file) { setMediaUrl(''); return }
    const url = URL.createObjectURL(file)
    setMediaUrl(url)
    setSubtitleUrl('')
    setSubtitleName('')
    setSubtitleError('')
    setDecodeHint('')
    setDuration(0)
    setCurrentTime(0)
    setBufferedEnd(0)
    setPlaying(false)
    setError('')
    return () => URL.revokeObjectURL(url)
  }, [file])

  const play = useCallback(async () => {
    const element = mediaRef.current
    if (!element) return
    try {
      await element.play()
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? `无法开始播放：${reason.message}` : '无法开始播放；请检查文件是否受支持。')
    }
  }, [mediaRef])
  const pause = useCallback(() => mediaRef.current?.pause(), [mediaRef])

  const move = useCallback((direction: -1 | 1) => {
    if (!list.length) return
    setIndex(current => {
      if (shuffle && list.length > 1) {
        let next = current
        while (next === current) next = Math.floor(Math.random() * list.length)
        return next
      }
      const next = current + direction
      if (next >= 0 && next < list.length) return next
      return repeat === 'all' ? (next + list.length) % list.length : current
    })
  }, [list.length, repeat, shuffle])

  const onEnded = useCallback(() => {
    setPlaying(false)
    if (repeat === 'one') {
      const element = mediaRef.current
      if (element) { element.currentTime = 0; void element.play().catch(() => setError('单曲循环重新播放失败。')) }
      return
    }
    if (index < list.length - 1 || repeat === 'all' || shuffle) move(1)
  }, [index, list.length, mediaRef, move, repeat, shuffle])

  useEffect(() => {
    const element = mediaRef.current
    if (!element) return
    element.volume = volume
  }, [mediaRef, volume])

  useEffect(() => {
    if (!file || !media) return
    setDecodeHint(describeDecodeHint(getDecodeHints(media, kind)))
  }, [file, kind, media])

  useEffect(() => {
    if (kind !== 'audio' || !file || !('mediaSession' in navigator)) return
    const session = navigator.mediaSession
    if (typeof MediaMetadata !== 'undefined') session.metadata = new MediaMetadata({ title: file.name, album: 'uNAS 本地播放' })
    try {
      session.setActionHandler('play', () => { void play() })
      session.setActionHandler('pause', pause)
      session.setActionHandler('previoustrack', () => move(-1))
      session.setActionHandler('nexttrack', () => move(1))
      session.setActionHandler('seekbackward', details => { const el = audioRef.current; if (el) el.currentTime = Math.max(0, el.currentTime - (details.seekOffset ?? 10)) })
      session.setActionHandler('seekforward', details => { const el = audioRef.current; if (el) el.currentTime = Math.min(el.duration || Infinity, el.currentTime + (details.seekOffset ?? 10)) })
    } catch { /* Some browser versions expose only a subset of Media Session actions. */ }
    return () => {
      for (const action of ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward'] as MediaSessionAction[]) {
        try { session.setActionHandler(action, null) } catch { /* Unsupported action. */ }
      }
      session.metadata = null
      session.playbackState = 'none'
    }
  }, [file, kind, move, pause, play])

  useEffect(() => {
    if ('mediaSession' in navigator && kind === 'audio') navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [kind, playing])

  useEffect(() => () => {
    if (subtitleUrl) URL.revokeObjectURL(subtitleUrl)
  }, [subtitleUrl])

  useEffect(() => () => {
    audioRef.current?.pause()
    videoRef.current?.pause()
  }, [])

  const addSubtitle = async (selected?: File) => {
    setSubtitleError('')
    if (!selected) return
    if (selected.size > MAX_SUBTITLE_BYTES) { setSubtitleError('字幕文件超过 2 MiB 安全上限。'); return }
    if (!/\.(vtt|srt)$/i.test(selected.name)) { setSubtitleError('请选择 VTT 或 SRT 字幕文件。'); return }
    try {
      const text = await selected.text()
      const vtt = subtitlesToVtt(text)
      if (vtt === 'WEBVTT\n\n') { setSubtitleError('字幕中没有可识别的有效字幕段。'); return }
      setSubtitleUrl(URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' })))
      setSubtitleName(selected.name)
    } catch (reason) {
      setSubtitleError(reason instanceof Error ? `字幕读取失败：${reason.message}` : '字幕读取失败。')
    }
  }

  if (!file) return <section className="local-media" aria-label="媒体播放器"><div className="local-media__empty"><h2>没有可播放的本地文件</h2><p>请从 Files 选择已获授权的本地音频或视频文件。</p>{onClose && <button className="mt-btn" onClick={onClose}>关闭</button>}</div></section>

  return <section className={`local-media local-media--${kind}`} aria-label={kind === 'audio' ? '本地音频播放器' : '本地视频播放器'}>
    <header className="local-media__header">
      <div className="local-media__heading"><span className="local-media__eyebrow">LOCAL MEDIA · 浏览器原生解码</span><h2 title={file.name}>{file.name}</h2><p>{prettySize(file.size)} · {file.type || 'MIME 未提供'} · 播放能力为浏览器提示</p></div>
      {onClose && <button type="button" className="mt-btn" onClick={onClose}>关闭播放器</button>}
    </header>
    <div className="local-media__stage">
      {kind === 'audio' ? <div className="local-media__art" aria-hidden="true"><span>♫</span></div> : null}
      {kind === 'audio'
        ? <audio ref={audioRef} src={mediaUrl || undefined} controls preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onWaiting={() => setLoading(true)} onCanPlay={() => setLoading(false)} onLoadedMetadata={event => { setDuration(event.currentTarget.duration); setDecodeHint(describeDecodeHint(getDecodeHints(event.currentTarget, kind))) }} onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onProgress={event => { const ranges = event.currentTarget.buffered; setBufferedEnd(ranges.length ? ranges.end(ranges.length - 1) : 0) }} onEnded={onEnded} onError={() => { setLoading(false); setError('浏览器无法解码此音频文件，可能是容器损坏或编码不受支持。') }} />
        : <video ref={videoRef} src={mediaUrl || undefined} controls preload="metadata" playsInline onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onWaiting={() => setLoading(true)} onCanPlay={() => setLoading(false)} onLoadedMetadata={event => { setDuration(event.currentTarget.duration); setDecodeHint(describeDecodeHint(getDecodeHints(event.currentTarget, kind))) }} onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onProgress={event => { const ranges = event.currentTarget.buffered; setBufferedEnd(ranges.length ? ranges.end(ranges.length - 1) : 0) }} onEnded={onEnded} onError={() => { setLoading(false); setError('浏览器无法解码此视频文件，可能是容器损坏或编码不受支持。') }}>
          {subtitleUrl && <track key={subtitleUrl} kind="subtitles" src={subtitleUrl} srcLang="und" label={subtitleName} default />}
        </video>}
    </div>
    <p className="local-media__capability" role="status">{decodeHint || '正在读取浏览器解码能力提示…'}</p>
    <div className="local-media__controls">
      <div className="local-media__transport">
        <button type="button" className="mt-btn" onClick={() => move(-1)} disabled={list.length < 2} aria-label="上一曲">上一曲</button>
        <button type="button" className="mt-btn mt-btn--primary" onClick={() => playing ? pause() : void play()}>{playing ? '暂停' : '播放'}</button>
        <button type="button" className="mt-btn" onClick={() => move(1)} disabled={list.length < 2} aria-label="下一曲">下一曲</button>
        {kind === 'audio' && <>
          <button type="button" className="mt-btn" aria-pressed={shuffle} onClick={() => setShuffle(value => !value)}>随机{shuffle ? '：开' : '：关'}</button>
          <button type="button" className="mt-btn" aria-label="循环模式" onClick={() => setRepeat(value => value === 'off' ? 'all' : value === 'all' ? 'one' : 'off')}>循环：{repeat === 'off' ? '关' : repeat === 'all' ? '列表' : '单曲'}</button>
        </>}
        {kind === 'video' && <label className="local-media__speed">速度<select aria-label="播放速度" onChange={event => { if (videoRef.current) videoRef.current.playbackRate = Number(event.target.value) }} defaultValue="1"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>}
      </div>
      <div className="local-media__seek"><span>{formatMediaTime(currentTime)}</span><input type="range" min={0} max={Number.isFinite(duration) ? duration : 0} step="0.1" value={Math.min(currentTime, duration || 0)} aria-label="播放进度" onChange={event => { const target = Number(event.target.value); if (mediaRef.current && Number.isFinite(target)) mediaRef.current.currentTime = target }} disabled={!duration} /><span>{formatMediaTime(duration)}</span></div>
      <div className="local-media__details"><span>{loading ? `缓冲中 · 已缓冲到 ${formatMediaTime(bufferedEnd)}` : kind === 'audio' ? `播放列表 ${index + 1} / ${list.length}` : '本地视频'}</span><label>音量<input type="range" min={0} max={1} step={0.01} value={volume} aria-label="音量" onChange={event => setVolume(Number(event.target.value))} /></label></div>
      {kind === 'video' && <div className="local-media__subtitle"><label className="mt-btn">加载 VTT / SRT 字幕<input type="file" accept=".vtt,.srt,text/vtt,application/x-subrip" onChange={event => { void addSubtitle(event.target.files?.[0]); event.target.value = '' }} /></label><span>{subtitleName || '未加载字幕'}</span>{subtitleUrl && <button type="button" className="mt-btn" onClick={() => { setSubtitleUrl(''); setSubtitleName('') }}>移除字幕</button>}</div>}
      {subtitleError && <p className="local-media__error" role="alert">{subtitleError}</p>}
      {error && <p className="local-media__error" role="alert">{error}</p>}
    </div>
  </section>
}
