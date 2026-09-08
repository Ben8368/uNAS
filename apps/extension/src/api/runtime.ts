export type ApiRuntimeMode = 'demo'

type WindowStatusTone = 'online' | 'offline' | 'pending'

export type ApiRuntimePresentation = {
  mode: ApiRuntimeMode
  isReal: boolean
  modeLabel: string
  serviceBadge: string
  taskSubmitEndpoint: string
  windowStatus: {
    tone: WindowStatusTone
    label: string
    detail: string
  }
  shutdown: {
    confirm: string
    fallbackError: string
    completeTitle: string
    completeBody: string
    webModeUnavailable: string
  }
  settings: {
    initialNotice: string
    accountNotice: string
    serviceNotice: string
    toolbarDescription: string
    workspaceDescription: string
    behaviorTitle: string
    updateNotice: string
    connectionNotice: string
  }
  logsDescription: string
}

export function getApiRuntimeMode(): ApiRuntimeMode {
  return 'demo'
}

export function isRealApiRuntime(): boolean {
  return false
}

export function getApiRuntimePresentation(): ApiRuntimePresentation {
  return {
    mode: 'demo',
    isReal: false,
    modeLabel: '独立演示模式',
    serviceBadge: '演示数据已启用',
    taskSubmitEndpoint: '浏览器内演示数据',
    windowStatus: {
      tone: 'online',
      label: 'DEMO DATA',
      detail: '此独立副本不连接本地 API、worker 或桌面能力。',
    },
    shutdown: {
      confirm: '独立演示版没有本地服务；此操作只会显示演示提示。继续？',
      fallbackError: '独立演示版没有可关闭的本地服务。',
      completeTitle: '演示版仍在运行',
      completeBody: '当前页面没有设备控制能力。',
      webModeUnavailable: '当前演示不包含设备控制或后台任务能力。',
    },
    settings: {
      initialNotice: '独立演示模式：界面使用浏览器内置样例数据；外观偏好仍会保存到此浏览器。',
      accountNotice: '独立演示版不包含账户与身份服务。',
      serviceNotice: '当前演示不连接远程服务。',
      toolbarDescription: '当前是可独立运行的前端演示，数据均为本地样例。',
      workspaceDescription: '文件、下载与任务列表仅展示演示数据，不会读写本机工作区。',
      behaviorTitle: '演示状态',
      updateNotice: '独立演示版不检查更新。',
      connectionNotice: '浏览器内置演示数据可用。',
    },
    logsDescription: '查看浏览器内置的演示任务事件和通知。',
  }
}
