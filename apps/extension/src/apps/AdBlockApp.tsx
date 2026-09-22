import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react'
import { readAdBlockingStatus, refreshAdBlockingStatus, type BlockingStatus } from 'unas-src/runtime/adBlocking'
import 'unas-src/styles/adblock.css'

const stateLabels: Record<BlockingStatus['state'], string> = {
  'baseline-only': '基础规则运行中',
  ready: '拦截规则已就绪',
  stale: '订阅更新异常，保留已有规则',
  error: '订阅加载失败，基础规则仍在运行',
}

export function AdBlockApp() {
  const [status, setStatus] = useState<BlockingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void readAdBlockingStatus().then((next) => {
      if (!active) return
      setStatus(next)
      setUnavailable(next === null)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : '读取拦截状态失败，请重试。')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const refresh = () => {
    setError('')
    setLoading(true)
    void refreshAdBlockingStatus().then((next) => {
      setStatus(next)
      setUnavailable(next === null)
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : '更新拦截规则失败，请重试。')
    }).finally(() => setLoading(false))
  }

  return (
    <main className="adblock-app" aria-label="广告拦截管理">
      <div className="adblock-content">
        <header className="adblock-toolbar">
          <div><h2>拦截概览</h2><p>查看浏览器中的广告拦截规则状态。</p></div>
          <button type="button" className="mt-btn" disabled={loading || unavailable} onClick={refresh}>
            <RefreshCw size={20} aria-hidden="true" />{loading ? '正在更新…' : '检查更新'}
          </button>
        </header>
        {loading && <p role="status">正在读取扩展拦截状态…</p>}
        {error && <p role="alert">{error}{status && ' 当前保留上次读取的状态。'}</p>}
        {unavailable && <section className="adblock-section"><h3>广告拦截能力未接入</h3><p>当前为 Web 预览，无法读取真实拦截状态。请在已安装的 uNAS 扩展新标签页中打开“广告拦截”。</p></section>}
        {status && <>
          <section className="adblock-section" aria-labelledby="adblock-state">
            <h3 id="adblock-state"><ShieldCheck size={20} aria-hidden="true" />{stateLabels[status.state]}</h3>
            <p>来源：扩展实时状态。关闭此窗口不会关闭广告拦截。</p>
            {status.error && <div className="adblock-notice adblock-notice--warning" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{status.error}</span>
            </div>}
            <dl className="adblock-facts">
              <div><dt>基础规则</dt><dd>{status.baselineRuleCount.toLocaleString('zh-CN')} 条</dd></div>
              <div><dt>订阅规则</dt><dd>{status.ruleCount.toLocaleString('zh-CN')} 条</dd></div>
              <div><dt>订阅更新时间</dt><dd>{status.updatedAt === undefined ? '尚无成功更新记录' : new Date(status.updatedAt).toLocaleString('zh-CN')}</dd></div>
            </dl>
            <p>以上为已加载的网络规则数量，不代表实际拦截次数或全部页面隐藏规则。</p>
          </section>
          <section className="adblock-section"><h3>站点暂停</h3><p>在需要调整的网站点击浏览器工具栏中的 uNAS 图标，通过页面浮层暂停或恢复该站点的广告拦截。</p></section>
        </>}
      </div>
    </main>
  )
}
