# uNAS

> 正式产品名：uNAS。当前处于 **Phase 1 / Frontend Demo**；已迁入仅使用浏览器内置 mock 数据的 React/Vite Demo，并提供 WXT Manifest V3 构建物；未接入真实文件、引擎或后端能力。

uNAS 计划成为一个以 Manifest V3 浏览器扩展交付的本地优先新标签页工作区：用桌面级交互组织网址、本地文件和内置工具，在浏览器内完成常见图片、媒体、PDF 与 ZIP 任务。扩展是唯一产品，不另建面向用户的托管 Web 应用或传统桌面程序。

## 产品结构

- **New Tab Desktop**：搜索、Dock、Link App、最近任务和 App 启动。
- **Workspace**：Files、Image、Media、PDF、Archive 和 Task Center。
- **System/Tool App**：随扩展打包，通过统一 contract 使用文件和任务能力。
- **Link App**：用户注册的 HTTPS 网址快捷方式，只负责跳转网页。
- **Local-first**：文件默认不上传；能力、临时数据和输出路径可解释。

## 当前方案

| 领域 | 当前决定 |
| --- | --- |
| 产品形态 | Chrome Manifest V3 扩展；New Tab 主入口，Workspace 运行工具 |
| 当前分发 | Chrome 解包扩展和本地安装验证；暂不进入扩展商店上架阶段 |
| 开发顺序 | Frontend Demo 先行，确定性 mock 验证体验，真实能力随后替换 |
| 视觉方向 | 原创桌面/平板自适应，借鉴 Liquid Glass 的导航与控制层原则 |
| 主语言 | TypeScript strict；React/Vite 生态，WXT 管理扩展 entrypoint |
| App | System/Tool App 随包；自定义 Link App 只做 HTTPS 跳转 |
| 计算 | Workspace 的 Dedicated Worker；Service Worker 不运行长任务 |
| 文件 | 用户选择/拖入/授权，IndexedDB/OPFS 为候选内部存储 |
| 引擎 | Image → ZIP → PDF → Media，逐模块探针和 Gate |

前端 Demo 的依赖已锁定在 workspace；界面展示的文件、任务和处理结果仍均为 mock，不代表任何格式支持、真实输出或性能已验证。

## 文档入口

- 产品与范围：[PRODUCT.md](docs/PRODUCT.md)
- 视觉系统：[DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- 前端 Demo 指南：[FRONTEND_GUIDE.md](docs/FRONTEND_GUIDE.md)
- App 模型：[APP_CONTRACT.md](docs/APP_CONTRACT.md)
- 目标架构：[ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Task/Engine 语义：[ENGINE_CONTRACT.md](docs/ENGINE_CONTRACT.md)
- 阶段门禁与工作包：[ROADMAP.md](docs/ROADMAP.md)、[DEVELOPMENT_BLUEPRINT.md](docs/DEVELOPMENT_BLUEPRINT.md)
- 安全、质量与风险：[SECURITY.md](SECURITY.md)、[QUALITY.md](docs/QUALITY.md)、[RISK_REGISTER.md](docs/RISK_REGISTER.md)
- 决策记录：[ADR](docs/ADR/README.md)

## 开始开发前

Phase 1 只允许 Frontend Demo、mock scenario 和不含真实 engine/WASM 的扩展壳；真实文件和引擎能力从 Phase 2 探针开始获得证据。当前 Demo 同时提供 Vite 本地演示与 WXT Manifest V3 的 New Tab、Workspace 和 Service Worker 壳。

## 文档验证

```bash
pnpm -w run verify
```

检查通过覆盖文档治理、Demo 单元测试、类型检查与构建；不代表视觉、目标浏览器扩展、文件或引擎能力通过。

构建 Chrome 解包扩展：

```bash
pnpm -w run build:extension
```

构建物位于 `apps/extension/.output/chrome-mv3/`。在 Chrome 扩展管理页面开启开发者模式后，选择“加载已解压的扩展程序”，并选择该目录。

## 发布边界

- 当前交付目标是 Chrome 解包扩展/本地安装包，不以 Chrome Web Store 上架作为 V1 门禁。
- 默认无账号、无上传、无遥测、无广告注入。
- Manifest V3 禁止远程可执行代码；Link App 无文件或扩展权限。
- 仓库许可证、第三方依赖和素材许可未确认前，不得公开发布扩展或二进制资源。
