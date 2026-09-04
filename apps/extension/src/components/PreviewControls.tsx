import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

import { advanceDemoScenario, demoScenarios, getDemoSnapshot, resetDemoScenario, subscribeDemo } from 'unas-src/api'
import { useSystemStore } from 'unas-src/store'
import { useWindowStore } from 'unas-src/windowStore'

/** Mock scenarios stay inspectable without occupying the desktop. */
export function PreviewControls() {
  const [snapshot, setSnapshot] = useState(getDemoSnapshot)

  useEffect(() => subscribeDemo(() => setSnapshot(getDemoSnapshot())), [])

  function resetScene(scenarioId: typeof snapshot.scenarioId) {
    flushSync(() => {
      const windows = useWindowStore.getState()
      windows.windows.forEach((window) => windows.closeWindow(window.id))
      useSystemStore.getState().setShowLauncher(false)
    })
    resetDemoScenario(scenarioId)
  }

  return (
    <section className="rp-preview-controls" aria-label="预览控制">
      <div className="rp-card-head">
        <div className="rp-card-title">预览控制</div>
        <span className="rp-card-meta">本地样例</span>
      </div>
      <p>仅切换界面状态；不读取文件，也不生成输出。</p>
      <label>
        场景
        <select
          aria-label="模拟场景"
          title="切换场景会关闭所有 App 窗口并清空本轮状态"
          value={snapshot.scenarioId}
          onChange={(event) => resetScene(event.target.value as typeof snapshot.scenarioId)}
        >
          {demoScenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.label}</option>)}
        </select>
      </label>
      <div className="rp-preview-controls__actions">
        <button type="button" onClick={() => resetScene(snapshot.scenarioId)}>重置场景</button>
        <button type="button" onClick={() => advanceDemoScenario()}>推进模拟步骤</button>
      </div>
      <small>步骤 {snapshot.step}</small>
    </section>
  )
}
