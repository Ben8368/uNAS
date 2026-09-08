import { useMemo, useState } from 'react'
import { cancelJob, getSystemMetrics } from 'unas-src/api'
import { useVisibilityPolling } from 'unas-src/hooks/useVisibilityPolling'
import { useSystemStore } from 'unas-src/store'
import { getErrorMessage } from 'unas-src/utils'

import { DualLineChart } from './DualLineChart'
import { GaugeSvg } from './GaugeSvg'
import { PreviewControls } from 'unas-src/components/PreviewControls'
import { TaskGroupList } from './TaskGroupList'
import { TaskProjection } from 'unas-src/components/TaskProjection'
import { EMPTY_METRICS, type RuntimeMetrics } from './types'
import {
  clampPercent,
  formatBytes,
  formatUptime,
  frontendModeLabel,
  normalizeServices,
  serviceName,
  serviceTitle,
  summarizeGroupStatuses,
} from './utils'

export function RightPanel({ workspace }: { workspace: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [metrics, setMetrics] = useState<RuntimeMetrics>(EMPTY_METRICS)
  const [netUpData, setNetUpData] = useState<number[]>(Array.from({ length: 40 }, () => 0))
  const [netDownData, setNetDownData] = useState<number[]>(Array.from({ length: 40 }, () => 0))
  const [error, setError] = useState('')
  const [lastSampleAt, setLastSampleAt] = useState<Date | null>(null)
  const [expandedTaskType, setExpandedTaskType] = useState<string | null>(null)
  const [servicesExpanded, setServicesExpanded] = useState(false)
  const systemLifecycle = useSystemStore((state) => state.systemLifecycle)

  async function refresh(signal?: AbortSignal) {
    if (useSystemStore.getState().systemLifecycle !== 'running') return

    try {
      const data = await getSystemMetrics(signal)
      if (signal?.aborted || useSystemStore.getState().systemLifecycle !== 'running') return
      setMetrics(data)
      setLastSampleAt(new Date())
      setError('')
      setNetUpData((items) => [...items.slice(1), Number(data.network?.upload_bytes_per_sec || 0)])
      setNetDownData((items) => [...items.slice(1), Number(data.network?.download_bytes_per_sec || 0)])
    } catch (err: unknown) {
      if (signal?.aborted || useSystemStore.getState().systemLifecycle !== 'running') return
      setError(getErrorMessage(err) || '监控数据读取失败')
    }
  }

  async function handleTaskAction(taskId: string) {
    if (!workspace) return
    try {
      const result = await cancelJob(taskId)
      if (!result.ok) throw new Error(result.message || '取消未生效，请刷新任务状态。')
      await refresh()
    } catch (err: unknown) {
      setError(getErrorMessage(err) || '任务操作失败')
    }
  }

  useVisibilityPolling(refresh, 1000, systemLifecycle === 'running')

  const system = metrics.system || EMPTY_METRICS.system!
  const network = metrics.network || EMPTY_METRICS.network!
  const services = useMemo(() => normalizeServices(metrics.services || []), [metrics.services])
  const tasks = metrics.tasks || []
  const taskSummary = metrics.task_summary
  const groupedTasks = useMemo(() => {
    const groups = new Map<string, { type: string; label: string; tasks: NonNullable<RuntimeMetrics['tasks']>; progress: number; statusSummary: string }>()
    tasks.forEach((task) => {
      const key = task.type || 'unknown'
      if (!groups.has(key)) {
        groups.set(key, { type: key, label: task.name || key, tasks: [], progress: 0, statusSummary: '' })
      }
      groups.get(key)!.tasks.push(task)
    })
    return Array.from(groups.values()).map((group) => {
      const progress = group.tasks.reduce((sum, task) => sum + clampPercent(task.progress), 0) / Math.max(group.tasks.length, 1)
      return {
        ...group,
        progress,
        statusSummary: summarizeGroupStatuses(group.tasks),
      }
    })
  }, [tasks])
  const expandedGroup = groupedTasks.find((group) => group.type === expandedTaskType) || null
  const memoryLabel = system.memory_pressure_label || '物理占用'
  const memoryDetail = system.memory_total_bytes
    ? `${formatBytes(system.memory_used_bytes)} / ${formatBytes(system.memory_total_bytes)}`
    : '等待采样'
  const sampleTime = lastSampleAt
    ? lastSampleAt.toLocaleTimeString('zh-CN', { hour12: false })
    : '未采样'

  return (
    <aside className={`mt-right-panel${isOpen ? ' mt-right-panel--open' : ''}`} aria-label="运行状态">
      <button
        type="button"
        className="rp-edge-trigger"
        aria-label={isOpen ? '收起运行状态' : '显示运行状态'}
        aria-controls="runtime-status-panel"
        aria-expanded={isOpen}
        title={isOpen ? '隐藏运行状态' : '显示运行状态'}
        onClick={(event) => {
          setIsOpen((open) => !open)
          event.currentTarget.blur()
        }}
      />
      <div id="runtime-status-panel" className="rp-panel-content">
      <div className="rp-card">
        <div className="rp-card-head rp-runtime-head">
          <div className="rp-card-title">运行状态</div>
          <span className="rp-card-meta">模拟数据 · {sampleTime}</span>
        </div>
        <div className="rp-gauges">
          <GaugeSvg value={system.cpu_percent || 0} color="#7CB3FF" label="CPU" />
          <GaugeSvg value={system.memory_percent || 0} color="#7CB3FF" label="内存" title={`${memoryLabel} · ${memoryDetail}`} />
          <GaugeSvg
            value={system.gpu_percent || 0}
            color={system.gpu_available ? '#7CB3FF' : '#64748b'}
            label="GPU"
            title={system.gpu_detail}
            available={system.gpu_available !== false}
          />
        </div>
        <div className="rp-uptime">
          <span>本次运行 <span>{formatUptime(metrics.runtime?.uptime_seconds || 0)}</span></span>
          {frontendModeLabel(metrics.log_mode) && <span className="rp-runtime-mode">{frontendModeLabel(metrics.log_mode)}</span>}
        </div>
        <div className="rp-sample-detail">
          <span>内存{memoryLabel === '物理占用' ? '' : ` · ${memoryLabel}`}</span>
          <strong>{memoryDetail}</strong>
        </div>
        {error && <div className="rp-error">{error}</div>}
      </div>

      <div className="rp-card">
        <div className="rp-card-head rp-runtime-head">
          <div className="rp-card-title">模拟流量</div>
          <span className="rp-card-meta">演示数据</span>
        </div>
        <div className="rp-net" title="模拟任务数据，不代表设备或浏览器的实际网络流量">
          <div className="rp-net-row">
            <span className="rp-net-up">↑ {network.upload?.text || '0 B/s'}</span>
            <span className="rp-net-down">↓ {network.download?.text || '0 B/s'}</span>
          </div>
          <div className="rp-net-chart">
            <DualLineChart dataUp={netUpData} dataDown={netDownData} />
          </div>
        </div>
      </div>

      <div className="rp-card">
        <button
          type="button"
          className="rp-card-head rp-service-toggle"
          aria-expanded={servicesExpanded}
          onClick={() => setServicesExpanded((expanded) => !expanded)}
        >
          <div className="rp-card-title">模拟服务状态</div>
          <span className={`rp-service-chevron ${servicesExpanded ? 'rp-service-chevron--open' : ''}`}>›</span>
        </button>
        {servicesExpanded && (
          <div className="rp-service-list">
            {services.map((service) => (
              <div key={service.id} className="rp-service-item" title={serviceTitle(service)}>
                <span className={`rp-service-dot ${service.online && service.availability_status !== 'degraded' ? 'rp-service-dot--online' : ''}`} />
                <span className="rp-service-name">{serviceName(service)}</span>
                <small>{service.status}</small>
              </div>
            ))}
            {!services.length && <div className="rp-empty">暂无服务状态</div>}
          </div>
        )}
      </div>

      {workspace ? <TaskGroupList
        tasks={tasks}
        groupedTasks={groupedTasks}
        expandedGroup={expandedGroup}
        taskSummary={taskSummary}
        onExpand={setExpandedTaskType}
        onCollapse={() => setExpandedTaskType(null)}
        onCancelTask={handleTaskAction}
      /> : <TaskProjection />}
        {workspace && <PreviewControls />}
      </div>
    </aside>
  )
}
