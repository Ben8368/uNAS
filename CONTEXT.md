# 当前状态

> **最后确认：** 2026-09-07
> **阶段：** Phase 1 / Frontend UI refinement
> **产品代码：** React/Vite/WXT mock Demo；确定性 scenario、Workspace owner、跨标签摘要和 HTTPS Link 已实现，尚未接入真实文件、引擎或后端。

## 当前决策

- uNAS 是产品正式名称，是扩展原生的本地优先新标签页工作区；不另做托管 Web 产品或传统桌面程序。
- 首发浏览器为 Chrome；当前以解包扩展和本地安装验证为准，暂不进入 Chrome Web Store 上架阶段。
- 产品尚未对外开放，仅维护者本人使用；已接受 [ADR 0008](docs/ADR/0008-private-preview-modern-chrome.md) 的现代 Chrome 优先与主动迁移方向。扩展已声明 Chrome 148 下限，并将壳层迁至原生 `browser.*` 与 Promise 消息响应；不保留旧版 namespace fallback。
- New Tab 承载轻量 Desktop，内置 App 按需在当前标签页打开，逻辑 Workspace 管理任务所有权（ADR 0007）；System/Tool App 随包发布，Link App 只做 HTTPS 跳转。
- 维护者已确认进入 Frontend Demo 阶段；现有 Demo 固定使用浏览器内置 mock adapter 验证桌面、App、文件和任务流程，并提供 WXT Manifest V3 的 New Tab、Workspace 与 Service Worker 壳；真实能力随后逐项替换。
- 维护者已授权进入前端界面正式打磨：优先收敛桌面层级、App 启动入口、状态抽屉、响应式与无障碍；该授权不改变 mock 与真实能力的边界。
- 视觉采用原创的 macOS/iPadOS 启发式桌面层级与 Liquid Glass 原则，玻璃限于导航/控制层，并提供无障碍和性能降级。
- TypeScript、React/Vite、WXT、统一 App/Task contract、Worker 与 adapter 隔离是当前工程方向；Demo 依赖已通过 pnpm 锁定。

## 近期优先级

1. FE-11 已迁移启动器 Dialog 与下载行 Popover；继续审查响应式容器和 UI 分片，打磨桌面、状态抽屉、响应式与键盘路径；不改变 mock/真实边界。
2. 补录 G1 的 Stable Chrome/OS/视口、真实缩放、辅助技术与性能人工证据；维护者已完成走查且暂未发现问题，但 RISK-001 的可复现记录仍未完整。
3. 在 Demo 验收后执行 Extension/File/Image 等 Phase 2 探针，再决定真实能力接入范围。

## 当前阻断与风险

- Chrome 版本策略已由 ADR 0008 确定；本机 Chrome 为 152.0.7977.82，OS 为 win32 10.0.26200 x64；Stable 视口、真实缩放、辅助技术/性能记录、素材许可证和风险 owner 仍待补齐。RISK-001 不阻断迁移规划，但仍阻断 G1。
- 活跃风险以 [RISK_REGISTER.md](docs/RISK_REGISTER.md) 为唯一事实源；已开展独立 Chromium 解包自动化，不代表 G1 批准或真实引擎/生命周期探针完成。

## 最近验证

- 2026-09-07：Chrome 152.0.7977.82 / win32 10.0.26200 x64；维护者已完成人工体验走查、暂未发现问题。`pnpm verify`、30 项扩展 E2E、6 项 Web E2E 均通过；原生 `browser.*`、Promise 拒绝消息、`<dialog>`/Popover Escape 与 mock 生命周期回归已验证。证据位于 `apps/extension/test-results/`；仍不代表 G1 批准或真实引擎/生命周期验证。

## 按需入口

- 产品与路线：[docs/PRODUCT.md](docs/PRODUCT.md)、[docs/ROADMAP.md](docs/ROADMAP.md)
- 前端与设计：[docs/FRONTEND_GUIDE.md](docs/FRONTEND_GUIDE.md)、[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- 架构与契约：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/APP_CONTRACT.md](docs/APP_CONTRACT.md)、[docs/ENGINE_CONTRACT.md](docs/ENGINE_CONTRACT.md)
- 执行与验收：[docs/DEVELOPMENT_BLUEPRINT.md](docs/DEVELOPMENT_BLUEPRINT.md)、[docs/QUALITY.md](docs/QUALITY.md)
- 治理与决策：[docs/GOVERNANCE.md](docs/GOVERNANCE.md)、[docs/ADR/README.md](docs/ADR/README.md)
