# 当前状态

> **最后确认：** 2026-09-20
> **阶段：** Phase 2 / UniPass capability integration
> **产品代码：** uNAS 唯一 WXT MV3 包已接入 UniPass AdBlock、WebDAV Vault、Legacy adapter 和原版 closed Shadow DOM 页面浮层；密码库管理不再另开独立 `passwords.html`，原有 New Tab/Workspace 保持。

## 当前决策

- uNAS 是产品正式名称，是扩展原生的本地优先新标签页工作区；不另做托管 Web 产品或传统桌面程序。
- 首发浏览器为 Chrome；当前以解包扩展和本地安装验证为准，暂不进入 Chrome Web Store 上架阶段。
- 产品尚未对外开放，仅维护者本人使用；已接受 [ADR 0008](docs/ADR/0008-private-preview-modern-chrome.md) 的现代 Chrome 优先与主动迁移方向。扩展已声明 Chrome 148 下限，并将壳层迁至原生 `browser.*` 与 Promise 消息响应；不保留旧版 namespace fallback。
- New Tab 承载轻量 Desktop，内置 App 按需在当前标签页打开，逻辑 Workspace 管理任务所有权（ADR 0007）；System/Tool App 随包发布，Link App 只做 HTTPS 跳转。
- 维护者已确认进入 Frontend Demo 阶段；现有 Demo 固定使用浏览器内置 mock adapter 验证桌面、App、文件和任务流程，并提供 WXT Manifest V3 的 New Tab、Workspace 与 Service Worker 壳；真实能力随后逐项替换。
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

- G1 已由维护者确认验收：Chrome 152.0.7977.82 / win32 10.0.26200 x64 的人工走查与自动化证据已接受；关闭记录见 [2026-09 风险归档](docs/archive/risks/2026-09.md)。MV3 壳层和 File Workspace 边界已由 SP-01、SP-02 验收；[SP-04](benchmarks/sp-04/README.md) 已补限定 ZIP 负向夹具与预检修复，仍不关闭 RISK-007。
- 活跃风险以 [RISK_REGISTER.md](docs/RISK_REGISTER.md) 为唯一事实源；本轮新增的真实外部服务、工具栏手势、资源许可和最终扩展 ID 尚未全部人工验收。Chrome Web Store 更新属于未来 Store Gate，不阻断当前本地解包插件。

## 最近验证

- 2026-09-20：[SP-04-A 验证](benchmarks/sp-04/README.md)：ZIP 负向夹具与预检修复；`pnpm verify` 通过（32 文件、155 测试），构建后的完整扩展 E2E 47/47 通过（0 skipped，bundled Chromium）。RISK-007 保持开放；[TD-002 主题证据](docs/archive/reviews/2026-09-20-theme-debt.md)中的系统 Chrome 启动超时和 RISK-012/014 人工验收缺口仍保留。

## 按需入口

- 产品与路线：[docs/PRODUCT.md](docs/PRODUCT.md)、[docs/ROADMAP.md](docs/ROADMAP.md)
- 前端与设计：[docs/FRONTEND_GUIDE.md](docs/FRONTEND_GUIDE.md)、[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- 架构与契约：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/APP_CONTRACT.md](docs/APP_CONTRACT.md)、[docs/ENGINE_CONTRACT.md](docs/ENGINE_CONTRACT.md)
- 执行与验收：[docs/DEVELOPMENT_BLUEPRINT.md](docs/DEVELOPMENT_BLUEPRINT.md)、[docs/QUALITY.md](docs/QUALITY.md)
- 治理与决策：[docs/GOVERNANCE.md](docs/GOVERNANCE.md)、[docs/ADR/README.md](docs/ADR/README.md)
