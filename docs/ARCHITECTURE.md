# 目标架构

## 1. 架构目标

uNAS 是扩展原生、本地优先、前端先行的 TypeScript monorepo。Manifest V3 扩展是唯一产品；New Tab 提供轻量 Desktop Shell，Workspace 承载内置工具和长任务，重计算在 Dedicated Worker 内通过 adapter 使用 Web API、JavaScript 库或随包 WASM。

架构必须同时满足：

- 前端 Demo 可以在没有真实引擎时完整演示产品，但不能制造能力事实。
- New Tab 快速、可多实例；真实任务只有一个明确 Workspace Owner。
- System/Tool/Link App 使用统一 App Contract，Link App 永远无文件和扩展特权。
- UI、扩展特权、文件系统和计算引擎通过 port/adapter 隔离。
- 真实能力由运行时探针和固定夹具决定，不由 UI、类型或库文档决定。

## 2. 扩展运行面

| Surface | 主要职责 | 生命周期假设 |
| --- | --- | --- |
| New Tab extension page | Desktop、搜索、Link App、启动与任务摘要 | 多实例、短寿命、必须轻量 |
| Workspace extension page | Files、Tool App、真实任务与结果 | 启动或复用；关闭后不保证任务继续 |
| Service Worker | 安装、命令、菜单、窗口/标签复用、消息路由 | 随时可能终止，关键状态必须持久化 |
| Content Script | 用户触发的网页上下文桥 | 不默认全站注入，不拥有任务状态 |
| Offscreen Document | 经探针证明必要的受限 DOM 场景 | 可选，不是常驻主程序 |
| Dedicated Worker | 格式探测、计算、打包和验证 | 由 Workspace 管理，终态清理 |

V1 不存在独立 `apps/web`、PWA、传统桌面进程、Native Helper 或服务端任务运行时。

## 3. 逻辑分层

```text
New Tab / Workspace UI
        │ AppIntent / user command / projection
        ▼
Desktop + App Runtime + Application Services
        │ App / File / Task ports
        ▼
Contracts + Task Core + Capability Planner
        │
        ├── Mock Runtime                 Phase 1
        └── Worker Runtime               Phase 3+
                │ ExecutionPlan + resource lease
                ├── Image adapter
                ├── Archive adapter
                ├── PDF adapter
                └── Media adapter
        ▼
Chrome storage / IndexedDB / OPFS / user-granted handles / download fallback

Service Worker + Content Script
        └── validated messages → Application Services
```

固定依赖方向：Entrypoint → Screen → Application Port → Contract/Core → Adapter。下层不导入 React、WXT 页面组件、Desktop store 或 App View。

## 4. 规划仓库结构

```text
apps/
└── extension/
    ├── entrypoints/
    │   ├── newtab/
    │   ├── workspace/
    │   ├── background/
    │   ├── content/
    │   └── offscreen/        仅在探针批准后
    └── app/
packages/
├── app-contracts/            AppManifest、Intent、窗口与文件关联
├── contracts/                File、Task、Progress、Error、消息 schema
├── app-runtime/              注册、启动、实例与 Workspace 所有权
├── desktop-shell/            Desktop、Dock、Window、Command Palette
├── design-system/            token、primitive、system component
├── application/              Files/Tasks/Settings 用例与 ports
├── mock-runtime/             确定性 Demo adapters
├── core/                     Job 状态机、planner、策略、资源预算
├── capabilities/             浏览器、codec、存储与扩展能力探针
├── file-system/              File/Handle/IndexedDB/OPFS/导出 adapters
├── engine-image/
├── engine-archive/
├── engine-pdf/
└── engine-media/
workers/
├── image/
├── archive/
├── pdf/
└── media/
scripts/                      治理、视觉、基准、供应链和发布检查
fixtures/                     小型、可授权、带 manifest 的固定夹具
```

目录是目标边界，不代表当前已经创建或依赖已锁定。前端 Demo 只创建当前 Gate 允许的最小包。

## 5. 前端先行的替换缝

Phase 1 使用与真实运行时相同的 application ports：

```text
AppRegistryPort
FileWorkspacePort
TaskCommandPort
TaskQueryPort
SettingsPort
CapabilityPort
```

- Mock adapter 返回固定 scenario，并标记 `executionSource: mock`。
- Real adapter 在后续阶段逐项替换，不修改 Screen 的公共调用语义。
- capability 不可用时返回原因、限制和替代，不让 UI 猜测浏览器或格式。
- Demo build 不包含 engine/WASM，也不申请未来权限。

