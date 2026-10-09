# UniPass 源码子模块与密码功能同步验收

- 日期：2026-10-09
- 环境：Windows；Node 24.13.0、pnpm 11.25.0；Playwright bundled Chromium 与已安装 Google Chrome，均使用隔离 Profile。
- 结论：本地源码解耦和功能同步已验证；未提交、推送或发布。Legacy 仍启用，撤除未验收。

## Git 指向机制

通过认证后的 GitHub API 读取 RockDSM-Virt 的 `.gitmodules` 与 `contents/linux-5.10.x`：该目录类型为 `submodule`，URL 为 `https://github.com/931122/rk_syno_kernel.git`，commit 为 `c6d327b94e694c8d380618d0831c30d92f20a5f4`。

本仓库已添加 `.gitmodules` 和 `sources/UniPass` gitlink。`git ls-files --stage sources/UniPass` 返回 mode `160000`、commit `ee749982cc31efbcf912866b854afbf5f1b36c1c`；URL 为 `https://github.com/Ben8368/UniPass.git`。子模块本地有本轮修改，gitlink 尚未包含新实现，干净克隆此旧指针不能取得本轮改动。

维护者授权提交/推送后，须先提交并推送 UniPass，再固定主仓库 gitlink，最后提交主仓库；两个仓库不能只提交主仓库完成同步。私有子模块的 CI 读取权限需配置 `SOURCE_REPOSITORIES_TOKEN`，本轮未设置远端 secret 或验证远端 Actions。

## 实现范围

- 宿主移除重复 Legacy API、WASM loader、目录、availability、身份校验、登录与 Jupiter 实现；生产源码仅在 `legacy/adapter.ts` 导入 `sources/UniPass/src/legacy/index.ts`。
- 子模块入口无初始化副作用，显式安装幂等；宿主继续拥有统一路由、WebDAV Vault、Desktop、页面浮窗和唯一 WXT Service Worker。子模块 standalone 后台不进入宿主 bundle。
- 同步可移植的 Feishu 双块/折叠权限识别、请求超时、WebDAV 路径和资源预算、加密创建恢复 journal、配置/同步状态写入队列、sync 冲突修复、IndexedDB 设备密钥 fail-closed 和 CredentialSource registry。
- UniPass 维持独立品牌、UI、广告与签名身份；官方商店查询为 `5.3.6`，本地替身改为 `5.3.7`，未创建 Release。
- `fake-indexeddb@6.2.5` 仅作为 UniPass 测试开发依赖（[上游说明](https://github.com/dumbmatter/fakeIndexedDB)），不进入扩展运行 bundle；锁文件已更新，依赖审计无漏洞。

## 🚦 Audit Report

**总体评价：🟡 可通行。** 本轮无新增运行时权限、数据格式变更或明文持久化。源码隔离不等于 Legacy 撤除，仍由 TD-003 跟踪；真实企业登录、WebDAV 冲突、工具栏手势及来源许可仍受 RISK-014 约束。子模块未提交修改不能由旧 gitlink 复现。

## 客观验证

| 命令 / 位置 | 结果 |
| --- | --- |
| `pnpm verify` / uNAS | 通过；66 个测试文件，393 passed / 1 skipped；治理、lint、边界、依赖、类型、Vite/WXT 构建和包体检查通过 |
| `npm run verify` / sources/UniPass | 通过；184/184 Node 测试、5/5 Rust 测试；fmt、clippy/native+WASM、WASM build、类型与独立构建通过；artifact audit GREEN |
| `npm run smoke:chrome` / sources/UniPass | 通过；独立 MV3、Popup、Service Worker、WASM、重启和真实 IndexedDB stale-write 拒绝；广告原有 smoke 通过 |
| `pnpm --dir apps/extension exec playwright test e2e/legacy-login.spec.ts e2e/passwordManagerApp.spec.ts e2e/unipass-integration.spec.ts` | bundled Chromium 11/11 通过；登录安全边界、Desktop/兼容入口、浮窗打开/填充/关闭/页面销毁 |
| 上述命令，设置 `UNAS_E2E_BROWSER=chrome` | 初次 10 passed / 1 failed；失败是合成页面尾部脚本未解析导致 `revealScopes is not defined`，不是权限拒绝断言失败 |
| `UNAS_E2E_BROWSER=chrome` 后运行 `pnpm --dir apps/extension exec playwright test e2e/legacy-login.spec.ts` | 修复夹具后 8/8 通过；处理函数先于 markup 安装，DOM 加载完成才操作；额外权限/未知结构/OAuth 校验仍拒绝 |
| `node scripts/legacy-retirement-audit.mjs` | 通过；未解析相对导入 0；宿主直接源依赖均来自单个 adapter 文件；报告明确 `retirementAccepted: false` |
| `git diff --check` / 两仓库 | 通过 |

UniPass 旧测试夹具同步适配新的消费回调、Headers、MutationObserver、readiness 清理和 IndexedDB；新增无启动副作用、readiness 并发、空 registry、未确认创建恢复和缺少 IndexedDB 五项回归，不降低安全断言。

宿主与 UniPass 构建的 `credential-core.wasm` 均为 51,885 B，SHA-256 均为 `db6c133fddf6c59c66ccfeb73328dc5a78acc761a45b27a3bb3b4f45e5b0903c`。宿主固定/可选 host permissions 和 Vault 加密兼容标识保留。

日志和浏览器附件是忽略目录中的本地生成物；本文件记录可重复命令与结果，不以这些目录作为文档链接。构建、合成 OAuth 页面和自动 smoke 不替代真实账号/常用 Profile 人工验收。

## 关联

- [ADR 0018](../../ADR/0018-unipass-source-submodule.md)
- [TD-003](../../TECH_DEBT.md#td-003legacy-密码能力尚未完成应用级解耦)
- [RISK-014](../../RISK_REGISTER.md#risk-014p0密码管家融合的真实凭据路径与发布身份尚未全部验收)
