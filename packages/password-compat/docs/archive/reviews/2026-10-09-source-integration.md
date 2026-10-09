# 嵌入式 Legacy 与密码功能回同步验证

- 日期：2026-10-09；Windows、Node 24.13.0、固定 Rust 1.98.1、已安装 Google Chrome，隔离 Profile。
- 本轮仅修改本地工作区；未提交、推送、打 tag 或创建 Release。
- 源码边界见 [ADR 0007](../../ADR/0007-embeddable-legacy-source.md)。

## 结果

| 命令 | 结果 |
| --- | --- |
| `npm run verify` | 通过；治理、npm audit（0 vulnerabilities）、动态商店版号检查、Rust fmt/native test/clippy/native+WASM build、Node 测试、类型与构建通过 |
| Node 测试 | 184 passed / 0 failed；新增五项源码入口、并发 readiness、空 registry、创建恢复、IndexedDB 缺失回归 |
| Rust 单元测试 | 5 passed / 0 failed |
| `npm run smoke:chrome` | 通过；MV3/Popup/Service Worker/WASM/重启，以及真实 IndexedDB stale-write 拒绝；原广告功能 smoke 通过 |
| `git diff --check` | 通过 |

官方 Chrome 更新接口查询商店为 `5.3.6`，network baseline 为 `5.3.6`，本地 manifest/package 为 `5.3.7`。普通构建 artifact audit GREEN；WASM 为 51,885 B，SHA-256 `db6c133fddf6c59c66ccfeb73328dc5a78acc761a45b27a3bb3b4f45e5b0903c`。

原 Node 夹具此前依赖设备密钥的无 IndexedDB fallback，并使用旧请求函数签名、普通对象请求头和缺少 MutationObserver 的 VM。夹具已适配当前边界；`fake-indexeddb@6.2.5` 仅为开发测试依赖，不进入 runtime bundle。新增创建恢复用例使用真实 Web Crypto 和内存 IndexedDB，证明远端已写入但回执丢失后重试沿用 journal 的 Vault ID 和 Key，不覆盖 manifest。

## 审查限制

总体评价 🟡 可通行。`vault-service.ts` 386 行仍只负责 Vault 配置、CRUD 和同步编排；`popup/catalog.ts` 357 行仍负责目录呈现，本轮未扩展其职责。Legacy 未退役，真实企业登录、真实 WebDAV 冲突和工具栏真实手势不由普通构建或 smoke 代替；沿用原验收清单及 TD-009/TD-012。

本地源码可验证不等于 Git submodule 旧 commit 可复现本轮修改；宿主发布新指针前须先取得已提交、已推送的子仓库 commit。
