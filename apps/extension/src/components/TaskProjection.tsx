import { useEffect, useState } from 'react'
import { observeProjection, readProjection } from 'unas-src/runtime/demoProjection'
import { useWindowStore } from 'unas-src/windowStore'

const statusLabels = { running: '运行中', queued: '排队中', paused: '已暂停', succeeded: '模拟完成', failed: '已失败', canceled: '已取消' }

export function TaskProjection() {
  const [projection, setProjection] = useState(readProjection)
  const openWindow = useWindowStore((state) => state.openWindow)
  useEffect(() => {
    const refresh = () => setProjection(readProjection())
    const unsubscribe = observeProjection(refresh)
    refresh()
    return unsubscribe
  }, [])
  return <section className="rp-card rp-projection" aria-label="Workspace 任务摘要">
    <h2 className="rp-card-title">模拟任务摘要</h2>
    <p>这里显示 Workspace 最近发布的状态；任务操作请进入工作区。</p>
    <p>{projection?.ownerState === 'active' ? '最近收到 Workspace 摘要；不保证页面仍在线。' : 'Workspace 已关闭或尚未启动。'}</p>
    <ul>{projection?.jobs.slice(0, 8).map((job) => <li key={job.id} data-job-id={job.id}>
      <strong>{job.title}</strong>
      <span>{projection.ownerState === 'closed' && ['queued', 'running', 'paused'].includes(job.status) ? '已中断（Owner 已关闭）' : statusLabels[job.status]} · {job.progress?.current ?? 0}%（mock）</span>
    </li>)}</ul>
    {!projection?.jobs.length && <p>暂无模拟任务</p>}
    <button type="button" className="rp-back-btn" onClick={() => openWindow('fetcher')}>在 Workspace 管理任务</button>
  </section>
}
