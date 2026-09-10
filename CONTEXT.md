# 当前状态

> **最后确认：** 2026-09-10
> **阶段：** Phase 2 / Archive ZIP probe implementation and Image probe preparation
> **产品代码：** React/Vite/WXT mock Desktop；scenario、Workspace owner、跨标签摘要和 HTTPS Link 已实现。SP-02 是受限目录授权；[SP-04](benchmarks/sp-04/README.md) 已实现 ZIP 解压切片，完整验收仍未完成。

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

1. 完成 [SP-04 Archive ZIP](benchmarks/sp-04/README.md) 真实验收：补齐负向夹具、目标 Chrome、取消/页面关闭与资源测量；在 RISK-007 关闭前不扩大承诺。
2. FE-11 已迁移启动器 Dialog 与下载行 Popover；继续审查响应式容器和 UI 分片，打磨桌面、状态抽屉、响应式与键盘路径；不改变其余 mock/真实边界。
3. 推进 Image 首个真实闭环探针：当前 G2-Core 主要阻断是 Image 首个真实闭环与保真边界；真实任务运行期间暂不验收，待首个可执行真实任务接入后再建立对应验收对象。

## 当前阻断与风险

- G1 已由维护者确认验收：Chrome 152.0.7977.82 / win32 10.0.26200 x64 的人工走查与自动化证据已接受；关闭记录见 [2026-09 风险归档](docs/archive/risks/2026-09.md)。MV3 壳层和 File Workspace 边界已由 SP-01、SP-02 验收；[SP-04](benchmarks/sp-04/README.md) 的自动化正向路径不关闭 RISK-007。
- 活跃风险以 [RISK_REGISTER.md](docs/RISK_REGISTER.md) 为唯一事实源；G2-Core 当前主要受 RISK-005 阻断。Chrome Web Store 更新属于未来 Store Gate，不阻断当前本地插件。

## 最近验证

- 2026-09-10：[SP-04](benchmarks/sp-04/README.md) 受限 ZIP 解压的单元和解包 MV3 Playwright 正向 fixture 通过；目标 Chrome、负向夹具、取消/页面关闭和资源测量未运行，RISK-007 保持开放。

- 2026-09-09：维护者确认 [SP-02](benchmarks/sp-02/README.md) 文件人工验收通过：原生选择器、取消/拒绝、更换目录、权限撤销、刷新/重启恢复、写入二次确认、同名冲突、非递归删除、IndexedDB/OPFS 与清理均无问题。真实文件处理、导出和真实任务仍不在当前范围。

- 2026-09-09：SP-01 已由维护者确认 Chrome Stable 解包扩展自然休眠、唤醒、浏览器重启与 Reload/update 路径通过；详见 [SP-01](benchmarks/sp-01/README.md)。真实任务运行期间暂不验收，Chrome Web Store 更新暂不考虑。
- 2026-09-09：审查黄灯已修复：`pnpm verify` 纳入 ESLint，依赖清单覆盖根与扩展 manifest；新增跨平台系统 Chrome E2E 入口并记录实际 channel。`pnpm verify`、串行 `pnpm test:e2e`（38/38）和 Web E2E（6/6）通过，方法见 [QUALITY](docs/QUALITY.md)。

## 按需入口

- 产品与路线：[docs/PRODUCT.md](docs/PRODUCT.md)、[docs/ROADMAP.md](docs/ROADMAP.md)
- 前端与设计：[docs/FRONTEND_GUIDE.md](docs/FRONTEND_GUIDE.md)、[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- 架构与契约：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/APP_CONTRACT.md](docs/APP_CONTRACT.md)、[docs/ENGINE_CONTRACT.md](docs/ENGINE_CONTRACT.md)
- 执行与验收：[docs/DEVELOPMENT_BLUEPRINT.md](docs/DEVELOPMENT_BLUEPRINT.md)、[docs/QUALITY.md](docs/QUALITY.md)
- 治理与决策：[docs/GOVERNANCE.md](docs/GOVERNANCE.md)、[docs/ADR/README.md](docs/ADR/README.md)
