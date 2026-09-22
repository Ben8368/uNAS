import { useMemo, useState } from 'react'
import { cancelJob, getSystemMetrics } from 'unas-src/api'
import { useVisibilityPolling } from 'unas-src/hooks/useVisibilityPolling'
import { useSystemStore } from 'unas-src/store'
import { getErrorMessage } from 'unas-src/utils'

import { GaugeSvg } from './GaugeSvg'
import { TaskGroupList } from './TaskGroupList'
import { EMPTY_METRICS, type RuntimeMetrics } from './types'
import {
  clampPercent,
  formatBytes,
  formatUptime,
  frontendModeLabel,
  healthScore,
  healthStatus,
  summarizeGroupStatuses,
} from './utils'

export function RightPanel({ workspace }: { workspace: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [metrics, setMetrics] = useState<RuntimeMetrics>(EMPTY_METRICS)
  const [error, setError] = useState('')
  const [lastSampleAt, setLastSampleAt] = useState<Date | null>(null)
  const [expandedTaskType, setExpandedTaskType] = useState<string | null>(null)
  const systemLifecycle = useSystemStore((state) => state.systemLifecycle)

  async function refresh(signal?: AbortSignal) {
    if (useSystemStore.getState().systemLifecycle !== 'running') return

    try {
      const data = await getSystemMetrics(signal)
      if (signal?.aborted || useSystemStore.getState().systemLifecycle !== 'running') return
      setMetrics(data)
      setLastSampleAt(new Date())
      setError('')
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
  const health = healthScore(system.cpu_percent, system.memory_percent)
  const healthLabel = healthStatus(health)
  const healthColor = health == null
    ? '#64748b'
    : health >= 80
      ? '#54FFB7'
      : health >= 60
        ? '#F2C66D'
        : '#FF9999'
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
          <span className="rp-card-meta">{sampleTime}</span>
        </div>
        <div className="rp-gauges">
          <GaugeSvg value={system.cpu_percent} color="#7CB3FF" label="CPU" />
          <GaugeSvg value={system.memory_percent} color="#7CB3FF" label="内存" title={`${memoryLabel} · ${memoryDetail}`} />
          <GaugeSvg
            value={health}
            color={healthColor}
            label="健康"
            title={health == null ? 'CPU/内存数据不可用' : `状态：${healthLabel} · CPU 35% · 内存 45%`}
            available={health != null}
            valueSuffix=""
          />
        </div>
        <div className="rp-uptime">
          <span>系统运行</span>
          <span className="rp-uptime-value">
            <strong>{metrics.runtime?.uptime_seconds == null ? '不可用' : formatUptime(metrics.runtime.uptime_seconds)}</strong>
            {frontendModeLabel(metrics.log_mode) && <span className="rp-runtime-mode">{frontendModeLabel(metrics.log_mode)}</span>}
          </span>
        </div>
        <div className="rp-sample-detail">
          <span>内存{memoryLabel === '物理占用' ? '' : ` · ${memoryLabel}`}</span>
          <strong>{memoryDetail}</strong>
        </div>
        {error && <div className="rp-error">{error}</div>}
      </div>

      {workspace && <TaskGroupList
        tasks={tasks}
        groupedTasks={groupedTasks}
        expandedGroup={expandedGroup}
        taskSummary={taskSummary}
        onExpand={setExpandedTaskType}
        onCollapse={() => setExpandedTaskType(null)}
        onCancelTask={handleTaskAction}
      />}
      </div>
    </aside>
  )
}
