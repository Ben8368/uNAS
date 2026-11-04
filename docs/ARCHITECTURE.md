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
| New Tab extension page | Desktop、搜索、Link App、按需 App 窗口与任务摘要 | 多实例、短寿命；通过逻辑 Workspace 访问任务 |
| Workspace extension page | 兼容工具入口；真实任务运行面待探针 | 不由启动器自动创建；关闭后不保证任务继续 |
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

## 4. 仓库结构与扩展点

按运行面与职责划分，不为每个目录建立 workspace 包：

```text
apps/extension/
├── entrypoints/              WXT 页面、background/content 的薄启动入口
├── contracts/               宿主内稳定类型与消息契约（#contracts）
├── src/
│   ├── shell/               Desktop 与 App 宿主，不承载业务实现
│   │   ├── app/             页面 bootstrap / composition
│   │   ├── apps/            appCatalog 纯元数据 + appRegistry 懒加载组合
│   │   ├── desktop/         桌面布局与快捷方式
│   │   ├── launcher/        搜索和启动器交互
│   │   ├── navigation/      Dock 与全局入口
│   │   ├── windows/         窗口状态、几何、生命周期与内容宿主
│   │   └── right-panel/     状态抽屉
│   ├── features/            App 业务，跨模块仅消费公开入口
│   ├── platform/            浏览器、文件、存储、Workspace 的 port/adapter
│   └── shared/              无上层依赖的图标、控件、样式和通用能力
├── public/                  随扩展打包的静态资源
└── e2e/                     解包 MV3 浏览器回归
packages/password-compat/    既有密码兼容实现，仅通过明确 public export 接入
scripts/                    治理、边界、素材生成与质量门禁
assets/                     素材来源、哈希与分发约束
benchmarks/                 真实能力探针与证据
```

- App 名称、顺序、状态与入口可见性只在 `shell/apps/appCatalog.ts` 声明；Desktop、启动器和窗口状态只读目录，不导入组件加载实现。
- `shell/apps/appRegistry.ts` 将目录与 feature 公开入口的 lazy 组件组合，只有 WindowContainer 消费；新增 App 必须同时满足契约 ID、目录与实现映射，状态标签不代表能力验证。
- `shared/icons` 维护图标路径与渲染，`shared/styles/app-icons.css` 维护尺寸和形状；各 surface 不再各自实现加载失败回退。素材由仓库脚本生成并记录来源，不拉取远端图标。
- 结构边界由 `scripts/architecture-boundary-check.mjs` 校验；`src` 不新增含义模糊的顶层分类桶，不允许 shared 反向引用 shell/feature。
- 未来只有真实复用与 Gate 需要时，才抽出 `packages/contracts/core/application/app-runtime/design-system` 等包；引擎与 Worker 按各自探针落地，不预建空包或把目录存在当能力实现。

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
  → 当前页 App 窗口 → 连接单个逻辑 Workspace Owner
    → Task Core
      → Dedicated Worker
```

- New Tab 按需显示 Tool App 与任务 projection，不直接持有引擎、File handle 或未提交输出。
- 内置 App 在当前标签页打开；同一 `single` App 不重复创建窗口。逻辑 Workspace 不要求新建可见标签页，见 ADR 0007。
- Phase 1 首次使用工具的页面建立 mock owner；其他同源页面经受限 BroadcastChannel 调用 owner。Web Lock 保证唯一 owner，客户端不各自执行任务或维护可写模拟文件树。
- Workspace 使用 lease/owner ID 防止刷新或多标签重复执行同一任务。
- Workspace 关闭前提示运行中任务；关闭、崩溃或扩展更新不能伪装为取消成功。
- owner 关闭或通信超时后禁止继续操作或自动重放；普通客户端关闭不影响 owner。真实 Worker 生命周期仍需探针，mock 不代表真实长任务恢复能力。
- Service Worker 负责工具栏入口并拒绝旧版跨标签启动消息，不靠全局变量保存任务。

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

Files 的 WebDAV 文件、浏览器下载记录与缓存 ports 按 [ADR 0015](ADR/0015-file-manager-dav-cache.md) 隔离；受控 FileRef 与分段读取见 [ADR 0017](ADR/0017-unified-file-read-preview.md)。WebDAV 配置与认证由项目共享连接服务按 [ADR 0023](ADR/0023-project-webdav-connections.md) 管理；Files 只在当前 Owner 页面内存持有已获取的会话，校验配置修订与权限，页面退出释放；Vault Key 不进入 Files。远程写入以 Web Lock 防并发。下载面板只列 Chrome 下载记录并由浏览器定位文件，不获取目录句柄；缓存仅操作自身 OPFS 子目录、以随机 ID 引用并受预算/过期控制。缓存不进入密码模块或跨页消息，也不是永久文件库。

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
- 浏览器下载 adapter 只负责把可直接下载的 HTTPS 文件交给 Chrome downloads API；HLS/DASH 分片抓取、合并和音视频 mux 属于 Media 模块，不由浏览器下载 API 完成。
- ffmpeg.wasm 是兼容路径，不等同原生 FFmpeg；只随扩展固定打包，不从 CDN 执行。
- 多线程、SharedArrayBuffer、cross-origin isolation、扩展 CSP 和内存上限由真机探针决定。
- 长视频、高分辨率、特殊 codec 和复杂滤镜在无证据时为计划外或实验性。

## 11. 权限与消息

私有预览迁移按 [ADR 0008](ADR/0008-private-preview-modern-chrome.md) 原生 Chrome 优先：`browser.*` 集中在扩展 adapter，UI/application contract 不依赖命名空间。异步请求以单一 Promise 路径为目标，不为未服务的旧版本保留永久双实现；schema、所有权和传输边界保持不变。

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

## 13. uNAS 密码管家与广告拦截模块边界

uNAS 的唯一 WXT Background Entry 同时初始化 Workspace、密码管家与广告拦截服务：

```text
New Tab / Workspace / page overlay
                 ↓
      unified extension message router
          ┌──────┴─────────┐
       adblock          password-manager services
          ↓                  ↓
      DNR + CSS       WebDAV + encrypted cache
                             ↓
                     optional Legacy adapter
