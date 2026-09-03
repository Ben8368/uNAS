# 当前状态

> **最后确认：** 2026-09-03
> **阶段：** Phase 0 / 产品、设计与治理
> **产品代码：** 尚未开始

## 当前决策

- uNAS 是产品正式名称，是扩展原生的本地优先新标签页工作区；不另做托管 Web 产品或传统桌面程序。
- 首发浏览器为 Chrome；当前以解包扩展和本地安装验证为准，暂不进入 Chrome Web Store 上架阶段。
- New Tab 承载轻量 Desktop，Workspace 承载内置工具和长任务；System/Tool App 随包发布，Link App 只做 HTTPS 跳转。
- Gate G0 后 Frontend Demo 先行，以统一 mock adapter 验证桌面、App、文件和任务流程；真实能力随后逐项替换。
- 视觉采用原创的 macOS/iPadOS 启发式桌面层级与 Liquid Glass 原则，玻璃限于导航/控制层，并提供无障碍和性能降级。
- TypeScript、React/Vite、WXT、统一 App/Task contract、Worker 与 adapter 隔离是当前工程方向；精确依赖尚未安装或锁定。

## 近期优先级

1. 由维护者确认 [产品定义](docs/PRODUCT.md)、[设计系统](docs/DESIGN_SYSTEM.md)、V1 与 ADR 0001、0003–0006，完成 Gate G0。
2. 按 [前端指南](docs/FRONTEND_GUIDE.md) 和 [开发蓝图](docs/DEVELOPMENT_BLUEPRINT.md) 准备 Phase 1 Frontend Demo 工作包与 mock scenario。
3. 在 Demo 验收后执行 Extension/File/Image 等 Phase 2 探针，再决定真实能力接入范围。

## 当前阻断与风险

- Gate G0 尚未由维护者确认；Chrome 最低版本策略、参考视口、许可证和风险 owner 仍待决定。
- 活跃风险以 [RISK_REGISTER.md](docs/RISK_REGISTER.md) 为唯一事实源；当前没有产品代码技术债。

## 最近验证

- 2026-09-03：扩展原生、前端先行文档重构后，`node scripts/governance-docs-check.mjs` 通过；不代表任何前端或文件能力存在。

## 按需入口

- 产品与路线：[docs/PRODUCT.md](docs/PRODUCT.md)、[docs/ROADMAP.md](docs/ROADMAP.md)
- 前端与设计：[docs/FRONTEND_GUIDE.md](docs/FRONTEND_GUIDE.md)、[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- 架构与契约：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/APP_CONTRACT.md](docs/APP_CONTRACT.md)、[docs/ENGINE_CONTRACT.md](docs/ENGINE_CONTRACT.md)
- 执行与验收：[docs/DEVELOPMENT_BLUEPRINT.md](docs/DEVELOPMENT_BLUEPRINT.md)、[docs/QUALITY.md](docs/QUALITY.md)
- 治理与决策：[docs/GOVERNANCE.md](docs/GOVERNANCE.md)、[docs/ADR/README.md](docs/ADR/README.md)
