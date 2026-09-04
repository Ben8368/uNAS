import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { advanceDemoScenario, demoScenarios, getDemoSnapshot, resetDemoScenario, subscribeDemo } from 'unas-src/api'
import { launchStatus } from 'unas-src/runtime/launchStatus'
import { useWindowStore } from 'unas-src/windowStore'
import { useSystemStore } from 'unas-src/store'
export function DemoBanner({ workspace, owner }: { workspace: boolean; owner: boolean }) {
  const banner = useRef<HTMLElement>(null)
  const [snapshot, setSnapshot] = useState(getDemoSnapshot)
  const launchError = useSyncExternalStore(launchStatus.subscribe, launchStatus.getSnapshot)
  useEffect(() => subscribeDemo(() => setSnapshot(getDemoSnapshot())), [])
  useLayoutEffect(() => {
    const element = banner.current
    if (!element) return
    const update = () => document.documentElement.style.setProperty('--desktop-top', `${Math.ceil(element.getBoundingClientRect().bottom) + 12}px`)
    const observer = new ResizeObserver(update)
    observer.observe(element)
    update()
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--desktop-top') }
  }, [])
  function resetScene(scenarioId: typeof snapshot.scenarioId) {
    // Unmount observers before deterministic IDs are reused by the next scenario.
    // A normal batched update could otherwise leave an old poll observing a new job.
    flushSync(() => {
      const windows = useWindowStore.getState()
      windows.windows.forEach((window) => windows.closeWindow(window.id))
      useSystemStore.getState().setShowLauncher(false)
    })
    resetDemoScenario(scenarioId)
  }
  return <section ref={banner} className="demo-banner" aria-label="演示模式">
    <strong>uNAS · {workspace ? 'Workspace' : 'New Tab'} · executionSource: mock</strong>
    <span>演示数据 / 能力未接入。不读取真实文件，不生成真实输出。</span>
    {workspace && <span>关闭或刷新将结束本次内存演示；刷新重新载入固定 fixture，不恢复任务执行。</span>}
    {workspace && owner ? <div className="demo-banner__controls">
      <label>模拟场景 <select title="切换场景会关闭所有 App 窗口并清空本轮演示状态" value={snapshot.scenarioId} onChange={(event) => resetScene(event.target.value as typeof snapshot.scenarioId)}>{demoScenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.label}</option>)}</select></label>
      <button type="button" title="关闭所有 App 窗口并清空本轮演示状态，重新加载固定 fixture" onClick={() => resetScene(snapshot.scenarioId)}>重置场景</button>
      <button type="button" onClick={() => advanceDemoScenario()}>推进模拟步骤</button>
      <span>步骤 {snapshot.step}</span>
      <span>切换 / 重置会关闭 App 窗口，清空本轮状态。</span>
    </div> : <button type="button" onClick={() => useWindowStore.getState().openWindow('tasks')}>打开 / 聚焦 Workspace</button>}
    {launchError && <span role="alert">{launchError}</span>}
  </section>
}
