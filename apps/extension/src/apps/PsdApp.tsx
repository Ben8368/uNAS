import { useCallback, useState, type FormEvent } from 'react'

import { applyWorkOrder, getWorkOrder, scanPsd, updateWorkOrder } from 'unas-src/api'
import { useExternalReadGrant, useExternalWriteGrant } from 'unas-src/hooks/useExternalPathGrant'
import { ResizableAppSidebar } from 'unas-src/components/ResizableAppSidebar'
import type { WorkOrder, TextLayerRecord, TranslationLanguage } from '#contracts'
import { PsdPanels, type PsdActiveTab } from './psd/PsdPanels'

import { abortableRequest } from 'unas-src/application/pollJob'
import { usePsdTask } from './psd/usePsdTask'

const DEFAULT_PSD_PATH = '/Workspace/PSD/document.psd'

export function PsdApp() {
  const task = usePsdTask()
  const [activeTab, setActiveTab] = useState<PsdActiveTab>('scan')

  // 扫描状态
  const inputGrant = useExternalReadGrant(DEFAULT_PSD_PATH)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')

  // 工单状态
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [workOrderDirty, setWorkOrderDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ success: boolean; text: string } | null>(null)

  // 应用状态
  const outputGrant = useExternalWriteGrant()
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<{ success: boolean; message: string; outputPath?: string } | null>(null)

  // AI 翻译状态
  const [targetLanguage, setTargetLanguage] = useState<TranslationLanguage>('ja')
  const [customPrompt, setCustomPrompt] = useState('')

  const scan = useCallback(async (event: FormEvent) => {
    event.preventDefault()
    if (scanning || applying) return
    const signal = task.begin()
    setScanning(true)
    setScanError('')
    setWorkOrder(null)
    setWorkOrderDirty(false)
    setSaveMessage(null)
    setApplyResult(null)
    try {
      const scanResult = await abortableRequest(() => scanPsd(inputGrant.displayPath.trim(), inputGrant.grantId ?? undefined), signal)
      if (!scanResult.ok) {
        throw new Error(scanResult.message || 'PSD 扫描失败')
      }
      const completedJob = await task.observe(scanResult.job.id, signal)
      if (completedJob.status !== 'succeeded') {
        throw new Error(completedJob.status === 'canceled' ? '模拟扫描任务已取消。' : completedJob.errorMessage || `模拟扫描未完成（状态：${completedJob.status}）。`)
      }
      const woResult = await abortableRequest(() => getWorkOrder(scanResult.workOrderId), signal)
      if (!woResult.ok || !woResult.workOrder) {
        throw new Error(woResult.message || '获取工单失败')
      }
      if (signal.aborted) return
      setWorkOrder(woResult.workOrder)
      setActiveTab('workorder')
    } catch (err: unknown) {
      if (signal.aborted) return
      setScanError(err instanceof Error ? err.message : '扫描失败')
    } finally {
      if (!signal.aborted) setScanning(false)
    }
  }, [scanning, applying, inputGrant.displayPath, inputGrant.grantId, task.begin, task.observe])

  const updateRecord = useCallback((index: number, field: keyof TextLayerRecord, value: unknown) => {
    if (!workOrder) return
    const records = workOrder.records.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    setWorkOrder({ ...workOrder, records })
    setWorkOrderDirty(true)
  }, [workOrder])

  const saveWorkOrder = useCallback(async () => {
    if (!workOrder || saving) return
    setSaving(true)
    setSaveMessage(null)
    try {
      const result = await updateWorkOrder(workOrder)
      if (!task.mounted.current) return
      if (result.ok) {
        setWorkOrderDirty(false)
        setSaveMessage({ success: true, text: '工单已保存' })
      } else {
        setSaveMessage({ success: false, text: result.message || '保存失败' })
      }
    } catch (err: unknown) {
      if (!task.mounted.current) return
      setSaveMessage({ success: false, text: err instanceof Error ? err.message : '保存失败' })
    } finally {
      if (task.mounted.current) setSaving(false)
    }
  }, [workOrder, saving])

  const apply = useCallback(async (event: FormEvent) => {
    event.preventDefault()
    if (!workOrder || applying || scanning) return
    if (workOrderDirty) {
      setApplyResult({ success: false, message: '工单有未保存的修改，请先在「工单编辑」保存。' })
      return
    }
    const signal = task.begin()
    setApplying(true)
    setApplyResult(null)
    try {
      const result = await abortableRequest(() => applyWorkOrder(workOrder.id, undefined, outputGrant.grantId ?? undefined), signal)
      if (!result.ok) {
        throw new Error(result.message || '应用失败')
      }
      const completedJob = await task.observe(result.job.id, signal)
      if (signal.aborted) return
      if (completedJob.status === 'succeeded') {
        setApplyResult({
          success: true,
          message: '模拟工单应用完成；未修改或生成真实 PSD 文件。',
        })
      } else {
        setApplyResult({
          success: false,
          message: completedJob.status === 'canceled' ? '模拟应用任务已取消。' : completedJob.errorMessage || `工单应用未完成（状态：${completedJob.status}）。`,
        })
      }
    } catch (err: unknown) {
      if (signal.aborted) return
      setApplyResult({ success: false, message: err instanceof Error ? err.message : '应用失败' })
    } finally {
      if (!signal.aborted) setApplying(false)
    }
  }, [workOrder, applying, scanning, workOrderDirty, outputGrant.grantId, task.begin, task.observe])

  const enabledCount = workOrder?.records.filter((r) => r.enabled).length ?? 0
  const changedCount = workOrder?.records.filter((r) => r.enabled && (r.newText !== undefined || r.newFontFamily !== undefined)).length ?? 0

  return (
    <div className="psd-app">
      <ResizableAppSidebar className="psd-sidebar" storageKey="psd">
        <button
          className={`psd-nav${activeTab === 'scan' ? ' psd-nav--active' : ''}`}
          type="button"
          onClick={() => setActiveTab('scan')}
        >
          <span className="psd-nav__icon">⊙</span>
          <span>扫描</span>
        </button>
        <button
          className={`psd-nav${activeTab === 'workorder' ? ' psd-nav--active' : ''}`}
          type="button"
          disabled={!workOrder}
          onClick={() => setActiveTab('workorder')}
        >
          <span className="psd-nav__icon">≡</span>
          <span>工单编辑</span>
          {workOrderDirty && <small>●</small>}
          {workOrder && <small>{enabledCount}</small>}
        </button>
        <button
          className={`psd-nav${activeTab === 'apply' ? ' psd-nav--active' : ''}`}
          type="button"
          disabled={!workOrder}
          onClick={() => setActiveTab('apply')}
        >
          <span className="psd-nav__icon">▶</span>
          <span>应用输出</span>
          {workOrder && <small>{changedCount}</small>}
        </button>
        <button
          className={`psd-nav${activeTab === 'translate' ? ' psd-nav--active' : ''}`}
          type="button"
          disabled={!workOrder}
          onClick={() => setActiveTab('translate')}
        >
          <span className="psd-nav__icon">AI</span>
          <span>AI 翻译</span>
          <small className="psd-nav__beta">预留</small>
        </button>
      </ResizableAppSidebar>

      <main className="psd-panel">
        <p role="status">executionSource: mock · 所有图层、授权与结果均为固定演示数据，不读取或修改真实文件。</p>
        <p>使用右侧运行状态中的预览控制推进任务。关闭窗口只会停止观察；任务终态以任务中心为准。</p>
        {task.jobId && <button type="button" className="mt-btn" disabled={task.cancelling} onClick={() => void task.cancel()}>{task.cancelling ? '请求取消中…' : '取消当前任务'}</button>}
        {task.cancelMessage && <p role="status">{task.cancelMessage}</p>}
        {inputGrant.message && <p role="status">{inputGrant.message}</p>}
        {/* 顶部文件栏 */}
        <form className="psd-form" onSubmit={scan}>
          <label className="mt-field">
            <span>模拟 PSD / PSB 路径</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                value={inputGrant.displayPath}
                onChange={(e) => { inputGrant.setDisplayPath(e.target.value); if (inputGrant.grantId) inputGrant.clearGrant() }}
                placeholder="/Workspace/PSD/document.psd"
                readOnly={!!inputGrant.grantId}
                style={{ flex: 1 }}
              />
              {inputGrant.grantId && (
                <button type="button" className="mt-btn" onClick={inputGrant.clearGrant} title="清除授权">✕</button>
              )}
              <button type="button" className="mt-btn" onClick={inputGrant.importExternal} title="使用固定夹具模拟文件授权">模拟选择文件</button>
            </div>
          </label>
          <button className="mt-btn mt-btn--primary" type="submit" disabled={!inputGrant.displayPath.trim() || scanning || applying}>
            {scanning ? '扫描中...' : '模拟扫描'}
          </button>
        </form>

        {scanError && <div className="psd-message psd-message--error">{scanError}</div>}

        <PsdPanels
          activeTab={activeTab}
          workOrder={workOrder}
          scanError={scanError}
          workOrderDirty={workOrderDirty}
          saving={saving}
          saveMessage={saveMessage}
          onSaveWorkOrder={() => void saveWorkOrder()}
          onUpdateRecord={updateRecord}
          changedCount={changedCount}
          applying={applying}
          applyResult={applyResult}
          onApply={apply}
          outputGrant={outputGrant}
          targetLanguage={targetLanguage}
          onTargetLanguageChange={setTargetLanguage}
          customPrompt={customPrompt}
          onCustomPromptChange={setCustomPrompt}
        />
      </main>
    </div>
  )
}
