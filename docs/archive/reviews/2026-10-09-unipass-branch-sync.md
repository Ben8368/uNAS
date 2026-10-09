# UniPass 分支合并与宿主指针同步验收

- 日期：2026-10-09；Windows、Node 24.13.0、pnpm 11.25.0，系统 Google Chrome，隔离 Profile。
- 本轮接续[源码解耦验收](2026-10-09-unipass-source-submodule.md)，完成此前仅在子模块工作区的改进回同步。
- UniPass 已推送的源码：`b377879c9557abe8cc196e54dd674c7aaa5cd084`；uNAS gitlink 固定该提交，不再依赖未提交子模块源码。

## 同步结果

- UniPass [PR #20](https://github.com/Ben8368/UniPass/pull/20)、[PR #21](https://github.com/Ben8368/UniPass/pull/21) 已合并，保留各分支 ancestry；分别更新 Puppeteer Chrome smoke 工具和 Chrome API 类型。
- 可移植密码改进及嵌入式源码入口已提交并推送；独立扩展的细节和验证由[UniPass 同步验收](../../../sources/UniPass/docs/archive/reviews/2026-10-09-branch-sync.md)维护。
- 两仓库功能边界仍按 [ADR 0018](../../ADR/0018-unipass-source-submodule.md)；本轮仅同步源码与 gitlink，不创建 tag、Release 或发布扩展。

## 🚦 Audit Report

总体评价：🟡 可通行。未新增权限、宿主直接 Legacy 依赖或明文持久化；独立扩展后台/广告不进入宿主入口。真实企业登录、WebDAV 和 action 手势沿用 RISK-014；Legacy 撤除沿用 TD-003。私有子模块的远端 CI 读取授权尚缺，见 RISK-014。

## 客观验证

| 命令 / 位置 | 结果 |
| --- | --- |
| `pnpm verify` / uNAS | 通过；66 文件、393 passed / 1 skipped；治理、lint、边界、依赖、类型、Vite/WXT 构建及包体检查 |
| `npm run verify` / UniPass | 通过；184 Node / 5 Rust；动态版本、依赖审计、类型及独立构建 |
| `npm run smoke:chrome` / UniPass | 通过；MV3、Popup、Service Worker、WASM、重启、真实 IndexedDB stale-write 拒绝及原有广告回归 |
| `UNAS_E2E_BROWSER=chrome` 后运行 `pnpm --dir apps/extension exec playwright test e2e/legacy-login.spec.ts e2e/passwordManagerApp.spec.ts e2e/unipass-integration.spec.ts` | 11/11 通过；登录许可拒绝路径、Desktop/兼容入口、浮窗打开/填充/关闭/页面销毁 |

以上产品验证使用已整合两项升级的源码。分支合并后仅 lock 的 `peer` 元数据变化，版本和 integrity 未变；UniPass 的 `npm ci` 通过。汇总文档初次超出 Context 字符预算，删除历史验证摘要后重新通过治理检查，未提高预算。

## 远端 CI 前提

`gh secret list --repo Ben8368/uNAS --json name` 返回空列表。现有 workflow 使用 `SOURCE_REPOSITORIES_TOKEN || github.token` 初始化私有 UniPass 子模块；需要独立配置仅含两个仓库只读 contents 权限的凭证，不能以本地通过宣称远端 CI 已通过。本轮未把本机 GitHub CLI 的广泛权限 token 保存为 CI secret。

日志和浏览器附件在忽略目录；此文件记录可重复命令，不以构建或合成夹具替代真实企业账号和常用 Profile 人工验收。
