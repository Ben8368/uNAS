# Git 提交署名校验验收

- 日期与环境：2026-10-10，Windows，`C:\uNAS`。
- 范围：提交消息 hook、安全安装器、真实 Git 回归，以及治理文档和验证入口；没有修改产品源码或提交历史。
- 规则与操作以 [AI_RULES](../../AI_RULES.md#仓库级署名校验) 为准。

## 已执行

| 命令 | 结果 |
| --- | --- |
| `pnpm git:hooks:install` | 成功；本仓库 `core.hooksPath=.githooks`，未修改全局身份 |
| `pnpm test:git-hooks` | 15 项通过：1 个父测试、2 个安装测试、12 个真实提交测试 |
| `pnpm verify` | 完整入口退出码 0；宿主 455 passed / 1 skipped，密码兼容包 184 Node / 5 Rust 测试通过 |
| `pnpm exec eslint scripts/install-git-hooks.mjs scripts/git-hooks.test.mjs --max-warnings 0` | 通过 |
| `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 -color .github/workflows/ci.yml` | 通过 |
| `node scripts/governance-docs-check.mjs`、`git diff --check` | 通过 |

完整验证包含类型检查、Demo/MV3 构建与包体检查、架构和依赖边界、密码兼容包审计、Rust QA、WASM 出处和构建。兼容包静态审计仍报告已有的文件长度 YELLOW（`vault-service` 386 行、`popup/catalog` 357 行）；该结果不是本轮引入，也未作为全部审计 GREEN 汇报。

真实提交覆盖缺失署名、Cursor checkpoint、正文提及与字面换行、错误邮箱、人工声明冲突，以及三种工具、多工具、CRLF 和纯人工声明。拒绝时 HEAD 与暂存树保持不变；通过时原始消息保持不变。安装测试验证既有路径与 hook 不被覆盖，并验证重复安装和仓库级配置。

## 验证边界

- 首轮 CRLF 测试错误地预期 Git 会规范化换行；已改用原始 commit 对象断言消息原样保留，重跑通过。
- 本轮仅涉及工具与治理，未重跑浏览器 E2E、系统 Chrome smoke 或发布 hardened 检查；既有浏览器证据见 [2026-10-09 验收](2026-10-09-unas-brand-independence.md)。
- 已接入 CI 并检查 workflow 语法；Linux CI 的实际运行结果尚未取得。
- 本地 hook 可以被未安装或 `--no-verify` 绕过；CI 测试 hook 行为，不强制扫描远端每个提交的署名。
- 历史 HEAD 保持 `ec6f3f9dd0bfda3770e3ff029d9c8f2bc81f5698`；没有替历史提交推断 AI 来源。
