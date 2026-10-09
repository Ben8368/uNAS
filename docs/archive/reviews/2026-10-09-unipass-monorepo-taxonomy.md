# 2026-10-09 UniPass 迁入 monorepo 与扩展源码分层验收

范围：[ADR 0019](../../ADR/0019-unipass-monorepo-package.md)（UniPass 所有权）与 [ADR 0020](../../ADR/0020-extension-source-taxonomy.md)（源码分层）。环境：Windows 11、Node 24.13、pnpm 11.19（corepack）、Rust 1.98.1 + wasm32、Playwright bundled Chromium。均在本机，未运行 Linux CI。

## UniPass 迁移

- 旧 gitlink `b377879c9557abe8cc196e54dd674c7aaa5cd084`；迁移时 submodule 无未提交修改。`.git/modules/sources/UniPass` 历史未动，旧工作树移到系统临时目录备份（含被忽略的 `node_modules`、`dist`、3 个 `artifacts/sync-*.log`）。
- 以 `git archive` 取出 177 个文件；LF 归一化后 175 个与固定 commit 的 blob 逐文件一致，其余 2 个为有意改动（`package.json` 增加 `exports`，`src/legacy/index.ts` 增加 `STORE_PLUGIN_VERSION`、`parseRuntimeConfig` 两个 re-export）。
- 提取时 174 个文本文件为 CRLF（`core.autocrlf=true`），已按仓库 `.gitattributes` 归一化为 LF；否则 UniPass 自身治理检查报 CONTEXT.md 2801/2800 字符。
- `credential-core.wasm` 由 `packages/unipass/credential-core` 重建后与 `apps/extension/public/credential-core.wasm` 逐字节一致（sha256 `db6c133f…903c`，51885 B），Windows 本机。

## 验证（本机实测）

| 命令 | 结果 |
| --- | --- |
| 基线 `pnpm verify`（迁移前） | 66 文件，393 passed / 1 skipped |
| 基线 `pnpm test:e2e`（迁移后 P0） | 105 passed / 3 skipped |
| `pnpm verify`（全部改动后） | 退出 0；67 文件，399 passed / 1 skipped；UniPass 184 Node + 5 Rust 通过；store 版本 5.3.6 / 本地 5.3.7 |
| `pnpm test:e2e` 首次 | 104 passed / 1 failed / 3 skipped：`layout.spec.ts:47` 200% 布局下图标 x 断言 |
| 该用例单独重跑 | 3 + 5 次均通过 |
| `pnpm test:e2e` 重跑 | 105 passed / 3 skipped |
| `test:e2e:web` | 8 passed |
| 导出树（仓库外）`npm ci` → typecheck → test → build | 全部退出 0 |
| `unipass:export:check` | 177 文件，两次导出 tree sha256 一致 |

首次 E2E 的失败未能复现，原因未定位；不能据此认定为既有偶发，也不能认定为无关。重跑通过只是不再复现的证据。

## 未验证

- Linux CI 上 WASM 与已跟踪产物的逐字节一致、`verify:unipass:release`（可重复性、Chrome smoke、hardened）本轮未运行；新 CI 工作流从未在 GitHub 上执行过。
- 系统 Chrome、真实登录、WebDAV、工具栏手势与视觉人工验收均未做，沿用 TD-002、TD-003、RISK-014 状态。
- `UNIPASS_SOURCE_READ_KEY`（Actions 与 Dependabot）及对应 deploy key 需维护者人工删除。

## 分层迁移

- 323 个文件 `git mv`，353 处导入由 AST codemod 改写（130 个文件）；codemod 为一次性脚本，未入库。
- codemod 改不到的路径字符串逐一手改：3 个按路径读源码的测试、4 个 HTML 入口、`e2e-web` 的 `page.route` glob（失效会静默）、`demo-assets.json`、4 个仓库脚本。
- 文档路径批量改写时脚本曾把链接前缀写成字面量 `$1`，治理检查误判通过；已按文件深度确定性还原，并核对 64 条指向 `apps/extension/src` 的链接全部可解析。
- `adapter.test.ts` 的禁止导入正则原只匹配 `sources/UniPass`，对 `unipass-extension` 失效；已补并用违规样例验证会失败。
- 边界检查六条层级规则、结构规则与 UniPass 规则均用违规样例验证会触发；基线 0 条。
- 视觉证据：`visual-evidence/`（2 个 PNG）与 `artifacts/visual/`（12 个文件）无任何文档引用，已移出工作树，可从 HEAD 恢复；`artifacts/` 下 16 个未跟踪 `.log` 为本地文件，未触碰。
