# App 与启动契约

本文定义新标签页桌面中的 App 类型、注册、启动、文件关联、权限和生命周期。它是 UI 与 App Runtime 之间的稳定语义，不是最终 TypeScript 源码。

## 1. App 类型

| 类型 | 来源 | 能力 |
| --- | --- | --- |
| `system` | 随扩展打包 | Desktop、Files、Task Center、Settings 等系统能力 |
| `tool` | 随扩展打包 | Image、Media、PDF、Archive 等受控文件处理界面 |
| `link` | 用户声明式注册 | 只保存名称、图标和 HTTPS URL，点击后跳转网页 |

V1 不存在下载后执行的第三方 App、远程模块、用户脚本或 iframe App。`link` 不是插件，不获得文件、任务、浏览历史或扩展权限。

## 2. 概念模型

```ts
type AppKind = 'system' | 'tool' | 'link'
type AppSurface = 'window' | 'workspace' | 'external-tab'

interface AppManifest {
  schemaVersion: 1
  id: string
  kind: AppKind
  name: string
  icon: IconRef
  launch: {
    surface: AppSurface
    route?: string
    url?: string
    instance: 'single' | 'multiple'
  }
  accepts?: FileAcceptRule[]
  capabilities: AppCapability[]
}
```

- 内置 manifest 来自受版本控制的静态注册表。
- Link App 只能生成受限 manifest；`capabilities` 必须为空，`surface` 必须是 `external-tab`。
- `id` 在更新和布局持久化中稳定；显示名称和图标可以变化。
- `route` 必须命中扩展内 allowlist，不能由外部消息提供任意扩展路径。
- Link URL 只接受 `https:`，本地开发例外不进入发布构建；拒绝 `javascript:`、`data:`、`file:`、`chrome:` 和 `chrome-extension:`。

## 3. App 生命周期

```text
registered → launching → active ↔ background → closed
                    └──────────────→ failed
```

- `single` App 再次启动时聚焦已有实例，不创建重复任务所有者。
- Window 关闭只关闭 UI；是否取消任务由 Task Contract 和用户确认决定。
- 新标签页可以有多个 Desktop Client，但同一真实任务只有一个 Workspace Owner。
- 页面刷新只能恢复可持久化的布局、manifest、任务摘要和可重新取得的文件能力。

## 4. Intent 与文件关联

```ts
interface OpenIntent {
  schemaVersion: 1
  id: string
  source: 'desktop' | 'files' | 'drop' | 'extension-command'
  appId?: string
  files?: FileRef[]
  action?: string
}
```

- Desktop/App Host 解析 Intent；文件视图不能直接 import 某个 Tool App 的内部组件。
- `accepts` 只是候选匹配，不证明文件真实格式；引擎仍需探测 magic/container。
- 用户始终可以看到将打开的 App，并在多个候选之间选择。
- Link App 不参与本地文件关联。

## 5. Capability 边界

App 通过 capability token 或 application service 访问资源：

- `files.read-selected`
- `files.write-export`
- `tasks.create`
- `tasks.observe-own`
- `workspace.temp`
- `settings.read-own`

Token 必须绑定 App、用户动作、资源和有效期。App 不直接持有全局 Chrome API、OPFS 根目录或其他 App 的任务对象。

## 6. Demo 与真实运行时

- Phase 1 的 App Registry、Intent、窗口和文件关联使用与真实运行时相同的 schema。
- Mock runtime 必须标记 `executionSource: 'mock'`，不得产生可被误认作真实处理的输出文件。
- Phase 3 起，真实 capability adapter 按 App 逐项替换 mock；UI 不因替换而改变 AppManifest 或 Intent 语义。
- Demo 截图、视频和验收说明必须出现“演示数据/能力未接入”声明。

## 7. 版本与迁移

- manifest、Intent 和持久化布局均带 `schemaVersion`。
- 未知字段不静默执行；未知 App 或失效 Link App 显示可恢复错误。
- 删除内置 App 前提供布局和文件关联迁移；用户 Link App 支持导出/导入时需独立安全设计。
- App Contract 的破坏性变化需要 contract tests、迁移说明和 ADR 评审。
