import { type CSSProperties, type KeyboardEvent, type MouseEvent, useCallback, useId, useRef, useState } from 'react'

import { StatusIcon } from 'unas-src/apps/downloader/icons'
import {
  formatRelativeTime,
  getTaskDisplayTitle,
  getTaskDownloadFilePath,
  getTaskSourceUrl,
  isTaskRetryable,
} from 'unas-src/apps/downloader/helpers'
import type { DownloadTask, DownloaderRowMenuAction } from 'unas-src/apps/downloader/types'

function VerticalDotsIcon() {
  return (
    <svg className="dl-row-menu-trigger__icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="3.5" r="1.35" fill="currentColor" />
      <circle cx="8" cy="8" r="1.35" fill="currentColor" />
      <circle cx="8" cy="12.5" r="1.35" fill="currentColor" />
    </svg>
  )
}

function enabledMenuItems(menu: HTMLElement) {
  return Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'))
}

function focusMenuItem(menu: HTMLElement, direction: 'first' | 'last' | 'next' | 'previous') {
  const items = enabledMenuItems(menu)
  if (!items.length) return
  const current = items.indexOf(document.activeElement as HTMLButtonElement)
  const index = direction === 'first' ? 0
    : direction === 'last' ? items.length - 1
      : direction === 'next' ? (current + 1 + items.length) % items.length
        : (current - 1 + items.length) % items.length
  items[index].focus()
}

type DownloaderTaskTableProps = {
  filteredTasks: DownloadTask[]
  selectedIds: Set<string>
  selectedTaskId: string | null
  onRowClick: (taskId: string, index: number, event: MouseEvent<HTMLDivElement>) => void
  onRowMenuAction?: (action: DownloaderRowMenuAction, task: DownloadTask) => void
}

