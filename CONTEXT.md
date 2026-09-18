# 当前状态

> **最后确认：** 2026-09-18
> **阶段：** Phase 2 / UniPass capability integration
> **产品代码：** uNAS 唯一 WXT MV3 包已接入 UniPass AdBlock、WebDAV Vault、Legacy adapter、原版 closed Shadow DOM 页面浮层和 `passwords.html`；原有 New Tab/Workspace 保持。

## 当前决策

- uNAS 是产品正式名称，是扩展原生的本地优先新标签页工作区；不另做托管 Web 产品或传统桌面程序。
- 首发浏览器为 Chrome；当前以解包扩展和本地安装验证为准，暂不进入 Chrome Web Store 上架阶段。
- 产品尚未对外开放，仅维护者本人使用；已接受 [ADR 0008](docs/ADR/0008-private-preview-modern-chrome.md) 的现代 Chrome 优先与主动迁移方向。扩展已声明 Chrome 148 下限，并将壳层迁至原生 `browser.*` 与 Promise 消息响应；不保留旧版 namespace fallback。
- New Tab 承载轻量 Desktop，内置 App 按需在当前标签页打开，逻辑 Workspace 管理任务所有权（ADR 0007）；System/Tool App 随包发布，Link App 只做 HTTPS 跳转。
- 维护者已确认进入 Frontend Demo 阶段；现有 Demo 固定使用浏览器内置 mock adapter 验证桌面、App、文件和任务流程，并提供 WXT Manifest V3 的 New Tab、Workspace 与 Service Worker 壳；真实能力随后逐项替换。
- 维护者已授权进入前端界面正式打磨：优先收敛桌面层级、App 启动入口、状态抽屉、响应式与无障碍；该授权不改变 mock 与真实能力的边界。
- 视觉采用原创的 macOS/iPadOS 启发式桌面层级与 Liquid Glass 原则，玻璃限于导航/控制层，并提供无障碍和性能降级。
- TypeScript、React/Vite、WXT、统一 App/Task contract、Worker 与 adapter 隔离是当前工程方向；Demo 依赖已通过 pnpm 锁定。
- UniPass 功能来源基线为 `ee749982cc31efbcf912866b854afbf5f1b36c1c`；uNAS 融合分支为 `codex/unipass-integration`，uNAS 起点为 `fef41ae0ba49ad5a043de22b18feafb495d3deab`。

## 近期优先级

1. 在隔离 Chrome Profile 完成工具栏 action 浮层的人工点击、主题、外部点击/Escape、SPA 导航和合成账号填充验收；Playwright headless 无法代替该手势。
2. 为 WebDAV Vault 建立 uNAS 原生核心单测/冲突夹具，并用合成 WebDAV 服务验证创建、恢复、离线、ETag 冲突和 CSV 导入。
3. 解决发布前阻断：确认 UniPass 资源再分发许可、生成并由维护者保管 uNAS 签名 key/固定扩展 ID，审查新增权限和外部主机。

## 当前阻断与风险

- G1 已由维护者确认验收：Chrome 152.0.7977.82 / win32 10.0.26200 x64 的人工走查与自动化证据已接受；关闭记录见 [2026-09 风险归档](docs/archive/risks/2026-09.md)。MV3 壳层和 File Workspace 边界已由 SP-01、SP-02 验收；[SP-04](benchmarks/sp-04/README.md) 的自动化正向路径不关闭 RISK-007。
- 活跃风险以 [RISK_REGISTER.md](docs/RISK_REGISTER.md) 为唯一事实源；本轮新增的真实外部服务、工具栏手势、资源许可和最终扩展 ID 尚未全部人工验收。Chrome Web Store 更新属于未来 Store Gate，不阻断当前本地解包插件。

## 最近验证

- 2026-09-18：[融合验证记录](docs/QUALITY.md)：`pnpm verify` 通过；UniPass `npm test` 基线 179/179 通过；uNAS MV3 E2E 40/40 通过，2 项工具栏浮层手势测试因 headless 限制跳过。构建包含单一 `background.js`、AdBlock content script、`page-overlay.js`、`passwords.html` 和 `credential-core.wasm`。

## 按需入口

- 产品与路线：[docs/PRODUCT.md](docs/PRODUCT.md)、[docs/ROADMAP.md](docs/ROADMAP.md)
- 前端与设计：[docs/FRONTEND_GUIDE.md](docs/FRONTEND_GUIDE.md)、[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- 架构与契约：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/APP_CONTRACT.md](docs/APP_CONTRACT.md)、[docs/ENGINE_CONTRACT.md](docs/ENGINE_CONTRACT.md)
- 执行与验收：[docs/DEVELOPMENT_BLUEPRINT.md](docs/DEVELOPMENT_BLUEPRINT.md)、[docs/QUALITY.md](docs/QUALITY.md)
- 治理与决策：[docs/GOVERNANCE.md](docs/GOVERNANCE.md)、[docs/ADR/README.md](docs/ADR/README.md)
