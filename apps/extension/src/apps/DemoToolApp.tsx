import { useEffect, useState } from 'react'
import { cancelJob, getDemoSnapshot, submitDemoTool, subscribeDemo } from 'unas-src/api'
import { useWindowStore } from 'unas-src/windowStore'
const descriptions = {
  image: { title: 'Image', fixture: '生成图片 fixture · 示例尺寸 1600 × 900', operation: '模拟图片转换' },
  pdf: { title: 'PDF', fixture: '生成文档 fixture · 示例页数 3', operation: '模拟页面提取' },
  archive: { title: 'Archive', fixture: '生成目录 fixture · 示例条目 3', operation: '模拟创建压缩包' },
} as const
function DemoToolApp({ kind }: { kind: keyof typeof descriptions }) {
  const [selected, setSelected] = useState(false)
  const [jobId, setJobId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [snapshot, setSnapshot] = useState(getDemoSnapshot)
  useEffect(() => subscribeDemo(() => setSnapshot(getDemoSnapshot())), [])
  const info = descriptions[kind]
  const job = snapshot.jobs.find((item) => item.id === jobId)
  async function start() {
    setBusy(true); setError('')
    try { setJobId((await submitDemoTool(kind)).id) }
    catch (error) { setError(error instanceof Error ? error.message : '模拟任务创建失败') }
    finally { setBusy(false) }
  }
  return <section className="demo-tool">
    <h2>{info.title} · 模拟工具流程</h2>
    <p>executionSource: mock。仅用于交互演示，不代表格式支持，不读取本地文件，不生成下载文件。</p>
    <h3>1. 选择演示输入</h3><button type="button" onClick={() => setSelected(true)}>模拟选择固定 fixture</button>
    {selected && <p>{info.fixture}（静态元数据）</p>}
    <h3>2. 确认操作</h3><p>{info.operation}，使用固定演示参数。通过顶部场景选择验证权限、失败、预算和取消状态。</p>
    <button type="button" disabled={!selected || busy || !!job && ['queued', 'running'].includes(job.status)} onClick={() => void start()}>创建模拟任务</button>
    {error && <p role="alert">{error}</p>}
    <h3>3. 查看模拟结果</h3>
    {job ? <div role="status"><p>{job.title} · {job.status} · {job.progress?.current ?? 0}%</p>{job.errorMessage && <p>{job.errorMessage}</p>}{job.status === 'succeeded' && <p>模拟结果已生成：仅展示 metadata，没有可下载文件。</p>}{['queued', 'running', 'paused'].includes(job.status) && <button type="button" onClick={() => void cancelJob(job.id).catch((error: unknown) => setError(String(error)))}>取消模拟任务</button>}</div> : <p>尚无当前任务；创建后可在右侧运行状态中推进预览步骤。</p>}
    <button type="button" onClick={() => useWindowStore.getState().openWindow('tasks')}>打开 Task Center</button>
  </section>
}
export const ImageApp = () => <DemoToolApp kind="image" />
export const PdfApp = () => <DemoToolApp kind="pdf" />
export const ArchiveApp = () => <DemoToolApp kind="archive" />

export function TaskCenterApp() {
  const [snapshot, setSnapshot] = useState(getDemoSnapshot)
  const [error, setError] = useState('')
  useEffect(() => subscribeDemo(() => setSnapshot(getDemoSnapshot())), [])
  return <section className="demo-tool"><h2>Task Center · 模拟任务</h2><p>任务由当前 Workspace 唯一 owner 控制；进度只在手动推进时变化。关闭页面会中断本次演示，刷新重新载入固定 fixture。</p>{error && <p role="alert">{error}</p>}{!snapshot.jobs.length && <p>暂无任务。选择工具创建模拟任务。</p>}<ul className="link-apps__list">{snapshot.jobs.map((job) => <li key={job.id}><strong>{job.title}</strong><span>{job.status} · {job.progress?.current ?? 0}% · mock</span>{job.errorMessage && <p>{job.errorMessage}</p>}{['queued', 'running', 'paused'].includes(job.status) && <button type="button" onClick={() => void cancelJob(job.id).catch((error: unknown) => setError(String(error)))}>取消 {job.title}</button>}</li>)}</ul></section>
}
