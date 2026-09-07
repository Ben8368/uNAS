import { demoApi } from 'unas-src/api/demo'
import { setApiClient } from 'unas-src/api/client'
import type { DemoSnapshot, UnasDemoApi } from 'unas-src/api/types'
import { claimWorkspace } from './workspaceSession'
import { writeProjection } from './demoProjection'
import { MAX_MESSAGE_BYTES, WORKSPACE_CHANNEL, validCall, validMessage, type SessionMessage } from './workspaceProtocol'

export type WorkspaceSessionState = 'idle' | 'pending' | 'owner' | 'client' | 'unavailable' | 'lost'
type Pending = { finish: (error?: Error, value?: unknown) => void; timer: ReturnType<typeof setTimeout> }

/** A single mock owner, with same-origin clients. No engine work or remote content. */
export function createInlineWorkspace() {
  let state: WorkspaceSessionState = 'idle'
  let channel: BroadcastChannel | undefined
  let release: (() => void) | undefined
  let unsubscribe: (() => void) | undefined
  let watchdog: ReturnType<typeof setInterval> | undefined
  let connecting: Promise<void> | undefined
  let lastSeen = 0
  let owner = ''
  let self = ''
  let stopped = false
  let sequence = 0
  let snapshot = demoApi.getDemoSnapshot()
  const listeners = new Set<() => void>()
  const observers = new Set<() => void>()
  const pending = new Map<string, Pending>()
  const seen = new Set<string>()
  let queued = 0
  let joining = false
  let queue = Promise.resolve()
  const notify = () => { for (const listener of listeners) listener() }
  const report = (next: WorkspaceSessionState) => { state = next; for (const listener of observers) listener() }
  const post = (message: Omit<SessionMessage, 'version' | 'sender'>) => {
    const packet = { ...message, version: 2 as const, sender: self }
    if (JSON.stringify(packet).length > MAX_MESSAGE_BYTES) throw new Error('Workspace 消息超过本地预算。')
    channel?.postMessage(packet)
  }
  function lose() {
    if (state !== 'client') return
    report('lost')
    for (const request of pending.values()) request.finish(new Error('Workspace owner 已关闭或连接超时；操作结果未确认，请勿自动重试。'))
    notify()
  }
  function sync() {
    snapshot = demoApi.getDemoSnapshot()
    writeProjection(snapshot)
    window.removeEventListener('beforeunload', beforeUnload)
    if (snapshot.hasPendingUserTasks) window.addEventListener('beforeunload', beforeUnload)
    post({ type: 'snapshot', owner, snapshot })
    notify()
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    if (state === 'owner' && demoApi.getDemoSnapshot().hasPendingUserTasks) { event.preventDefault(); event.returnValue = '' }
  }
  function call(method: string, values: unknown[]): Promise<unknown> {
    const signal = values.find(value => value instanceof AbortSignal) as AbortSignal | undefined
    const args = values.filter(value => !(value instanceof AbortSignal))
    while (args.length && args.at(-1) === undefined) args.pop()
    if (signal?.aborted) return Promise.reject(signal.reason)
    if (!validCall(method, args)) return Promise.reject(new Error('此操作不在跨标签 Workspace 允许列表中。'))
    if (pending.size >= 64) return Promise.reject(new Error('Workspace 请求过多，请稍后重试。'))
    const id = `${self}:${++sequence}`
    return new Promise((resolve, reject) => {
      const abort = () => finish(new Error('Workspace 请求已取消；已提交操作不会自动重放。'))
      const finish = (error?: Error, value?: unknown) => {
        const request = pending.get(id)
        if (!request) return
        clearTimeout(request.timer); pending.delete(id); signal?.removeEventListener('abort', abort)
        if (error) reject(error); else resolve(value)
      }
      const timer = setTimeout(() => finish(new Error('Workspace 请求超时；操作结果未确认，请刷新状态后再试。')), 5000)
      pending.set(id, { finish, timer }); signal?.addEventListener('abort', abort, { once: true })
      try { post({ type: 'call', owner, target: owner, id, method, args }) }
      catch (error) { finish(error instanceof Error ? error : new Error(String(error))) }
    })
  }
  const client = new Proxy(demoApi, {
    get(target, key: keyof UnasDemoApi) {
      if (key === 'getDemoSnapshot') return () => structuredClone(snapshot)
      if (key === 'subscribeDemo') return (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
      // These always reject real output; keep their synchronous API contract.
      if (key === 'filebrowserFileDownloadUrl' || key === 'getFetchTaskFileUrl') return target[key]
      return (...args: unknown[]) => {
        if (state !== 'client') throw new Error('Workspace 连接已中断；请重新连接后操作。')
        if (['resetDemoScenario', 'advanceDemoScenario', 'interruptDemoTasks'].includes(key)) throw new Error('场景控制仅在 Workspace owner 页面可用。')
        return call(key, args)
      }
    },
  }) as UnasDemoApi

  function receive(event: MessageEvent<unknown>) {
    if (!validMessage(event.data)) return
    const message = event.data
    if (message.sender === self || message.target && message.target !== self) return
    if (state === 'owner') {
      if (message.type === 'hello') { post({ type: 'snapshot', target: message.sender, owner, snapshot: demoApi.getDemoSnapshot() }); return }
      if (message.type !== 'call' || message.owner !== owner || !message.id || seen.has(message.id)) return
      if (seen.size >= 10000) { post({ type: 'result', owner, target: message.sender, id: message.id, error: 'Workspace 会话请求预算已用尽，请结束任务后重新开始。' }); return }
      if (queued >= 64) { post({ type: 'result', owner, target: message.sender, id: message.id, error: 'Workspace 请求队列已满，请稍后重试。' }); return }
      seen.add(message.id)
      queued++
      queue = queue.then(async () => {
        if (stopped || state !== 'owner') return
        try {
          const method = demoApi[message.method as keyof UnasDemoApi] as (...args: unknown[]) => unknown
          const value = await method(...message.args!)
          post({ type: 'result', owner, target: message.sender, id: message.id, value })
        } catch (error) {
          post({ type: 'result', owner, target: message.sender, id: message.id, error: error instanceof Error ? error.message : 'Workspace 操作失败' })
        }
      }).catch(() => {}).finally(() => { queued-- })
    } else if ((state === 'pending' && joining || state === 'client') && message.sender === message.owner && (!owner || owner === message.owner)) {
      if (message.type === 'snapshot') {
        const changed = state !== 'client' || snapshot.revision !== message.snapshot!.revision || snapshot.scenarioId !== message.snapshot!.scenarioId
        owner = message.owner; snapshot = message.snapshot!; lastSeen = Date.now()
        setApiClient(client); report('client'); if (changed) notify()
      } else if (message.type === 'result' && state === 'client') {
        lastSeen = Date.now()
        pending.get(message.id!)?.finish(message.error ? new Error(message.error) : undefined, message.value)
      } else if (message.type === 'closed') lose()
    }
  }

  function close() {
    if (stopped) return
    stopped = true
    if (state === 'owner') {
      demoApi.interruptDemoTasks()
      writeProjection(demoApi.getDemoSnapshot(), 'closed')
      try { post({ type: 'closed', owner }) } catch { /* Page teardown still releases ownership. */ }
    }
    for (const request of pending.values()) request.finish(new Error('Workspace 连接已关闭。'))
    unsubscribe?.(); release?.(); channel?.close()
    if (watchdog) clearInterval(watchdog)
    window.removeEventListener('beforeunload', beforeUnload)
    window.removeEventListener('pagehide', close)
    // A BFCache-restored document must not reuse a released owner or closed channel.
    if (state === 'owner' || state === 'client') report('lost')
  }
  async function connect() {
    if (state === 'owner' || state === 'client') return
    if (state === 'lost') throw new Error('原 Workspace 已中断。请关闭此工具并刷新页面后重新开始；不会自动恢复任务。')
    if (connecting) return connecting
    connecting = new Promise<void>((resolve, reject) => {
      if (!navigator.locks || typeof BroadcastChannel === 'undefined') { report('unavailable'); reject(new Error('浏览器缺少 Workspace 所有权或同源通信能力。')); return }
      stopped = false; joining = false; self = crypto.randomUUID(); owner = ''; report('pending')
      channel = new BroadcastChannel(WORKSPACE_CHANNEL); channel.onmessage = receive
      window.addEventListener('pagehide', close)
      const timer = setTimeout(() => { done(); close(); report('unavailable'); reject(new Error('Workspace 连接超时，请重试。')) }, 5000)
      const done = () => { clearTimeout(timer); observers.delete(check) }
      const check = () => {
        if (state === 'owner' || state === 'client') { done(); resolve() }
        else if (state === 'unavailable') { done(); close(); reject(new Error('Workspace 所有权不可用。')) }
      }
      observers.add(check)
      release = claimWorkspace(navigator.locks, result => {
        if (result === 'owner') {
          owner = self; setApiClient(demoApi); report('owner')
          unsubscribe = demoApi.subscribeDemo(sync); sync()
        } else if (result === 'conflict') { joining = true; post({ type: 'hello', owner: '' }) }
        else report('unavailable')
      })
      watchdog = setInterval(() => {
        if (state === 'client') {
          if (Date.now() - lastSeen > 15000) { lose(); return }
          post({ type: 'hello', owner })
        } else if (state === 'pending') post({ type: 'hello', owner: '' })
      }, 1000)
    }).finally(() => { connecting = undefined })
    return connecting
  }
  return { connect, close, getState: () => state, subscribe: (listener: () => void) => { observers.add(listener); return () => { observers.delete(listener) } } }
}

export const inlineWorkspace = createInlineWorkspace()
