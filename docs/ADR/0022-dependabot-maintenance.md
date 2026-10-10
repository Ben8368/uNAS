# ADR 0022：Dependabot 依赖维护策略

- 状态：已接受
- 日期：2026-10-10
- 授权：维护者要求评估 Dependabot 的能力和项目收益，并选择性配置。

## 背景

项目已配置根 pnpm workspace 与 GitHub Actions 更新。安装事实源是 `pnpm-lock.yaml`；密码兼容包另有只供 `npm audit` 使用的 `package-lock.json`，来源/许可证清单由 `scripts/dependency-inventory.mjs` 生成。Rust credential-core 的依赖变化还影响随包 WASM 与字节复现。

## 能力与收益

| 能力 | 本项目收益与采用方式 |
| --- | --- |
| 漏洞告警 | 对依赖图中已知漏洞提供通知；GitHub 端已开启，不由 YAML 开关控制 |
| 安全修复 PR | 尝试更新到修复漏洞的版本，降低人工寻找补丁的成本；保留 npm 分组并增加 Actions 安全分组 |
| 定期版本更新 | 自动更新 manifest/lock 与工作流中的 Action 引用，降低 React、WXT、构建和测试工具落后的维护成本 |
| 分组、冷静期、PR 上限 | 减少 PR 与 CI 噪声；关联工具一起审查，major 留给单独迁移 |
| 自动 rebase、更新说明与兼容性评分 | 辅助审查；评分来自其他仓库 CI，不能替代本项目验证 |
| 私有 registry、跨生态分组、告警自动分流 | 当前无必要，不新增凭据，不把 npm、Actions、Rust 合成一个更新 PR |

## 决策

- 可执行配置只维护在 [dependabot.yml](../../.github/dependabot.yml)，时间、分组、冷静期和上限以该文件为准。只保留根目录的 `npm` 与 `github-actions` 两个入口；密码兼容包是 workspace 成员，不另建会竞争修改同一 manifest 的 npm 更新入口。
- npm 的 minor/patch 按 React、生产依赖、构建/浏览器测试工具和其他开发工具分组；匹配多组时先匹配者优先。React major 不再混入关联版本组；所有 major 保留独立 PR，不用全局 `ignore` 屏蔽升级或潜在安全修复。
- 普通版本更新每周检查，加入冷静期并限制同时打开的 PR。安全修复按生态独立分组；版本更新的日程、冷静期和 PR 上限不延迟或限制安全修复。
- Actions 保留 minor/patch 分组、major 单独审查；已用 commit SHA 固定的 Action 由 Dependabot 跟踪更新。普通版本冷静期对 Actions 只使用 `default-days`。
- Cargo 继续人工升级，CI 保留 RustSec 审计。Rust/toolchain/Binaryen/WASM 不交给版本机器人：更新必须同步产物、出处记录并执行 Linux 重建和字节复现验证。此条承接 ADR 0019 的 Cargo 策略，与 [ADR 0021](0021-unas-only-brand.md) 的内部包边界一致。
- 不增加自动合并工作流、Secrets、写权限或 `pull_request_target`。Dependabot PR 走已有 `pull_request` CI，维护者审查后合并；不绕过任何现有质量门禁。

## 更新 PR 的维护步骤

1. 审查更新说明、迁移要求、许可证和包体变化，尤其 React 配套版本、Node 类型与 CI 运行时，以及 `0.x` 包 minor 中可能存在的不兼容变化。
2. 使用根 `packageManager` 指定版本安装：`corepack pnpm install --frozen-lockfile`。不能把根锁文件重新解析为 npm 安装结果。
3. 若密码兼容包依赖变化，在该目录执行 `npm install --package-lock-only --ignore-scripts`，再于根运行 `pnpm password-compat:lock:check`。该 npm 命令独立解析依赖，并不保证与 pnpm 相同；若检查失败，以 pnpm 已解析版本为准人工对齐 npm lock，不能放宽检查。
4. 运行 `node scripts/dependency-inventory.mjs` 更新来源/许可证清单并审查差异，再运行 `pnpm verify`；确认现有 CI 浏览器回归及受影响的 WASM/smoke 检查通过。机器人不会自动生成这些项目专属记录。

## 证据与限制

- 2026-10-10 只读检查：`gh api repos/Ben8368/uNAS/vulnerability-alerts` 返回 HTTP 204；`gh api repos/Ben8368/uNAS/automated-security-fixes` 返回 `enabled: true, paused: false`。两项服务端设置已开启，本轮未修改账号设置。
- 官方支持表仍只列 pnpm 7–10，项目固定 pnpm 11.19.0；[Dependabot PR #6](https://github.com/Ben8368/uNAS/pull/6) 已在这个 packageManager 下生成 manifest 与根锁文件更新并合入，构成保留更新路径的项目证据。它不证明所有 pnpm 11 更新场景都兼容；后续错误以 Dependabot job 日志、冻结安装与 CI 结果判断，不为机器人降级项目工具链。
- 本轮只调整配置与文档，没有升级依赖；新配置尚未进入默认分支，未运行新的 GitHub Dependabot job。漏洞数据库未收录的问题、许可证、产物来源、真实 Chrome 体验和 WASM 复现仍由已有审查与验证负责。

## 后果与替代方案

收益是及时发现已知漏洞、减少手工查版本、控制 PR 数量并保留清晰的迁移审查。代价是冷静期延后普通版本升级，合并前仍需人工同步项目专属资产与审计 lock；分组失败可能需要拆分定位。固定版本依赖也可以被更新 PR 修改，不能把当前精确版本当作永久冻结。

- 全部自动合并：拒绝，无法自动完成许可证清单、双 lock 和浏览器/WASM 验收。
- 全面禁止 major：拒绝，会掩盖必要迁移；保留独立审查。
- 关闭 pnpm 更新或为机器人降级 pnpm：暂不采用，已有项目成功证据，不凭支持表缺项推断当前路径失败。

## 官方参考

检索日期：2026-10-10。

- [配置选项](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)：分组、冷静期、PR 上限、registry 与跨生态更新。
- [支持生态](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories)：pnpm 使用 `npm` 生态，Actions 支持版本标签与 SHA。
- [漏洞告警](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-alerts)与[安全修复](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-security-updates)：独立启用、依赖图边界及兼容性评分。

治理与合并门禁见 [AI Rules](../AI_RULES.md)、[Quality](../QUALITY.md)，安装边界见 [ADR 0004](0004-typescript-pnpm-monorepo.md)。
