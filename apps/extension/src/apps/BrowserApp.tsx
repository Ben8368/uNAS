import { useEffect, useState, type FormEvent } from 'react'
import { Bookmark, ExternalLink, Globe2, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'

import { openLink, persistLink, readLinks, removeLink, subscribeLinks, validateLink, type LinkApp } from 'unas-src/runtime/linkApps'

export function BrowserApp() {
  const [links, setLinks] = useState<LinkApp[]>([])
  const [editing, setEditing] = useState<string | undefined>()
  const [original, setOriginal] = useState<LinkApp | undefined>()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('https://')
  const [icon, setIcon] = useState<LinkApp['icon']>('globe')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const next = await readLinks()
        if (!active) return
        setLinks(next)
        setError('')
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : '无法读取本地 App 配置。')
      }
    }
    void load()
    const unsubscribe = subscribeLinks(() => { void load() })
    return () => { active = false; unsubscribe() }
  }, [])

  function reset() {
    setEditing(undefined)
    setOriginal(undefined)
    setName('')
    setUrl('https://')
    setIcon('globe')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setNotice('')
    const message = validateLink({ name, url }, links, editing)
    if (message) { setError(message); return }
    const next: LinkApp = { schemaVersion: 1, id: editing || `link-${crypto.randomUUID()}`, name: name.trim(), url: new URL(url).href, icon }
    try {
      setLinks(await persistLink(next, original))
      setError('')
      reset()
      setNotice(editing ? '修改已保存。' : '已添加到桌面。')
    } catch (reason) { setError(reason instanceof Error ? reason.message : '无法保存 App。') }
  }

  async function remove(link: LinkApp) {
    try {
      setLinks(await removeLink(link))
      setError('')
      if (editing === link.id) reset()
      setNotice(`已从桌面移除“${link.name}”。`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : '无法删除 App。') }
  }

  return <main className="link-apps">
    <header className="link-apps__header">
      <div><h2>网址 App</h2><p>把常用网站放到桌面，点击后在普通浏览器标签页中打开。</p></div>
      <span><ShieldCheck aria-hidden="true" />仅限 HTTPS</span>
    </header>

    <div className="link-apps__layout">
      <form onSubmit={(event) => { void submit(event) }} className="link-apps__form">
        <div className="link-apps__section-title"><div className="link-apps__glyph"><Plus aria-hidden="true" /></div><div><h3>{editing ? '编辑 App' : '添加到桌面'}</h3><p>配置只保存在当前浏览器，不嵌入网页，也不读取文件。</p></div></div>
        <label><span>名称</span><input required maxLength={60} placeholder="例如：团队文档" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label><span>选择网址</span><input required type="text" inputMode="url" maxLength={2048} placeholder="https://example.com" value={url} onChange={(event) => setUrl(event.target.value)} /></label>
        <label><span>图标</span><select aria-label="内置图标" value={icon} onChange={(event) => setIcon(event.target.value as LinkApp['icon'])}><option value="globe">网址</option><option value="bookmark">收藏</option></select></label>
        <div className="link-apps__form-actions"><button type="submit" className="link-apps__primary">{editing ? '保存修改' : '添加 App'}</button>{editing && <button type="button" onClick={reset}>取消编辑</button>}</div>
      </form>

      <section className="link-apps__collection" aria-labelledby="saved-link-apps">
        <div className="link-apps__collection-head"><div><h3 id="saved-link-apps">桌面 App</h3><p>{links.length ? `${links.length} 个已保存项目` : '常用网站会显示在这里'}</p></div></div>
        {error && <p className="link-apps__message link-apps__message--error" role="alert">{error}</p>}
        {notice && <p className="link-apps__message" role="status">{notice}</p>}
        {!links.length && <div className="link-apps__empty"><Globe2 aria-hidden="true" /><strong>尚未添加桌面 App</strong><p>填写左侧信息，即可创建一个安全的 HTTPS 快捷方式。</p></div>}
        <ul className="link-apps__list">{links.map((link) => <li key={link.id}>
          <div className="link-apps__item-icon">{link.icon === 'bookmark' ? <Bookmark aria-hidden="true" /> : <Globe2 aria-hidden="true" />}</div>
          <div className="link-apps__item-copy"><strong>{link.name}</strong><span title={link.url}>{link.url}</span></div>
          <div className="link-apps__item-actions">
            <button type="button" aria-label={`打开 ${link.name}`} title="在新标签页打开" onClick={() => { try { openLink(link.url) } catch (reason) { setError(String(reason)) } }}><ExternalLink /></button>
            <button type="button" aria-label={`编辑 ${link.name}`} title="编辑" onClick={() => { setEditing(link.id); setOriginal(link); setName(link.name); setUrl(link.url); setIcon(link.icon); setNotice(''); setError('') }}><Pencil /></button>
            <button type="button" aria-label={`删除 ${link.name}`} title="删除" onClick={() => { void remove(link) }}><Trash2 /></button>
          </div>
        </li>)}</ul>
      </section>
    </div>
  </main>
}
