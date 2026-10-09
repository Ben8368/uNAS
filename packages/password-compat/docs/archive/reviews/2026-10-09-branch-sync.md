# 分支合并与 uNAS 密码改进回同步

- 日期：2026-10-09；Windows、Node 24.13.0、Rust 1.98.1、系统 Google Chrome；浏览器使用隔离 Profile。
- 基线：`ee74998`；源码同步提交：`62a38a9`；依赖分支以保留 ancestry 的 merge commit 合并。
- 本轮同步 Git 源码，不创建 tag、Release 或商店发布。初次本地阶段见[源码嵌入验收](2026-10-09-source-integration.md)。

## 合并范围

| 来源 | 结果 |
| --- | --- |
| [PR #20](https://github.com/Ben8368/UniPass/pull/20) | `puppeteer-core` 25.10.0 → 25.12.0；提交 `791f1e8` 保留分支 ancestry |
| [PR #21](https://github.com/Ben8368/UniPass/pull/21) | `@types/chrome` 0.2.9 → 0.3.4；提交 `4ef2939` 保留分支 ancestry |
| uNAS 可移植密码改进 | 飞书重新授权识别、请求读取超时、受限 WebDAV 传输、加密创建恢复、配置/readiness 写入串行化、同步冲突确认、IndexedDB 设备密钥 fail-closed、CredentialSource registry 和无副作用 Legacy 入口 |

两个 PR 原 CI 均因商店已为 `5.3.6`、网络基线仍为 `5.3.4` 且本地为 `5.3.5` 而失败，尚未运行到依赖相关类型/浏览器验收。同步将网络基线更新为 `5.3.6`、本地更新为 `5.3.7`，通过动态查询门禁。依赖冲突保留已验证的合并 package/lock，包含 `fake-indexeddb` 测试依赖；#21 合并只额外移除 lock 中 devtools-protocol 的 `peer` 元数据，版本、integrity 和产品源码未变。

## 🚦 Audit Report

总体评价：🟡 可通行。未新增运行时权限、host 或明文存储；Legacy 入口不安装 standalone 后台/广告事件。`vault-service.ts` 386 行保持配置、CRUD 与同步编排职责；`popup/catalog.ts` 357 行保持目录呈现职责。真实企业登录、WebDAV 和工具栏手势沿用现有人工清单、TD-009/TD-012，不由构建或 smoke 替代。

## 客观验证

| 命令 | 结果 |
| --- | --- |
| `npm run verify` | 通过；184/184 Node、5/5 Rust；治理、依赖审计（0 vulnerabilities）、动态版本、fmt/clippy/native+WASM、类型、构建及 artifact audit GREEN |
| `npm run smoke:chrome` | 通过；独立 MV3、Popup、Service Worker、WASM、重启、真实 IndexedDB stale-write 拒绝及原有广告回归 |
| `git diff --check` | 通过 |

宿主测试与 gitlink 由 uNAS 自己的验收记录维护。日志在忽略的 `artifacts/`，此文件保留可重复命令与结果。