export function DownloaderTaskTable({
  filteredTasks,
  selectedIds,
  selectedTaskId,
  onRowClick,
  onRowMenuAction,
}: DownloaderTaskTableProps) {
  const multi = selectedIds.size > 0
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null)
  const menuScope = useId().replace(/:/g, '')
  const initializedMenus = useRef(new WeakSet<HTMLDivElement>())
  const setupPopover = useCallback((element: HTMLDivElement | null) => {
    if (!element) return
    element.setAttribute('popover', 'auto')
    if (initializedMenus.current.has(element)) return
    initializedMenus.current.add(element)
    element.addEventListener('toggle', () => {
      setOpenMenuTaskId(element.matches(':popover-open') ? element.dataset.taskId ?? null : null)
    })
  }, [])

  function runAction(action: DownloaderRowMenuAction, task: DownloadTask, menuId: string) {
    onRowMenuAction?.(action, task)
    document.getElementById(menuId)?.hidePopover()
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>, menuId: string) {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
    const menu = document.getElementById(menuId)
    if (!menu) return
    event.preventDefault()
    if (!menu.matches(':popover-open')) menu.showPopover()
    focusMenuItem(menu, event.key === 'ArrowDown' ? 'first' : 'last')
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const menu = event.currentTarget
    const direction = event.key === 'ArrowDown' ? 'next'
      : event.key === 'ArrowUp' ? 'previous'
        : event.key === 'Home' ? 'first'
          : event.key === 'End' ? 'last' : undefined
    if (!direction) return
    event.preventDefault()
    focusMenuItem(menu, direction)
  }

  return (
    <section className="dl-table dl-table--queue">
      <div className="dl-table-scroll">
        <div className="dl-head">
          <span className="dl-col-status" aria-hidden="true" />
          <span className="dl-col-name">视频标题</span>
          <span className="dl-col-progress">进度</span>
          <span className="dl-col-time">时间</span>
          <span className="dl-col-menu" aria-hidden="true" />
        </div>

        {filteredTasks.length === 0 ? (
          <div className="dl-empty">
            <div className="dl-empty-icon">
              <svg viewBox="0 0 80 72" fill="none">
                <rect x="8" y="20" width="64" height="44" rx="6" fill="rgba(255,255,255,.12)" />
                <path
                  d="M8 32a6 6 0 016-6h10l4 5h32a6 6 0 016 6v24a6 6 0 01-6 6H14a6 6 0 01-6-6z"
                  fill="rgba(255,255,255,.18)"
                />
                <path
                  d="M12 36h56v24a6 6 0 01-6 6H18a6 6 0 01-6-6V42a6 6 0 016-6z"
                  fill="rgba(255,255,255,.08)"
                />
                <path d="M18 14h10l4 5H18z" fill="rgba(255,255,255,.14)" />
                <path d="M36 52v8M32 56h8" stroke="rgba(52,210,230,.6)" strokeWidth="2" strokeLinecap="round" />
                <path d="M36 44v4" stroke="rgba(52,210,230,.4)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M36 44c0-1.5 1-3 2.5-3" stroke="rgba(52,210,230,.4)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M36 44c0-1.5-1-3-2.5-3" stroke="rgba(52,210,230,.4)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p>暂无任务</p>
          </div>
        ) : (
          filteredTasks.map((task, index) => {
            const isSelected = multi ? selectedIds.has(task.id) : selectedTaskId === task.id
            const isPrimary = selectedTaskId === task.id
            const menuId = `dl-task-menu-${menuScope}-${index}`
            const anchorName = `--dl-task-menu-anchor-${menuScope}-${index}`
            const anchorStyle = { anchorName } as CSSProperties
            const menuStyle = { positionAnchor: anchorName } as CSSProperties
            return (
              <div
                key={task.id}
                className={`dl-row ${isSelected ? 'dl-row--selected' : ''} ${isPrimary ? 'dl-row--focused' : ''}`}
                onClick={(event) => onRowClick(task.id, index, event)}
              >
                <span className="dl-col-status" aria-hidden="true">
                  <StatusIcon status={task.status} />
                </span>
                <span className="dl-col-name">
                  <strong>{getTaskDisplayTitle(task)}</strong>
                  {task.status !== 'completed' && <small>{task.stage?.trim() || '-'}</small>}
                </span>
                <span className="dl-col-progress">
                  <div className="dl-progress-bar">
                    <div
                      className="dl-progress-fill"
                      style={{ width: `${Math.min(100, Math.max(0, task.progress || 0))}%` }}
                    />
                  </div>
                  <span className="dl-progress-text">{(task.progress || 0).toFixed(1)}%</span>
                </span>
                <span className="dl-col-time">{formatRelativeTime(task.created_at)}</span>
                <span className="dl-col-menu">
                  <button
                    type="button"
                    className={`dl-row-menu-trigger ${openMenuTaskId === task.id ? 'dl-row-menu-trigger--open' : ''}`}
                    aria-label="更多操作"
                    aria-expanded={openMenuTaskId === task.id}
                    aria-haspopup="menu"
                    ref={(element) => element?.setAttribute('popovertarget', menuId)}
                    style={anchorStyle}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => handleTriggerKeyDown(event, menuId)}
                  >
                    <VerticalDotsIcon />
                  </button>
                  <div
                    id={menuId}
                    className="dl-row-menu-popover"
                    ref={setupPopover}
                    data-task-id={task.id}
                    style={menuStyle}
                    role="menu"
                    aria-label="任务扩展操作"
                    onKeyDown={handleMenuKeyDown}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="dl-row-menu-item"
                      disabled={!getTaskSourceUrl(task)}
                      title={getTaskSourceUrl(task) ? '复制原始下载链接' : '无可复制的链接'}
                      onClick={() => runAction('copy_url', task, menuId)}
                    >
                      复制链接
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="dl-row-menu-item"
                      disabled={!getTaskDownloadFilePath(task)}
                      title={getTaskDownloadFilePath(task) ? '查看固定模拟结果，不包含文件下载' : '任务尚未记录模拟结果'}
                      onClick={() => runAction('download_file', task, menuId)}
                    >
                      查看模拟结果
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="dl-row-menu-item"
                      disabled={!isTaskRetryable(task)}
                      title={isTaskRetryable(task) ? '使用原始参数重新提交模拟任务' : '当前状态不支持重新模拟'}
                      onClick={() => runAction('retry', task, menuId)}
                    >
                      重新模拟
                    </button>
                  </div>
                </span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
