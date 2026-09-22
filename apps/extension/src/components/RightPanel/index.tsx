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
  compactCpuModel,
  formatBytes,
  formatCompactUptime,
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
  const [isRuntimeDetailsOpen, setIsRuntimeDetailsOpen] = useState(true)
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
  const cpuModel = compactCpuModel(system.cpu_model) || '不可用'
  const cpuTemperature = typeof system.cpu_temperature_c === 'number' ? `${system.cpu_temperature_c.toFixed(1)} °C` : null
  const storageDetails = system.storage_details || []
  const displayCount = typeof system.display_count === 'number' ? `${system.display_count} 台` : '不可用'
  const displayDetails = system.display_details || []
  const systemPlatform = system.platform || '不可用'
  const gpuModel = system.gpu_model || '浏览器未开放'
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
        {error && <div className="rp-error">{error}</div>}
      </div>

      <div className="rp-card rp-collapsible-card">
        <button
          type="button"
          className="rp-card-toggle"
          aria-expanded={isRuntimeDetailsOpen}
          aria-controls="system-details-content"
          aria-label={isRuntimeDetailsOpen ? '收拢系统详情' : '展开系统详情'}
          onClick={() => setIsRuntimeDetailsOpen((open) => !open)}
        >
          <span className="rp-card-title">系统详情</span>
          <span className={`rp-card-chevron${isRuntimeDetailsOpen ? ' rp-card-chevron--open' : ''}`} aria-hidden="true">⌄</span>
        </button>
        {isRuntimeDetailsOpen && <div id="system-details-content" className="rp-system-details">
          <div className="rp-system-detail-row">
            <span>系统</span>
            <strong>{systemPlatform}</strong>
          </div>
          <div className="rp-system-detail-row">
            <span>运行</span>
            <span className="rp-runtime-detail-value">
              <strong>{metrics.runtime?.uptime_seconds == null ? '不可用' : formatCompactUptime(metrics.runtime.uptime_seconds)}</strong>
              {frontendModeLabel(metrics.log_mode) && <span className="rp-runtime-mode">{frontendModeLabel(metrics.log_mode)}</span>}
            </span>
          </div>
          <div className="rp-system-detail-row">
            <span>CPU</span>
            <strong>{cpuModel}</strong>
          </div>
          <div className="rp-system-detail-row">
            <span>内存{memoryLabel === '物理占用' ? '' : ` · ${memoryLabel}`}</span>
            <strong>{memoryDetail}</strong>
          </div>
          {cpuTemperature && <div className="rp-system-detail-row">
            <span>CPU 温度</span>
            <strong>{cpuTemperature}</strong>
          </div>}
          {storageDetails.length > 0
            ? storageDetails.map((storage, index) => (
              <div className="rp-system-detail-row" key={`storage-${index}`}>
                <span>硬盘{index + 1}</span>
                <strong>{storage.capacity_bytes && storage.capacity_bytes > 0 ? formatBytes(storage.capacity_bytes) : '容量不可用'}</strong>
              </div>
            ))
            : <div className="rp-system-detail-row"><span>硬盘</span><strong>不可用</strong></div>}
          <div className="rp-system-detail-row">
            <span>GPU</span>
            <strong>{gpuModel}</strong>
          </div>
          <div className="rp-system-detail-row">
            <span>显示器数量</span>
            <strong>{displayCount}</strong>
          </div>
          {displayDetails.map((display, index) => (
            <div className="rp-system-detail-row" key={`display-${index}`}>
              <span>显示器{index + 1}{displayDetails.length > 2 && display.is_primary ? '（主）' : ''}</span>
              <strong>{[display.label, display.resolution, display.refresh_rate_hz ? `${display.refresh_rate_hz}Hz` : ''].filter(Boolean).join(' · ')}</strong>
            </div>
          ))}
        </div>}
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
