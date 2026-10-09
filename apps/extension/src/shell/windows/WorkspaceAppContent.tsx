import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { inlineWorkspace } from 'unas-src/platform/workspace/inlineWorkspace'

/** Connects the logical Workspace before a Workspace-owned App renders; the App registry stays declarative. */
export function WorkspaceAppContent({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(inlineWorkspace.subscribe, inlineWorkspace.getState)
  useEffect(() => {
    // Failure is reported through the session state below, so the rejection itself carries nothing new.
    if (state === 'idle') void inlineWorkspace.connect().catch(() => undefined)
  }, [state])
  if (state === 'lost' || state === 'unavailable') return <div className="mt-app-loading mt-app-load-error" role="alert">
    <span>Workspace 连接已中断。任务可能已中断，未确认的操作不会自动重试。</span>
    <span>请刷新页面后重新开始；不会恢复模拟文件或运行中的任务。</span>
    <button type="button" onClick={() => location.reload()}>重新加载桌面</button>
  </div>
  if (state !== 'owner' && state !== 'client') return <div className="mt-app-loading" role="status">正在连接 Workspace…</div>
  return children
}
