# uNAS 单一品牌与仓库剥离验收

日期：2026-10-09。决策见 [ADR 0021](../../ADR/0021-unas-only-brand.md)。本轮仅修改本地工作树，未提交、推送、发布或修改独立项目。

## 范围

- 内部包迁为 `packages/password-compat` / `@unas/password-compat`；宿主只经 `legacy` public export 消费。
- 删除下游导出脚本及包内独立 CI、Dependabot、Release 和 tag 校验脚本；根 CI 保留依赖、Rust/WASM、smoke 与 hardened 质量检查。
- 测试壳移除外部商店公钥、在线版本查询和下一补丁约束；DNR 移除外部扩展 ID 例外；用户可见标题、错误、提示与无障碍文本统一为 uNAS。
- 持久化 key、Vault ID、加密上下文、企业服务域名和请求协议基线保留兼容值；历史 ADR/验收出处不改写。历史同步条款已标记由 ADR 0021 替代。
- 新增 `brand.test.ts`，检查内部包、移除的发布入口、HTML 和 manifest 品牌与商店身份边界。
- 初始未跟踪 `scripts/unipass-sync/policy.mjs` 草稿已备份到仓库外临时目录后移除；未覆盖其他工作树改动。

## 客观验证

环境：Windows 10.0.26200 x64，Node 24.13.0，pnpm 11.19.0；默认 MV3 E2E 使用 Playwright Chromium 153.0.8010.12、headless、sRGB；独立 smoke 使用本机 Google Chrome（可执行文件版本 154.0.8037.98）。

| 命令 | 结果 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 通过；workspace 链接更新，不升级依赖 |
| `pnpm verify` | 通过；71 个宿主测试文件，455 passed / 1 skipped；兼容包 184 Node tests、5 Rust tests 通过；npm audit 0 vulnerabilities；Lint、边界、类型、Demo/MV3、WASM 登记与产物审计通过 |
| `pnpm test:e2e` | 105 passed / 3 skipped，6.3 分钟；3 个跳过项需私有音乐夹具，本轮未配置 |
| `pnpm --dir apps/extension run test:e2e:web` | 8 passed，20.5 秒；包含材质对比与故障恢复用例 |
| `pnpm --filter @unas/password-compat run smoke:chrome` | 通过；MV3、Popup、Service Worker、WASM、重启、Vault 并发拒绝与 DNR/cosmetic 暂停恢复检查 |
| `node scripts/legacy-retirement-audit.mjs` | 只读导入图盘点成功；不表示 Legacy 已退役 |
| `node scripts/governance-docs-check.mjs` | 通过 |
| `git diff --check` | 通过 |

首次完整验证由新品牌测试检出内部管理页残留 `UNIPASS` 大写标题；修正后重跑完整验证通过。原有兼容包静态审计的 350 行提醒涉及 `vault-service.ts` 与 `catalog.ts`，仍各自负责 Vault 服务和目录 UI，没有新增业务职责。

本机普通 WASM 与已跟踪 Linux 产物均为 51,885 bytes；67 个差异均为路径分隔符（0x2f/0x5c），符合既有宿主差异记录；没有覆盖已跟踪 WASM 或降低逐字节校验。Linux 源码重建和完整 `verify:password-compat:release`（含 hardened）本轮未运行，继续由根 CI 门禁验证。

## 证据与限制

- 本地运行日志位于 `.tmp/brand-verify.log`、`.tmp/brand-e2e.log`、`.tmp/brand-web-e2e.log`、`.tmp/brand-smoke.log`；它们是忽略的本地产物，不作为可复现文档链接。
- E2E 产物位于 `apps/extension/test-results/extension-e2e`，包含环境、运行观察和浅/深浮窗截图。本轮视觉检查确认浮窗标题为 uNAS；合成登录页仍展示其实际企业域名，不伪造域名或抹除兼容协议。
- 未验证真实企业凭据登录、真实 WebDAV 多端冲突、目标 Chrome 常用 Profile/工具栏手势及 Linux CI；仍由 RISK-014 与 TD-003 管理，不因品牌重命名关闭。
- 独立项目的账号级 Secrets、deploy key、远端自动化未读取或修改；如有历史配置，由维护者另行清理。本仓库只有 uNAS origin，不存在活动同步/导出/跨仓库发布入口。
