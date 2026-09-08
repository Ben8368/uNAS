# 当前状态

> **最后确认：** 2026-09-08
> **阶段：** Phase 2 / SP-02 File Workspace
> **产品代码：** React/Vite/WXT mock Desktop；确定性 scenario、Workspace owner、跨标签摘要和 HTTPS Link 已实现。SP-02 已接入受限的本地目录授权、metadata 浏览和直接子项编辑；真实处理、导出、引擎和后端仍未接入。

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
2. 清理不再被 Demo 入口引用的旧 HTTP/本地服务 adapter，并保持前端基线、依赖与文档一致。
3. 推进 [SP-02 File Workspace](benchmarks/sp-02/README.md)：解包扩展已验证 IndexedDB/OPFS 临时存储和目录授权 API 路径；继续人工验证原生选择器、真实目录撤销、配额压力与导出 fallback。真实处理与引擎仍须逐项验证后才能接入。

## 当前阻断与风险

- G1 已由维护者确认验收：Chrome 152.0.7977.82 / win32 10.0.26200 x64 的人工走查与自动化证据已接受；关闭记录见 [2026-09 风险归档](docs/archive/risks/2026-09.md)。这不代表真实引擎、文件权限或 MV3 长生命周期已验证。
- 活跃风险以 [RISK_REGISTER.md](docs/RISK_REGISTER.md) 为唯一事实源；G2-Core 仍受 RISK-003、RISK-004、RISK-005 阻断。

## 最近验证

- 2026-09-08：文件管理、网址 App 与共享外观改版已验证；`pnpm verify`（98 项单测）、37 项扩展 E2E、6 项 Web E2E 通过。[验收记录](docs/archive/reviews/2026-09-08-ui.md)。目录测试使用 OPFS 替身，主观确认见 RISK-012，不扩大真实能力结论。

- 2026-09-08：SP-02 已在 Chrome for Testing 解包扩展页验证 IndexedDB/OPFS 临时存储、目录授权 API 路径、受限直接子项编辑、句柄恢复、取消保留和忘记授权；本轮 `pnpm verify`（95 项单测）与目录/布局解包扩展 E2E 通过。证据：[SP-02](benchmarks/sp-02/README.md)、`apps/extension/test-results/`；自动化目录用例使用隔离 OPFS handle 替身，不代表原生选择器、真实目录撤销、配额压力或导出能力。
- 2026-09-07：维护者确认 G1 已验收。Chrome 152.0.7977.82 / win32 10.0.26200 x64 的人工体验走查，以及 `pnpm verify`、30 项扩展 E2E、6 项 Web E2E 已通过；原生 `browser.*`、Promise 拒绝消息、`<dialog>`/Popover Escape 与 mock 生命周期回归已验证。清理旧 HTTP adapter 后，治理/边界/依赖/包体检查、92 项单测、类型检查、Vite/WXT 构建与 31 项扩展、6 项 Web E2E 再次通过；其中 SP-01 强制 Worker 终止/事件唤醒记录于 [SP-01](benchmarks/sp-01/README.md)。证据位于 `apps/extension/test-results/`；不代表真实引擎或完整生命周期探针完成。

## 按需入口

- 产品与路线：[docs/PRODUCT.md](docs/PRODUCT.md)、[docs/ROADMAP.md](docs/ROADMAP.md)
- 前端与设计：[docs/FRONTEND_GUIDE.md](docs/FRONTEND_GUIDE.md)、[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- 架构与契约：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/APP_CONTRACT.md](docs/APP_CONTRACT.md)、[docs/ENGINE_CONTRACT.md](docs/ENGINE_CONTRACT.md)
- 执行与验收：[docs/DEVELOPMENT_BLUEPRINT.md](docs/DEVELOPMENT_BLUEPRINT.md)、[docs/QUALITY.md](docs/QUALITY.md)
- 治理与决策：[docs/GOVERNANCE.md](docs/GOVERNANCE.md)、[docs/ADR/README.md](docs/ADR/README.md)
