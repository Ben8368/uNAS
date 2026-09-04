import { useEffect, useState, type FormEvent } from 'react'
import { openLink, readLinks, saveLinks, validateLink, type LinkApp } from 'unas-src/runtime/linkApps'

export function BrowserApp() {
  const [links, setLinks] = useState<LinkApp[]>([])
  const [editing, setEditing] = useState<string | undefined>()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('https://')
  const [icon, setIcon] = useState<LinkApp['icon']>('globe')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const load = () => { try { setLinks(readLinks()); setError('') } catch (error) { setError(error instanceof Error ? error.message : '本地配置读取失败') } }
    load()
    window.addEventListener('storage', load)
    return () => window.removeEventListener('storage', load)
  }, [])
  function reset() { setEditing(undefined); setName(''); setUrl('https://'); setIcon('globe') }
  function persist(next: LinkApp[]) {
    try { saveLinks(next); setLinks(next); setError(''); return true }
    catch (error) { setError(error instanceof Error ? error.message : '本地保存失败'); return false }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    const message = validateLink({ name, url }, links, editing)
    if (message) { setError(message); return }
    const next: LinkApp = { schemaVersion: 1, id: editing || `link-${crypto.randomUUID()}`, name: name.trim(), url: new URL(url).href, icon }
    if (persist(editing ? links.map((link) => link.id === editing ? next : link) : [...links, next])) { reset(); setNotice('已保存在本浏览器。') }
  }
  return <section className="demo-tool link-apps">
    <h2>网址 App</h2>
    <p>保存名称和 HTTPS 网址，点击后在普通浏览器标签页打开。配置仅保存在本浏览器；不嵌入网页、不读取文件。图标使用内置符号，无需加载外部图片。</p>
    <form onSubmit={submit} className="demo-tool__form">
      <label>名称<input required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>HTTPS 网址<input required type="text" inputMode="url" maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} /></label>
      <label>内置图标<select value={icon} onChange={(event) => setIcon(event.target.value as LinkApp['icon'])}><option value="globe">◎ 网址</option><option value="bookmark">◇ 收藏</option></select></label>
      <div><button type="submit">{editing ? '保存修改' : '添加网址 App'}</button>{editing && <button type="button" onClick={reset}>取消编辑</button>}</div>
    </form>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!links.length && <p>尚未添加网址 App。</p>}
    <ul className="link-apps__list">{links.map((link) => <li key={link.id}>
      <button type="button" onClick={() => { try { openLink(link.url) } catch (error) { setError(String(error)) } }}><span aria-hidden="true">{link.icon === 'bookmark' ? '◇' : '◎'}</span> {link.name}</button>
      <span>{link.url}</span>
      <button type="button" aria-label={`编辑 ${link.name}`} onClick={() => { setEditing(link.id); setName(link.name); setUrl(link.url); setIcon(link.icon); setNotice('') }}>编辑</button>
      <button type="button" aria-label={`删除 ${link.name}`} onClick={() => { if (persist(links.filter((candidate) => candidate.id !== link.id))) { if (editing === link.id) reset(); setNotice(`已删除 ${link.name}`) } }}>删除</button>
    </li>)}</ul>
  </section>
}
