# AI 协作规范

`AGENTS.md` 是 AI 协作的唯一入口；`CLAUDE.md` 与 `.cursorrules` 只能保留摘要。规则细节只在权威文档维护，不在入口复制。

## 开局与按需读取

所有任务先读 [CONTEXT.md](CONTEXT.md) 和 [LESSONS.md](LESSONS.md)，再仅加载命中项：

| 任务 | 必读文档 |
| --- | --- |
| 产品范围、优先级、规划 | [docs/PRODUCT.md](docs/PRODUCT.md)、[docs/ROADMAP.md](docs/ROADMAP.md)、[docs/DEVELOPMENT_BLUEPRINT.md](docs/DEVELOPMENT_BLUEPRINT.md) |
| 前端、New Tab、App 或 Liquid Glass | [docs/FRONTEND_GUIDE.md](docs/FRONTEND_GUIDE.md)、[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)、[docs/APP_CONTRACT.md](docs/APP_CONTRACT.md) |
| 任意产品源码改动 | [docs/AI_RULES.md](docs/AI_RULES.md)、[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/QUALITY.md](docs/QUALITY.md) |
| 任务、Worker 或引擎适配 | [docs/ENGINE_CONTRACT.md](docs/ENGINE_CONTRACT.md)、[docs/RISK_REGISTER.md](docs/RISK_REGISTER.md) |
| 文件、浏览器、扩展或权限 | [SECURITY.md](SECURITY.md)、相关 ADR；扩展另读架构中的权限边界 |
| 技术债、风险或阶段推进 | [docs/TECH_DEBT.md](docs/TECH_DEBT.md)、[docs/RISK_REGISTER.md](docs/RISK_REGISTER.md)、[docs/ROADMAP.md](docs/ROADMAP.md) |
| 治理文档改动 | [docs/GOVERNANCE.md](docs/GOVERNANCE.md) |
| 维护职责或长期决策 | [docs/MAINTAINERS.md](docs/MAINTAINERS.md)、[docs/ADR/README.md](docs/ADR/README.md) |

Windows PowerShell 读取或输出中文时使用 UTF-8；文件一律保存为 UTF-8、LF。

## 不可跨越的边界

- 项目是 TypeScript monorepo；Manifest V3 扩展是唯一产品，New Tab 是轻量桌面，Workspace 承载工具与任务，计算进入 Worker。
- Frontend Demo 只能通过统一 mock adapter 模拟能力并显式标识；不得把 mock 结果写成格式、性能或浏览器支持。
- System/Tool App 随扩展打包；用户 Link App 只允许声明式 HTTPS 跳转，不嵌入或执行远程代码。
- UI 不直接调用 ffmpeg.wasm、WebCodecs、zip.js、PDF.js、文件系统或扩展权限 API。
- 文件默认本地处理；任何上传、遥测、云处理或 Native Helper 都需独立 ADR、显式用户同意和安全评审。
- 不按扩展名信任输入；格式探测、资源上限、取消、清理和错误归一属于引擎边界。
- 未经能力探针和真实夹具验证，不得宣称支持某格式、浏览器、文件大小、编解码器或性能指标。
- 浏览器扩展遵循最小权限；不得绕过 DRM、站点授权、浏览器安全策略或远程代码限制。
- Phase 0 只允许文档、治理和非产品脚手架；产品源码需通过 Roadmap Gate G0。

## 执行与汇报

- 改动前确认事实源，避免把同一状态复制到多份文档。
- 源码改动后按 [docs/AI_RULES.md](docs/AI_RULES.md) 输出 `🚦 Audit Report`，再运行 `pnpm verify`；文档改动至少运行 `node scripts/governance-docs-check.mjs`。
- 客观验证必须给出命令和结果；主观体验、兼容性真机或性能结论必须保留真实证据，不能由构建通过代替。
- 当前状态只写 [CONTEXT.md](CONTEXT.md)，阶段计划只写 Roadmap，执行拆分只写 Development Blueprint，风险与技术债分开登记，长期决策写 ADR。
- 默认不提交、不推送、不发布；仅在用户明确要求时执行对应 Git 或发布动作。
- 默认使用中文汇报；标识符、命令、路径、API 字段和专有名词保留原文。

## 治理文档自治理

- 遵守 [docs/GOVERNANCE.md](docs/GOVERNANCE.md) 的单一事实源、篇幅预算、状态词和归档规则。
- `AGENTS.md`、`CONTEXT.md`、`LESSONS.md` 是强制加载面，只保留路由、当前事实和经验索引。
- 治理改动后运行 `node scripts/governance-docs-check.mjs`；超预算时先拆分或归档，不提高预算逃避治理。