```

- `entrypoints/adblock.content.ts` 只处理 cosmetic rules；`content-script.js` 和 `page-overlay.js` 是用户触发的 unlisted scripts，分别用于一次性填充和页面浮层。
- 自维护补充规则按 [ADR 0012](ADR/0012-repository-filter-subscription.md) 独立于第三方订阅更新；仓库 JSON 同时为随包快照，缓存通过校验后按 host 精确合并到页面规则，不引入远程代码。
- `installPasswordManagerBackground()` 与 `installAdBlockBackground()` 各自只注册自己的生命周期/消息处理器，统一路由在扩展 adapter 中做来源、页面与动作分流。密码消息不能由普通网页触发，广告 content script 不能调用 Vault 操作。
- `apps/extension/src/features/password-manager/background/vault/` 的 Vault core、encrypted cache 和 sync engine 不依赖广告模块；WebDAV backend 通过 `platform/webdav/client.ts` 复用独立传输层（[ADR 0014](ADR/0014-shared-webdav-transport.md)）。密码兼容实现是内部 workspace 包 `packages/password-compat`，无外部项目的同步或发布关系（[ADR 0021](ADR/0021-unas-only-brand.md)）。`legacy/adapter.ts` 是唯一依赖入口，只能通过包的 `exports` 导入 `@unas/password-compat/legacy`，集中安装旧凭据来源和登录/Jupiter 生命周期；`scripts/architecture-boundary-check.mjs` 禁止深导入 `packages/password-compat/src/*` 与其他消费者。`credential-core.wasm` 是 `packages/password-compat/credential-core` 的已跟踪派生产物，出处由 `pnpm password-compat:wasm:provenance` 校验。详见 [ADR 0021](ADR/0021-unas-only-brand.md)。`apps/extension/src/features/adblock/` 只依赖 DNR、规则存储和 cosmetic content bridge。
- 密码管家通过 App Registry 在 uNAS Desktop 窗口内提供 Vault 管理页，同时保留用户主动打开的既有 closed Shadow DOM 密码浮窗；独立 `manage.html` 只承担旧入口和恢复/排障兼容职责。两者共享 Vault Core，不共享明文状态或 CSS 运行时。

## 14. 扩展源码分层

`apps/extension/src` 只有 `shell/`（桌面壳）、`features/<name>/`（有业务 owner 的能力）、`platform/<area>/`（浏览器、扩展、存储、WebDAV 等环境实现）和 `shared/`（多 feature 共用且无 owner）四个顶层目录；`contracts/` 与 `entrypoints/` 保持 WXT 约定位置。platform 区域顶层文件是 port，`real/` 与 `test-support/` 是私有实现；feature 之间和 shell 只能经 public entry 引用。后台消息由 `platform/extension/router.ts` 表驱动分发，发送方策略在 `sender-policy.ts`，App Registry 只声明元数据与懒加载入口。规则由 `pnpm check:architecture` 强制，依据与取舍见 [ADR 0020](ADR/0020-extension-source-taxonomy.md)。