具体前端规则见 [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md)。

## 6. New Tab、Workspace 与任务所有权

```text
多个 New Tab Client
  → 查找/打开/聚焦单个 Workspace Owner
    → Task Core
      → Dedicated Worker
```

- New Tab 只显示任务 projection，不持有 Worker、File handle 或未提交输出。
- Tool App 启动时进入或聚焦 Workspace；同一 `single` App 不重复创建实例。
- Workspace 使用 lease/owner ID 防止刷新或多标签重复执行同一任务。
- Workspace 关闭前提示运行中任务；关闭、崩溃或扩展更新不能伪装为取消成功。
- Service Worker 只负责发现上下文和传递版本化消息，不靠全局变量保存任务。

## 7. App 与桌面运行时

- App 类型、manifest、Intent 和 capability 见 [APP_CONTRACT.md](APP_CONTRACT.md)。
- Desktop state 只保存布局、窗口、Dock、主题与 App 实例摘要。
- Tool App 通过 application service 创建 `TaskSpec`；不直接选择 WebCodecs、WASM 或具体库。
- Link App URL 经过 schema 与 scheme allowlist 校验，使用浏览器标签页打开。
- 窗口系统在 Wide 模式可移动/调整尺寸；Regular 模式切换为单主视图或 sheet，不复制两套业务页面。

## 8. 文件与持久化

| 存储 | 用途 | 禁止 |
| --- | --- | --- |
| `chrome.storage` | 设置、Link App、布局、小型摘要 | 文件 Blob、大型索引、敏感原文 |
| IndexedDB | 文件/任务元数据、迁移状态 | 假设等同永久备份 |
| OPFS | 临时输入、分块、中间输出、可清理缓存 | 未经预算长期囤积用户文件 |
| File/Directory Handle | 用户明确授权的真实读写 | 扩大到未授权目录 |
| Download fallback | 兼容导出 | 假装完成原子覆盖 |

文件 contract 不传本机绝对路径。FileRef 使用不透明 ID、来源、授权状态和受控 token。恢复只恢复元数据和可重新取得的能力；权限失效时要求用户重新授权。

## 9. 真实任务运行流

```text
OpenIntent
  → Intake 生成 FileRef
  → Validator 探测 magic/container 与资源预算
  → Capability Planner 生成 ExecutionPlan
  → Workspace Scheduler 获取资源 lease
  → Dedicated Worker + Adapter 执行
  → staged output
  → Result Validator
  → Export/Commit
  → 终态清理临时资源
```

只有输出验证和提交都成功才能进入 `succeeded`。取消、失败和页面关闭需要区分；契约见 [ENGINE_CONTRACT.md](ENGINE_CONTRACT.md)。

## 10. 能力与媒体策略

- Image/ZIP/PDF/Media 各自有独立 adapter 和能力 Gate。
- WebCodecs 只提供编解码原语，demux/mux、时间戳、profile 和音视频同步需单独验证。
- ffmpeg.wasm 是兼容路径，不等同原生 FFmpeg；只随扩展固定打包，不从 CDN 执行。
- 多线程、SharedArrayBuffer、cross-origin isolation、扩展 CSP 和内存上限由真机探针决定。
- 长视频、高分辨率、特殊 codec 和复杂滤镜在无证据时为计划外或实验性。

## 11. 权限与消息

- required permissions 保持最小；可选权限只在用户触发对应功能时请求。
- New Tab、Workspace、Service Worker、Content Script 之间使用版本化 schema，校验 sender、origin、App、任务所有权和 payload 大小。
- Content Script 发来的消息一律视为不可信，不能触发任意 URL 请求、任意扩展路由或未授权文件操作。
- Web-accessible resources 限制到必要文件与来源；默认不暴露内部 bundle。

## 12. 禁止的依赖与捷径

- React 组件直接 import `chrome.*`、文件系统、codec、PDF、ZIP 或 WASM 实现。
- 在 Service Worker 中运行长计算、计时进度或只靠全局变量维持状态。
- New Tab 初始 chunk 包含 engine/WASM 或依赖网络完成首屏。
- Link App 使用 iframe、远程模块、`eval`、用户脚本或自定义代码。
- adapter 反向依赖 UI store、窗口系统或扩展 entrypoint。
- 用字符串拼接 ffmpeg/native 命令，用 localStorage 保存大文件，或无界复制 ArrayBuffer。
- 以 UA、文件扩展名或 mock 结果代替运行时能力和格式探测。
