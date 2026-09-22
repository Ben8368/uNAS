# 当前状态

> **最后确认：** 2026-09-21
> **阶段：** Phase 2 / UniPass capability integration
> **产品代码：** uNAS 唯一 WXT MV3 包已接入 UniPass AdBlock、WebDAV Vault、Legacy adapter 和原版 closed Shadow DOM 页面浮层；密码库管理不再另开独立 `passwords.html`，原有 New Tab/Workspace 保持。

## 当前决策

- uNAS 是产品正式名称，是扩展原生的本地优先新标签页工作区；不另做托管 Web 产品或传统桌面程序。
- 首发浏览器为 Chrome；当前以解包扩展和本地安装验证为准，暂不进入 Chrome Web Store 上架阶段。
- 产品尚未对外开放，仅维护者本人使用；已接受 [ADR 0008](docs/ADR/0008-private-preview-modern-chrome.md) 的现代 Chrome 优先与主动迁移方向。扩展已声明 Chrome 148 下限，并将壳层迁至原生 `browser.*` 与 Promise 消息响应；不保留旧版 namespace fallback。
- New Tab 承载轻量 Desktop，内置 App 按需在当前标签页打开，逻辑 Workspace 管理任务所有权（ADR 0007）；System/Tool App 随包发布，Link App 只做 HTTPS 跳转。
- 维护者已确认进入 Frontend Demo 阶段；现有 Demo 使用浏览器内置 mock adapter 验证桌面、App、文件和任务流程，并提供 WXT Manifest V3 的 New Tab、Workspace 与 Service Worker 壳；右侧系统状态面板已接入浏览器/Chrome 能力探针，无法读取的 GPU 利用率与显存明确降级，不把 mock 数值当作真实能力。
- 维护者已授权进入前端界面正式打磨：优先收敛桌面层级、App 启动入口、状态抽屉、响应式与无障碍；该授权不改变 mock 与真实能力的边界。
- 视觉采用原创的 macOS/iPadOS 启发式桌面层级与 Liquid Glass 原则，玻璃限于导航/控制层，并提供无障碍和性能降级。
- uNAS Glass 工作包 A–C 已实现：`window-theme.css` 是窗口主题、材质与兼容别名的唯一值来源；窗口根承担唯一 blur，正文为实色内容面；Desktop/Dock/启动器与文件管理器已消费共享语义 Token。后续 D–E 的顺序与验收见 [Development Blueprint](docs/DEVELOPMENT_BLUEPRINT.md#uNAS-glass-后续迁移顺序)。
- TypeScript、React/Vite、WXT、统一 App/Task contract、Worker 与 adapter 隔离是当前工程方向；Demo 依赖已通过 pnpm 锁定。
- UniPass 功能来源基线为 `ee749982cc31efbcf912866b854afbf5f1b36c1c`；uNAS 融合分支为 `codex/unipass-integration`，uNAS 起点为 `fef41ae0ba49ad5a043de22b18feafb495d3deab`。

## 近期优先级

1. 验收 uNAS Glass D：UniPass 展示层已接入共享 Token 并保留薄荷绿强调，补目标 Chrome 浮层深浅主题与控件状态人工证据。
2. 实施 uNAS Glass E：补齐浅深主题、减少透明度、真实 Chrome 人工走查与可复现证据归档。
3. 完成 [TD-002](docs/TECH_DEBT.md#td-002全局兼容样式的局部化迁移) 验收：代码迁移已完成，系统 Chrome 自动化未等到 Service Worker；补齐人工确认后归档。

## 当前阻断与风险

- G1 已由维护者确认验收；SP-04 仍开放 RISK-007，详见 [SP-04](benchmarks/sp-04/README.md)。
- SP-09：KGM v3、NCM、QMC raw-key-footer 已完成 Worker/OPFS Beta 验证；5 个授权 KGM v3 样本通过解码及浏览器下载/取消/清理。暂存下载无完成回执；无覆盖或联网。
- SP-09 仍开放 RISK-015：目标 Chrome、owner lease、页面关闭、峰值内存、KGM v5 KGG、QMC MMKV/`cex\0`、可再分发夹具未完成。
- 活跃风险以 [RISK_REGISTER.md](docs/RISK_REGISTER.md) 为唯一事实源；Chrome Web Store 更新属于未来 Store Gate。

## 最近验证

- 2026-09-20： [GitHub Actions CI #35](https://github.com/Ben8368/uNAS/actions/runs/35487284796) 的文档、Demo 和浏览器回归均成功；SP-04 目标 Chrome 与资源证据仍缺，RISK-007 保持开放，详见 [SP-04](benchmarks/sp-04/README.md)。
- 2026-09-21：KGM v3 5 样本通过 Node/`ffprobe`/`ffmpeg` 和 bundled E2E（10/5）；Chrome、owner、关页、内存、KGM v5 未验收，详见 [SP-09](benchmarks/sp-09/README.md)。

## 按需入口

- 产品与路线：[docs/PRODUCT.md](docs/PRODUCT.md)、[docs/ROADMAP.md](docs/ROADMAP.md)
- 前端与设计：[docs/FRONTEND_GUIDE.md](docs/FRONTEND_GUIDE.md)、[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- 架构与契约：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/APP_CONTRACT.md](docs/APP_CONTRACT.md)、[docs/ENGINE_CONTRACT.md](docs/ENGINE_CONTRACT.md)
- 执行与验收：[docs/DEVELOPMENT_BLUEPRINT.md](docs/DEVELOPMENT_BLUEPRINT.md)、[docs/QUALITY.md](docs/QUALITY.md)
- 治理与决策：[docs/GOVERNANCE.md](docs/GOVERNANCE.md)、[docs/ADR/README.md](docs/ADR/README.md)
