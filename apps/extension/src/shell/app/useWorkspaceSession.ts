import { useEffect, useSyncExternalStore } from 'react'
import { inlineWorkspace } from 'unas-src/platform/workspace/inlineWorkspace'
import { launchStatus } from 'unas-src/platform/workspace/launchStatus'

export function useWorkspaceSession(workspace: boolean) {
  const state = useSyncExternalStore(inlineWorkspace.subscribe, inlineWorkspace.getState)
  const retry = () => { void inlineWorkspace.connect().catch(error => launchStatus.set(error instanceof Error ? error.message : 'Workspace 连接失败')) }
  useEffect(() => { if (workspace) retry() }, [workspace])
  return { state, retry }
}
