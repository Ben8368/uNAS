# Architecture Decision Records

ADR 记录影响长期维护的决定及理由。Roadmap 说明“按什么阶段做”，ADR 说明“为什么采用这一边界”。

## 状态

- **提议**：允许研究，不允许当作已锁定事实。
- **已接受**：实现必须遵守；改变时新增替代 ADR。
- **已替代**：保留历史，并链接替代它的新 ADR。
- **已拒绝**：保留曾评估方案及拒绝理由。

## 格式

文件名为 `NNNN-short-title.md`，正文包含：状态、日期、背景、决策、后果、替代方案、关联文档。

## 当前 ADR

| 编号 | 状态 | 决策 |
| --- | --- | --- |
| [0001](0001-governance-entry.md) | 已接受 | 单一 AI 入口与证据驱动治理闭环 |
| [0002](0002-local-first-web-extension.md) | 已替代 | 原 Web 主体方案，由 0005 替代 |
| [0003](0003-unified-task-engine-contract.md) | 已接受 | 统一 Job / Engine Contract 与 Worker 隔离 |
| [0004](0004-typescript-pnpm-monorepo.md) | 已接受 | TypeScript + pnpm monorepo 与共享核心包 |
| [0005](0005-extension-native-new-tab-workspace.md) | 已接受 | 扩展是唯一产品，New Tab + Workspace 分层 |
| [0006](0006-frontend-demo-first.md) | 已接受 | 前端 Demo 先行，通过 mock/real adapters 演进 |
| [0007](0007-inline-app-workspace.md) | 已接受 | 内置 App 同页打开，逻辑 Workspace 单一 owner 与受限同源客户端 |
| [0008](0008-private-preview-modern-chrome.md) | 已接受 | 私有预览追随 Chrome Stable，原生 API 优先与主动移除旧版兼容负担 |
| [0009](0009-unipass-capability-integration.md) | 已接受 | AdBlock、WebDAV Vault、Legacy 边界与原版页面浮层并入 uNAS 的单一 MV3 构建 |
| [0010](0010-clean-room-mmkv-replacement.md) | 已接受 | 不再依赖无许可证的上游 `go-mmkv`；如需 MMKV 能力，采用自有 clean-room 实现 |
| [0011](0011-local-authorized-music-processing.md) | 已接受 | 允许用户明确有权处理的本地 KGM/QMC/NCM 容器解密；禁止在线 DRM、账号、密钥和内容分发路径 |
| [0012](0012-repository-filter-subscription.md) | 已接受 | 仓库自维护 JSON 补充订阅；独立缓存、受限 CSS 与随包兜底，不替换原有订阅 |
| [0013](0013-unas-native-password-manager-adblock.md) | 已接受 | uNAS 统一品牌；密码管家与广告拦截解耦，冻结既有密码浮窗并保持 Vault 兼容 |
| [0014](0014-shared-webdav-transport.md) | 已接受 | 共享受限 WebDAV 传输、密码库仅使用 WebDAV、Legacy 撤除边界 |
| [0015](0015-file-manager-dav-cache.md) | 已接受 | Files 独立 WebDAV 文件连接、浏览器下载记录、OPFS 缓存与持久存储申请；缓存容量条款由 0016 替代 |
| [0016](0016-file-cache-quota.md) | 已接受 | Files 临时缓存单文件 256 MiB、最多 200 项，取消应用层固定总量上限 |
| [0017](0017-unified-file-read-preview.md) | 已接受 | 受控 FileRef、WebDAV 分段读取与交互式预览 |
| [0018](0018-unipass-source-submodule.md) | 已替代 | 历史密码兼容源码 submodule 与 Legacy adapter 入口，由 0019 替代 |
| [0019](0019-unipass-monorepo-package.md) | 已替代 | 历史 monorepo 与下游镜像方案，由 0021 替代 |
| [0020](0020-extension-source-taxonomy.md) | 已接受 | 扩展 `src` 按 owner 分为 shell / features / platform / shared，并由边界检查强制 |

| [0021](0021-unas-only-brand.md) | 已接受 | 仅维护 uNAS 品牌，内部密码兼容包与独立项目无同步或发布关系 |
| [0022](0022-dependabot-maintenance.md) | 已接受 | Dependabot 分组维护 npm 与 Actions，保留人工合并、双 lock 和 WASM 门禁 |

“已接受”表示维护者接受的方案基线，依据见各 ADR；不等于对应源码已实现或 Gate 已通过。若后续阶段改变边界，须以新 ADR 替代。0002 只保留历史，不再约束实现。
