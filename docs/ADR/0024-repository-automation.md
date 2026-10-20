# ADR 0024：仓库自动化与代码扫描边界

- 状态：已接受
- 日期：2026-10-20

## 背景

仓库已有 Dependabot 维护 npm workspace 与 GitHub Actions，策略由 [ADR 0022](0022-dependabot-maintenance.md) 决定。本轮评估免费的 PR 标签、代码扫描、AI 评审、过期提醒、覆盖率与发布机器人，要求不扩大现有 Manifest V3 扩展、密码管家、WebDAV Vault 和 Rust/WASM 的权限或供应链边界。

2026-10-20 只读检查：

- `gh api repos/Ben8368/uNAS/code-scanning/default-setup` 返回 `state: not-configured`；仓库尚无 CodeQL 分析记录。
- 仓库为公开仓库，当前 0 star；Dependabot 更新 PR 持续生成并合入，未发现需要 Renovate 替代的已验证故障。
- 根 `pnpm test:demo` 使用 Vitest，但没有 coverage 配置、coverage 脚本或已声明的 coverage provider；不把锁文件中的可选条目当作覆盖率基础。
- 已有 `.githooks/commit-msg`、ESLint、TypeScript、Vitest、Playwright 与 CI；不新增重复的 pre-commit 服务。

## 决策

| 能力 | 采用方式 | 边界 |
| --- | --- | --- |
| Dependabot | 原样保留 [dependabot.yml](../../.github/dependabot.yml) | 分组、冷静期、PR 上限、人工合并和双 lock 维护不变 |
| Renovate | 不安装 | 未发现 Dependabot 无法完成且已复现的更新；不为替代而违反 ADR 0022 |
| CodeQL | Advanced Setup：GitHub Actions + JavaScript/TypeScript | 不扫描 Rust；不自动修复、合并或发布 |
| CodeRabbit | 提交配置文件，GitHub App 由维护者手动安装 | 不自动批准/合并；不发送真实凭据、用户数据或私有夹具 |
| PR Labeler | 按真实目录添加路径标签 | 仅 `pull_request`；不使用 `pull_request_target`；同仓库 PR 生效 |
| Stale | 只标记无活动 Issue/PR | 永不自动关闭；保护安全、隐私、风险、阻塞、重要和依赖条目 |
| Mergify | 不配置 | 维持依赖 PR 必须人工审核，禁止自动合并 |
| Codecov | 不集成 | 当前没有可靠覆盖率报告；不为集成扩大测试或新增不稳定依赖 |
| pre-commit.ci | 不引入 | 现有 Git hook、ESLint、类型检查和 CI 已覆盖，避免重复检查与改写 |
| Release Please / CLA | 不启用 | 当前交付是解包扩展本地验证，不自动发布；CLA 仅在需要时另行决定 |

### CodeQL

- 工作流为 [codeql.yml](../../.github/workflows/codeql.yml)，扫描配置为 [codeql-config.yml](../../.github/codeql/codeql-config.yml)。
- 语言为 `javascript-typescript` 和 `actions`，均使用 `security-extended` 与 `build-mode: none`。
- 触发为 `main` push、`main` 同仓库 pull request、每周计划与手动触发。来自 fork 的 PR 使用只读 token，不能上传结果，因此不在 PR 工作流中运行；合并后的 push 扫描覆盖其代码。禁止为上传结果改用 `pull_request_target`。
- 权限仅为 `contents: read`、`security-events: write`、`actions: read`、`packages: read`；不授予 contents 写、PR 合并或发布权限。
- 排除生成物、测试、E2E、构建产物、锁文件、历史文档、fixtures 和 WASM 二进制；测试与 E2E 继续由 Vitest/Playwright 验证。
- CodeQL 告警只用于发现候选问题。通过扫描不等于扩展安全验收，不替代权限/CSP、消息路由、真实 Chrome、WASM 复现或人工安全评审。

### PR Labeler 与 Stale

