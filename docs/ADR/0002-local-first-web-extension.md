# ADR 0002：Local-first Web 为主，Extension 为入口

- 状态：已替代
- 日期：2026-09-03
- 替代者：[ADR 0005](0005-extension-native-new-tab-workspace.md)

## 背景

目标体验接近桌面文件工具，但首要价值是无需安装、文件默认不离开设备。Web、浏览器扩展、桌面壳和服务器各有不同权限与性能边界，若同时建设会分裂产品和契约。

## 决策

- 首发产品是本地优先 Web 工作台，默认不上传用户文件。
- 浏览器扩展复用同一 contracts/core，只负责受控网页入口、用户明确选择的资源和工作台复用。
- V1 不提供默认云处理，也不承诺 Native Helper。
- Web 无法覆盖的能力先明确降级或不支持；只有真实基准和用户需求证明必要时才提议 Tauri / Native Messaging / server adapter。
- 任何新增形态必须实现同一任务与引擎语义，并单独评审隐私、安装、权限、签名、升级和回滚。

## 后果

好处：隐私边界清晰、可共享 80% 以上非 UI 逻辑、避免过早维护多套运行时。代价：V1 对大文件、特殊 codec 和系统级能力的覆盖会受浏览器限制。

## 替代方案

- 一开始做 Electron/Tauri：暂缓，安装与本地桥接增加供应链和权限成本。
- 所有任务上传服务器：拒绝作为默认路径，与 local-first 价值冲突。
- Extension 内复制完整应用：拒绝，会造成状态和权限双轨。

## 关联文档

- [PRODUCT.md](../PRODUCT.md)
- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [SECURITY.md](../../SECURITY.md)
