import { useEffect, useState, type FormEvent } from 'react'
import { openLink, persistLink, readLinks, saveLinks, subscribeLinks, validateLink, type LinkApp } from 'unas-src/runtime/linkApps'

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
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : '本地配置读取失败')
      }
    }
    void load()
    const unsubscribe = subscribeLinks(() => { void load() })
    return () => { active = false; unsubscribe() }
  }, [])
  function reset() { setEditing(undefined); setOriginal(undefined); setName(''); setUrl('https://'); setIcon('globe') }
  async function persist(next: LinkApp[]) {
    try { await saveLinks(next); setLinks(next); setError(''); return true }
    catch (error) { setError(error instanceof Error ? error.message : '本地保存失败'); return false }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setNotice('')
    const message = validateLink({ name, url }, links, editing)
    if (message) { setError(message); return }
    const next: LinkApp = { schemaVersion: 1, id: editing || `link-${crypto.randomUUID()}`, name: name.trim(), url: new URL(url).href, icon }
    try {
      setLinks(await persistLink(next, original))
      setError(''); reset(); setNotice('已保存在本浏览器。')
    } catch (error) { setError(error instanceof Error ? error.message : '本地保存失败') }
  }
  async function remove(link: LinkApp) {
    if (await persist(links.filter((candidate) => candidate.id !== link.id))) {
      if (editing === link.id) reset()
      setNotice(`已删除 ${link.name}`)
    }
  }
  return <section className="demo-tool link-apps">
    <h2>添加 App</h2>
    <p>选择一个 HTTPS 网址并添加后，它会注册为桌面 App；点击图标将在普通浏览器标签页打开对应页面。配置仅保存在本浏览器，不嵌入网页或读取文件。</p>
    <form onSubmit={(event) => { void submit(event) }} className="demo-tool__form">
      <label>名称<input required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>选择网址<input required type="text" inputMode="url" maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} /></label>
      <label>内置图标<select value={icon} onChange={(event) => setIcon(event.target.value as LinkApp['icon'])}><option value="globe">◎ 网址</option><option value="bookmark">◇ 收藏</option></select></label>
      <div><button type="submit">{editing ? '保存修改' : '添加 App'}</button>{editing && <button type="button" onClick={reset}>取消编辑</button>}</div>
    </form>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!links.length && <p>尚未添加桌面 App。</p>}
    <ul className="link-apps__list">{links.map((link) => <li key={link.id}>
      <button type="button" onClick={() => { try { openLink(link.url) } catch (error) { setError(String(error)) } }}><span aria-hidden="true">{link.icon === 'bookmark' ? '◇' : '◎'}</span> {link.name}</button>
      <span>{link.url}</span>
      <button type="button" aria-label={`编辑 ${link.name}`} onClick={() => { setEditing(link.id); setOriginal(link); setName(link.name); setUrl(link.url); setIcon(link.icon); setNotice(''); setError('') }}>编辑</button>
      <button type="button" aria-label={`删除 ${link.name}`} onClick={() => { void remove(link) }}>删除</button>
    </li>)}</ul>
  </section>
}
