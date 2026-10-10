# 当前状态

> **最后确认：** 2026-10-10
> **阶段：** Phase 2 / uNAS native module integration
> **产品代码：** WXT MV3 已接入密码管家、广告拦截、WebDAV Vault、Legacy adapter 和 closed Shadow DOM 浮窗；桌面 App 共用下载外观基线；Files 有 WebDAV 文件实验切片、Chrome 下载记录面板和 OPFS 临时缓存/回收站，边界见 ADR 0015；`manage.html` 兼容保留。

## 当前决策

- uNAS 是产品正式名称，是扩展原生的本地优先新标签页工作区；不另做托管 Web 产品或传统桌面程序。
- 首发浏览器为 Chrome；当前以解包扩展和本地安装验证为准，暂不进入 Chrome Web Store 上架阶段。
- 产品尚未对外开放；已接受 [ADR 0008](docs/ADR/0008-private-preview-modern-chrome.md) 的现代 Chrome 优先方向。扩展声明 Chrome 148 下限，使用原生 `browser.*` 与 Promise 消息响应。
- New Tab 承载轻量 Desktop，内置 App 按需在当前标签页打开，逻辑 Workspace 管理任务所有权（ADR 0007）；System/Tool App 随包发布，Link App 只做 HTTPS 跳转。
- 维护者已确认进入 Frontend Demo 阶段；Demo 以 mock adapter 验证桌面、App、文件和任务流程，并提供 WXT Manifest V3 壳；系统面板使用浏览器能力探针，GPU 不可用时明确降级。
- 维护者已授权前端打磨：优先收敛桌面层级、App 启动入口、状态抽屉、响应式与无障碍；不改变 mock/真实边界。
- 视觉采用原创的 macOS/iPadOS 启发式桌面层级与 Liquid Glass 原则，玻璃限于导航/控制层，并提供无障碍和性能降级。
- uNAS Glass 工作包 A–C 已实现：`window-theme.css` 是主题与材质唯一来源；窗口根承担 blur，正文按内容分组使用可读面；Desktop/Dock/启动器/文件管理器已消费共享 Token。后续 D–E 见 [Development Blueprint](docs/DEVELOPMENT_BLUEPRINT.md#uNAS-glass-后续迁移顺序)。
- 本仓库只维护 uNAS 品牌；密码兼容实现归 `packages/password-compat`，不与其他独立项目同步、导出或发布（[ADR 0021](docs/ADR/0021-unas-only-brand.md)）。
- 密码库后端仅保留 WebDAV，共享传输已下沉（[ADR 0014](docs/ADR/0014-shared-webdav-transport.md)）；Legacy 应用级撤除仍受 [TD-003](docs/TECH_DEBT.md#td-003legacy-密码能力尚未完成应用级解耦) 约束。

## 近期优先级

1. 验收 uNAS Glass D：密码浮窗展示层已接入共享 Token 并保留薄荷绿强调，补目标 Chrome 浮层深浅主题与控件状态人工证据。
2. 实施 uNAS Glass E：补齐浅深主题、减少透明度、真实 Chrome 人工走查与可复现证据归档。
3. 完成 [TD-002](docs/TECH_DEBT.md#td-002全局兼容样式的局部化迁移) 验收：代码迁移、目标 Chrome 测试入口与主要自动回归已补齐，保留真实手势、触控及视觉人工确认后归档。

## 当前阻断与风险

- G1 已确认；SP-04 仍开放 RISK-007，详见 [SP-04](benchmarks/sp-04/README.md)。
- G2-Core 和 PDF/Media/Music 各模块 Gate 未因本轮实现而通过；FileRef、媒体与预览仍为受限实验路径。
- SP-09：KGM v3、NCM、QMC raw-key-footer 已完成 Worker/OPFS Beta 验证；5 个授权 KGM v3 样本通过解码及下载/取消/清理。暂存下载无完成回执；无覆盖或联网。
- SP-09 仍开放 RISK-015：目标 Chrome、owner lease、关页、峰值内存、KGM v5、QMC MMKV/`cex\0`、可再分发夹具未完成。
- 活跃风险以 [RISK_REGISTER.md](docs/RISK_REGISTER.md) 为唯一事实源；Chrome Web Store 更新属于未来 Store Gate。

## 最近验证

- 2026-10-10：署名 hook 已启用，15 项 Git 回归及 `pnpm verify` 通过；见[验收记录](docs/archive/reviews/2026-10-10-git-attribution-hooks.md)。
- 2026-10-09：uNAS 品牌与仓库剥离完成；`pnpm verify`（455 passed/1 skipped；兼容包 184 Node/5 Rust）及 MV3 E2E（105 passed/3 skipped）、Web E2E（8 passed）、系统 Chrome smoke 通过；见[剥离验收](docs/archive/reviews/2026-10-09-unas-brand-independence.md)。Linux CI、真实企业登录与常用 Profile 待补。

## 按需入口

- 产品与路线：[docs/PRODUCT.md](docs/PRODUCT.md)、[docs/ROADMAP.md](docs/ROADMAP.md)
- 前端与设计：[docs/FRONTEND_GUIDE.md](docs/FRONTEND_GUIDE.md)、[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- 架构与契约：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/APP_CONTRACT.md](docs/APP_CONTRACT.md)、[docs/ENGINE_CONTRACT.md](docs/ENGINE_CONTRACT.md)
- 执行与验收：[docs/DEVELOPMENT_BLUEPRINT.md](docs/DEVELOPMENT_BLUEPRINT.md)、[docs/QUALITY.md](docs/QUALITY.md)
- 治理与决策：[docs/GOVERNANCE.md](docs/GOVERNANCE.md)、[docs/ADR/README.md](docs/ADR/README.md)
