# ADR 0020：扩展源码按 owner 分层（shell / features / platform / shared）

- 状态：已接受
- 日期：2026-10-09

## 背景

`apps/extension/src` 原有 `apps`、`modules`、`api`、`application`、`runtime`、`music`、`archive`、`components`、`hooks`、`workers` 等十余个顶层目录，叠加了五条不同的分类轴：业务功能、UI 类型、技术层、运行环境和实现状态。结果是同一个能力散落多处（例如 Files 横跨 `apps/file-manager`、`api/*`、`api/real/*`、`runtime/webdav` 和 `archive`），`api/`、`application/`、`shared/` 变成无 owner 的模糊桶，边界只能靠约定维持。

[ADR 0004](0004-typescript-pnpm-monorepo.md) 与 [Architecture](../ARCHITECTURE.md) 的逻辑依赖方向（Screen → Port → Contract/Core → Adapter）不变；本决定只规定源码的物理归属。

## 决策

`src` 顶层只允许四个目录（另有 `vite-env.d.ts`）；`apps/extension/contracts/` 与 `entrypoints/`（WXT 约定）保持原位。

| 目录 | 放什么 | 判定 |
| --- | --- | --- |
| `shell/` | 桌面壳：`app/` 启动与会话、`launcher/` App 注册与启动器、`desktop/`、`navigation/`、`windows/`、`right-panel/` | 与具体业务无关的工作区组合 |
| `features/<name>/` | 一个产品能力的 UI、状态、后台与契约 | 有明确业务 owner |
| `platform/<area>/` | 与运行环境耦合的实现：`extension`、`browser`、`workspace`、`webdav`、`filesystem`、`storage`、`archive`、`system`、`demo` | 实现浏览器/扩展/存储能力 |
| `shared/` | 被多个 feature 使用、无业务 owner、不依赖任何 feature 的代码 | 只有一个调用者的放调用者 |

约定：

- platform 区域顶层文件是 port/facade；`real/` 是私有实现，`test-support/` 是测试夹具。非 platform 代码和 React UI 不得深入引用它们。
- `features/<name>` 的 public entry 在 `scripts/architecture-boundary-check.mjs` 的 `FEATURE_PUBLIC` 显式声明（如 `ui.tsx`、`*App.tsx`、`background/service-worker.ts`）；其他 feature 与 shell 只能导入这些入口。
- `real/` 目录私有于其父目录：只有同级 facade 可以导入，demo 代码无法经任何别名/相对路径到达（`scripts/demo-boundary-check.mjs`）。
- App Registry 只声明元数据和懒加载入口，不产生运行时副作用；Workspace 连接由 `WorkspaceAppContent` 负责。
- 后台消息经 `platform/extension` 的表驱动 router：`match → authorize → dispatch → 归一化响应`，每类消息一个 handler，发送方策略集中在 `sender-policy.ts`。

## 自动化

`pnpm check:architecture` 在 `verify:extension` 中执行，禁止：`shared → features/shell`、`platform → shell`、`platform → feature UI`、`feature A → feature B 内部路径`、`shell → feature 内部实现`、React UI → platform 私有实现、`src` 新增顶层分类桶，以及 `apps/extension → packages/unipass` 的深导入（[ADR 0019](0019-unipass-monorepo-package.md)）。错误输出包含源文件、非法导入和违反规则。

已有耦合登记在 `scripts/architecture-boundary-baseline.json`：只允许减少，新增违规或过期条目都会失败。本次迁移后基线为空。

## 后果

- 迁移是纯移动加导入改写：323 个文件 `git mv`（保留重命名历史），353 处导入说明符由 AST 改写；`useFilebrowserNavigator` 改名为 `useFileBrowserNavigator`。
- 样式整体移至 `shared/styles/`（保持内部 `@import` 不变）；按 feature 拆分样式与 `themeOwnership` 约束的调整未做，留待 UI-Glass 工作包。
- `PsdApp`、`TranscodeApp`、`DemoToolApp` 未注册到 App Registry，仍作为各自 feature 保留，不在本决定内删除。
- `platform/extension` 的 handler 仍直接导入 `features/*/background/service-worker`（已声明为 composition surface）；更彻底的做法是由 `entrypoints/background.ts` 注入路由，保留为后续选项。

## 替代方案

- 保持原结构并靠文档约定：已证明无法阻止退化，拒绝。
- 按技术层拆为 `ui/`、`state/`、`services/`：把一个能力再次打散，拒绝。
- 每个 feature 拆成独立 workspace package：当前没有独立发布需求，增加构建与版本成本，拒绝。

## 关联文档

- [Architecture](../ARCHITECTURE.md)、[Frontend Guide](../FRONTEND_GUIDE.md)、[ADR 0019](0019-unipass-monorepo-package.md)
