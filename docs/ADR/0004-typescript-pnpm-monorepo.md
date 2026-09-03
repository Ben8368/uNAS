# ADR 0004：TypeScript + pnpm monorepo

- 状态：已接受
- 日期：2026-09-03

> 应用形态部分已由 [ADR 0005](0005-extension-native-new-tab-workspace.md) 收敛为仅扩展；TypeScript、pnpm、React/Vite 生态与 WXT 方向继续有效。

## 背景

产品需要 Web、Extension、多个 Worker 和可共享的 contracts/core。主要浏览器 API、React、WXT 和候选文件处理库都有 JavaScript/TypeScript 接口；WASM 应作为计算实现，而非额外产品语言层。

## 决策

- TypeScript 是产品编排、contract、UI、Worker 和 adapter 的主语言，并启用 strict 模式。
- pnpm workspace 管理 `apps/*`、`packages/*`、`workers/*`；包之间使用显式依赖和导出边界。
- Web 壳采用 React + Vite，Extension 壳采用 WXT；精确版本在 Gate G1 后根据探针锁定。
- Rust/C++ 不用于第一阶段业务编排；必要的 codec/archive 能力优先使用可审计的现成 WASM。
- 未来 Native Helper 可使用更适合系统能力的语言，但必须通过同一版本化 contract 连接。

## 后果

好处：共享代码和类型、开发工具一致、Web/Extension 复用直接。代价：必须严格隔离大文件复制和主线程计算；类型不能代替运行时能力探测。

## 替代方案

- npm workspaces：可行，但本项目接受 pnpm 的严格依赖与 workspace 体验。
- 一开始用 Rust/WASM 重写全部引擎：拒绝，成本高且浏览器文件/权限/UI 仍需 TypeScript。
- Plasmo：可行候选，但当前接受 WXT；若 Phase 1 发现阻断，用替代 ADR 调整。

## 关联文档

- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [DEVELOPMENT_BLUEPRINT.md](../DEVELOPMENT_BLUEPRINT.md)
- [RISK_REGISTER.md](../RISK_REGISTER.md)
