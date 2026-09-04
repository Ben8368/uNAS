# 当前状态

> **最后确认：** 2026-09-04
> **阶段：** Phase 1 / Frontend Demo
> **产品代码：** React/Vite/WXT mock Demo；确定性 scenario、Workspace owner、跨标签摘要和 HTTPS Link 已实现，尚未接入真实文件、引擎或后端。

## 当前决策

- uNAS 是产品正式名称，是扩展原生的本地优先新标签页工作区；不另做托管 Web 产品或传统桌面程序。
- 首发浏览器为 Chrome；当前以解包扩展和本地安装验证为准，暂不进入 Chrome Web Store 上架阶段。
- New Tab 承载轻量 Desktop，Workspace 承载内置工具和长任务；System/Tool App 随包发布，Link App 只做 HTTPS 跳转。
- 维护者已确认进入 Frontend Demo 阶段；现有 Demo 固定使用浏览器内置 mock adapter 验证桌面、App、文件和任务流程，并提供 WXT Manifest V3 的 New Tab、Workspace 与 Service Worker 壳；真实能力随后逐项替换。
- 视觉采用原创的 macOS/iPadOS 启发式桌面层级与 Liquid Glass 原则，玻璃限于导航/控制层，并提供无障碍和性能降级。
- TypeScript、React/Vite、WXT、统一 App/Task contract、Worker 与 adapter 隔离是当前工程方向；Demo 依赖已通过 pnpm 锁定。

## 近期优先级

1. 依据 [风险台账](docs/RISK_REGISTER.md) 确认 G1 的 Chrome/OS/视口基线和视觉验收负责人。
2. 按 [验收记录](docs/archive/reviews/2026-09-04-demo-remediation.md) 补齐 Chrome 稳定版、真实缩放、辅助技术与性能人工证据。
3. 在 Demo 验收后执行 Extension/File/Image 等 Phase 2 探针，再决定真实能力接入范围。

## 当前阻断与风险

- Chrome 最低版本策略、验证 OS、参考视口、素材许可证和风险 owner 仍待决定；RISK-001 因维护者接受 Phase 1 演示迁移而不再阻断当前开发，但仍阻断 G1。
- 活跃风险以 [RISK_REGISTER.md](docs/RISK_REGISTER.md) 为唯一事实源；已开展独立 Chromium 解包自动化，不代表 G1 批准或真实引擎/生命周期探针完成。

## 最近验证

- 2026-09-04：Windows `pnpm verify` 通过（81 项单测、类型检查、Vite/WXT 构建、隔离/依赖/包体检查）；E2E 与截图的最终环境、结果和边界见 [验收记录](docs/archive/reviews/2026-09-04-demo-remediation.md)。

## 按需入口

- 产品与路线：[docs/PRODUCT.md](docs/PRODUCT.md)、[docs/ROADMAP.md](docs/ROADMAP.md)
- 前端与设计：[docs/FRONTEND_GUIDE.md](docs/FRONTEND_GUIDE.md)、[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- 架构与契约：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/APP_CONTRACT.md](docs/APP_CONTRACT.md)、[docs/ENGINE_CONTRACT.md](docs/ENGINE_CONTRACT.md)
- 执行与验收：[docs/DEVELOPMENT_BLUEPRINT.md](docs/DEVELOPMENT_BLUEPRINT.md)、[docs/QUALITY.md](docs/QUALITY.md)
- 治理与决策：[docs/GOVERNANCE.md](docs/GOVERNANCE.md)、[docs/ADR/README.md](docs/ADR/README.md)