- [labeler.yml](../../.github/labeler.yml) 按 `apps/extension/`、`packages/password-compat/`、`credential-core/`、`filters/`、`scripts/`、`docs/`、`.github/`、依赖清单和 E2E 目录添加标签；一个 PR 可有多个标签。
- 标签由维护者预先创建。Labeler 只申请 `pull-requests: write`，不申请 `issues: write` 自动建标签；`sync-labels: false`，避免移除人工标签。
- Labeler 只在同仓库 PR 运行；fork PR 由维护者按需人工加标签。不得为支持 fork 而启用 `pull_request_target`。
- [stale.yml](../../.github/workflows/stale.yml) 每周运行一次，仅给长期无活动条目加 `stale` 标签；`days-before-*-close` 全为 `-1`，不会自动关闭或合并。
- Stale 保护 `security`、`privacy`、`risk`、`blocked`、`important`；PR 另保护 `dependencies`、`github_actions` 和草稿 PR。
- 标签是分类信息，不是安全结论；不得把所有文件变化标成 `security`。

### CodeRabbit

- 配置为 [.coderabbit.yaml](../../.coderabbit.yaml)，使用 `quiet` 配置、关闭 poem/进度/建议标签等噪声项，并排除生成物、锁文件、历史归档和 WASM 二进制。
- 路径指令聚焦 MV3 信任边界、凭据与 Vault、AdBlock、WebDAV、Files/OPFS、Rust/WASM 和 GitHub Actions 权限。
- 关闭 ESLint、Biome、Oxlint、markdownlint、Rust Clippy 等与既有门禁重复或高噪声的检查；保留 Semgrep、Gitleaks、OSV Scanner、actionlint 和 zizmor。
- 不启用自动批准、请求修改或自动合并。CodeRabbit 只处理已提交到公开仓库的代码差异；禁止提供真实凭据、用户数据、私有测试材料或未公开漏洞。
- 公开仓库符合 CodeRabbit Open Source 计划（公共仓库免费）；当前少于 10 star，平台可能要求手动触发评审。GitHub App 安装是维护者手动动作，本轮不安装、不验证。

## 后果

- 新工作流只在进入默认分支后生效；本轮未运行新的 CodeQL、Labeler、Stale 或 CodeRabbit 任务。
- CodeQL 与 CodeRabbit 可能产生误报，需要维护者分流；不得用机器人结果替代现有质量门禁或安全评审。
- 同仓库 PR 获得 PR 级扫描和路径标签；fork PR 在上传结果为只读 token 限制下不运行 PR 扫描，合并后由 push 扫描覆盖。
- CodeRabbit 引入第三方代码评审服务。它不改变扩展运行时边界，但维护者仍需确保公开 PR 中不含敏感材料。
- Cargo、Rust toolchain、Binaryen、预编译 WASM 与密码兼容 ABI 继续人工升级，并执行来源、锁文件一致性和可复现构建检查；版本机器人不得自动覆盖或重新生成跟踪中的 WASM。
- 扩展权限、host permissions、CSP、扩展身份、WebDAV Vault、密码管理和广告拦截业务逻辑均未改变。

## 替代方案

- Renovate：在 Dependabot 已有工作证据时重复安装会增加维护面和配置冲突，拒绝。
- CodeQL Default Setup 或 `pull_request_target`：前者无法自定义路径/权限与同仓库守卫；后者会给 fork PR 提供写权限，拒绝。
- 同时用 CodeQL 扫描 Rust：当前范围要求保护随包 WASM 与固定工具链，新增 Rust 扫描不能替代 RustSec、WASM 出处和字节复现，先不引入额外变量。
- Mergify / 自动合并：ADR 0022 要求依赖 PR 人工审核，拒绝。
- Codecov：没有现成 coverage 基础，集成需要新增依赖和 CI，收益不足，拒绝。
- pre-commit.ci：与现有 hook、ESLint、类型检查和 CI 重复，拒绝。
- Release Please / 自动发布 / CLA：当前不进行 Chrome Web Store 或 GitHub Release 交付，拒绝自动启用。

## 关联文档

- [Security](../../SECURITY.md)、[Quality](../QUALITY.md)、[AI Rules](../AI_RULES.md)、[Maintainers](../MAINTAINERS.md)
- [ADR 0019](0019-unipass-monorepo-package.md)、[ADR 0021](0021-unas-only-brand.md)、[ADR 0022](0022-dependabot-maintenance.md)
- 官方参考（检索日期 2026-10-20）：[CodeQL advanced setup](https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning)、[actions/labeler](https://github.com/actions/labeler)、[actions/stale](https://github.com/actions/stale)、[CodeRabbit plans](https://docs.coderabbit.ai/management/plans)、[CodeRabbit configuration](https://docs.coderabbit.ai/reference/configuration)
