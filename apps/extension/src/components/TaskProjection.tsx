import { useEffect, useState } from 'react'
import { observeProjection, readProjection } from 'unas-src/runtime/demoProjection'
export function TaskProjection() {
  const [projection, setProjection] = useState(readProjection)
  useEffect(() => observeProjection(() => setProjection(readProjection())), [])
  return <aside className="demo-projection" aria-label="Workspace 任务摘要">
    <h2>模拟任务摘要</h2>
    <p>New Tab 只读取 Workspace 最近发布的摘要，不执行任务。</p>
    <p>{projection?.ownerState === 'active' ? '最近收到 Workspace 摘要；不保证页面仍在线。' : 'Workspace 已关闭或尚未启动。'}</p>
    {projection?.jobs.slice(0, 8).map((job) => <p key={job.id}>{job.id} · {projection.ownerState === 'closed' && ['queued', 'running', 'paused'].includes(job.status) ? '已中断（Owner 已关闭）' : job.status} · {job.progress?.current ?? 0}%（mock）</p>)}
    {!projection?.jobs.length && <p>暂无模拟任务</p>}
  </aside>
}
