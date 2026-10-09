# ADR 0019：UniPass monorepo 所有权与独立发布边界

- 状态：已替代
- 替代：[ADR 0021](0021-unas-only-brand.md)；以下保留历史，不再授权镜像、同步或独立发布。
- 日期：2026-10-09

## 背景

[ADR 0018](0018-unipass-source-submodule.md) 把 UniPass 作为私有 Git submodule 固定在 `sources/UniPass`，语义是“UniPass 仓库是事实源，uNAS 是消费者”。实践中该模型带来三类成本：

- 一次改动要先提交推送 UniPass、再更新 gitlink、最后提交 uNAS，两个仓库的验证和历史无法在同一次 review 中审查。
- uNAS CI 必须持有只读 deploy key（`UNIPASS_SOURCE_READ_KEY`）才能检出私有源码，Dependabot 也需要同样的 secret。
- 密码管家的 Legacy 改进几乎都由 uNAS 集成需求驱动，真正的修改者和验收者在 uNAS 一侧。

维护者决定结束该模型：UniPass 源码归 uNAS monorepo 所有，仍保留独立构建和另行发布的能力。

## 决策

- **事实源**：`packages/unipass` 是 UniPass 唯一源码事实源，作为 pnpm workspace 成员（包名 `unipass-extension`，保持不变）。迁移采用 submodule 固定的 `b377879` 的已提交树，迁移时该 submodule 无未提交修改；除新增 `exports` 与两个常量的 public re-export 外不改动源码、版本和行为。
- **public API**：uNAS 只能经 `unipass-extension/legacy` 消费。`package.json` 的 `exports` 显式列出入口，不暴露 `./src/*`；`apps/extension` 内唯一生产 adapter 仍是 `features/password-manager/legacy/adapter.ts`。`scripts/architecture-boundary-check.mjs` 禁止文件路径深导入、未声明子路径、其他消费者以及 `sources/UniPass` 回流，并输出源文件、非法导入与违反规则。
- **下游发布仓库**：`Ben8368/UniPass` 降级为 distribution / release mirror。只允许单向 `uNAS → UniPass`：`pnpm unipass:export` 从 `packages/unipass` 确定性导出到被忽略的 `.artifacts/unipass-export`，默认不联网、不推送；禁止双向同步和在下游仓库直接开发。`.github/`、`AGENTS.md`、`CONTEXT.md` 等随包保留，属于发布仓库元数据，在 monorepo 内不被 GitHub 读取。
- **依赖**：monorepo 安装事实源是根 `pnpm-lock.yaml`。`packages/unipass/package-lock.json` 仅服务独立仓库的 `npm ci` / `npm audit`，由 `pnpm unipass:lock:check` 校验直接依赖与 pnpm 不漂移；不静默删除原有 `npm audit`。
- **WASM**：`apps/extension/public/credential-core.wasm` 保留为已跟踪的派生运行时产物，源码事实源是 `packages/unipass/credential-core`；登记在 `assets/demo-assets.json`，`pnpm unipass:wasm:provenance` 校验登记，`--rebuild` 用固定工具链重建并要求逐字节一致。不制造第三份 WASM。已跟踪字节以 Linux CI 管线（Rust 1.98.1，纯 Cargo 构建，不经 Binaryen）为准：Rust 会把宿主源码路径写进 data 段，Windows 与 Linux 构建只在路径分隔符（0x5c 与 0x2f）上相差 67 字节，因此 Windows 本机的 `--rebuild` 预期不一致。需要更新产物时在 Linux 上运行 `node scripts/credential-core-provenance.mjs --write`，或取 CI 在出处检查失败时上传的 `regenerated-credential-core` 产物，不手改字节或清单哈希。
- **验证分层**：`pnpm verify` = `verify:extension` + `verify:unipass`；`verify:unipass:release` 追加 WASM 重建与可重复性、Chrome smoke 和 hardened 构建。
- **CI**：移除私有源码检出与 deploy key 依赖；拆分 host、UniPass 包、Rust 依赖审计、UniPass release checks 与浏览器回归。

## 后果

- 不再需要 `git submodule update`、`.gitmodules` 和 gitlink；ADR 0018 的“提交顺序”“只读 deploy key”后果作废。
- `UNIPASS_SOURCE_READ_KEY`（Actions 与 Dependabot 两处 secret）及对应 deploy key 不再被引用，应由维护者人工删除；本决定不自动改动账号配置。
- UniPass 自带的 `audit:static` 在线比对 Chrome 商店版号并要求本地版为下一补丁版，因此 `verify:unipass` 依赖网络；这是迁入前就有的门禁，未改动。
- Cargo 依赖不由 Dependabot 更新；RustSec 审计在 CI 中单独运行。
- Legacy 应用级撤除仍受 [TD-003](../TECH_DEBT.md) 约束；本决定只改变源码所有权，不改变运行行为，也不关闭任何真实登录、WebDAV 或目标 Chrome 验收风险。
- 向下游仓库推送、打 tag 和发布需要维护者另行授权。

## 替代方案

- 继续 submodule：保留双仓库提交顺序和私有 CI 凭据，拒绝。
- 放入 `apps/extension/src/UniPass` 或 `vendor/UniPass`：把独立产品单元混入宿主源码，丢失独立构建和包边界，拒绝。
- 仅复制 `src/legacy`：丢失独立扩展、Rust/WASM、安全审计和发布能力，拒绝。
- 双向同步 monorepo 与独立仓库：形成两个事实源，拒绝。

## 关联文档

- 取代 [ADR 0018](0018-unipass-source-submodule.md)；仍遵循 [ADR 0009](0009-unipass-capability-integration.md) 与 [ADR 0013](0013-unas-native-password-manager-adblock.md)。
- [Architecture](../ARCHITECTURE.md)、[Security](../../SECURITY.md)、[README](../../README.md)
