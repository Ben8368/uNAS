# 依赖 PR 集成与私有源码 CI 验收

日期：2026-10-09。范围：uNAS PR #2–#8 的依赖更新、React 19 类型适配、私有源码 CI 与分支汇入；不修改 UniPass 源码或 gitlink。

## 集成与修复

- [PR #7](https://github.com/Ben8368/uNAS/pull/7) 汇集全部七个 PR，使用 merge commit 保留原始 ancestry；合入 main 后才按 `git merge-base --is-ancestor` 检查并删除其他分支。
- React、React DOM 与对应类型配套升级；显式初始化可清空 ref，允许 input ref 的 null，Markdown heading 限定为 h1–h6。未改业务流程、权限或样式。
- 合入 zip.js、Playwright、Chrome 类型、ESLint 和 Actions 更新，重新生成锁文件与已安装依赖来源清单。React 的后续 Dependabot 更新按同一组处理。
- 锁文件包含修复 GitHub 告警的 `brace-expansion@5.0.12` 和 `source-map-js@1.2.2`；是否关闭远端告警以 GitHub 对 main 的重新扫描为准。
- 原 CI 在私有 UniPass checkout 报 `Repository not found`。按 [ADR 0018](../../ADR/0018-unipass-source-submodule.md) 设置 UniPass 专属只读 deploy key，分别保存至 Actions/Dependabot secrets；按 gitlink 读取源码，checkout 不保留凭据。本机临时私钥已删除，没有使用个人广泛权限 token。

## 客观证据

环境：Windows、Node 24.13.0、pnpm 11.25.0；GitHub CI 使用 Node 22 与根 packageManager 固定的 pnpm。

| 命令或路径 | 结果 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 通过；React/React DOM 配套锁文件可安装 |
| `pnpm verify` | 通过；66 文件，393 passed / 1 skipped；治理、ESLint、边界、依赖清单、类型、Demo/MV3 构建与包体检查通过；安全补丁后再次通过 |
| `pnpm --dir apps/extension run test:e2e:web` | 8 passed |
| `git merge-base --is-ancestor <各分支> HEAD` | 七个原远程分支均已进入集成分支 |
| [GitHub PR CI](https://github.com/Ben8368/uNAS/actions/runs/37894755870) | 私有源码 checkout、冻结安装和 Verify demo 成功；该旧运行被后续安全补丁取代，完整最新结果见 PR #7 Checks |

MV3 全量回归与最新 CI 结果保留在 PR #7 Checks 和本轮任务中；Playwright 附件由工作流保留 14 天。两项本地下载回归曾因并行重建期间缺失 manifest 而无法初始化；停止重建后按原断言重跑，两项均通过。

## 🚦 Audit Report

总体评价：🟡 可通行。没有新增运行时权限、跨层引擎调用、用户数据上传或能力承诺。真实凭据与工具栏手势、人工 UI、ZIP 广泛能力仍分别受 RISK-014、RISK-012、RISK-007 约束；自动回归不关闭这些风险。

## PR #9–#11 后续集成

- [PR #11](https://github.com/Ben8368/uNAS/pull/11) 承载 Lucide、Vitest 和 React 插件的三个分支，保留 merge ancestry。原 #9/#10 存在锁冲突，#11 的 Verify demo 在依赖清单检查失败；统一解析锁文件并重新生成清单。
- React 插件 6 的 peer 要求 Vite 8；WXT 0.21.4 声明兼容 Vite 8，故配套迁移构建器。Vite 固定为符合发布年龄策略的 8.3.3，不保留安装器自动增加的发布年龄例外；Node engines 与 Vitest 5 的 Node 22.12+/24/26+ 范围对齐。Vite 配置用 `import.meta.dirname` 消除原生加载兼容警告。
- 依赖来源清单记录本次实际解析的版本和许可哈希；Lucide 许可证声明仍为 ISC，Vite/Vitest/React 插件仍为 MIT。参考 [Vitest 5 迁移](https://vitest.dev/guide/migration/)、[React 插件](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react) 与 [WXT Vite 配置](https://wxt.dev/guide/essentials/config/vite)；核对日期为 2026-10-09。
- Vite 8 默认 Lightning CSS 压缩器会丢失同时声明的标准 `backdrop-filter`，已在当前安装版本直接复现，与 [Vite #22649](https://github.com/vitejs/vite/issues/22649) 一致。Demo 与 MV3 显式使用 `esbuild@0.28.2` 压缩 CSS，补充直接构建依赖及来源清单；不改视觉 Token 或降低测试断言。UI-01/UI-02 的窗口、Dock、启动器和减少透明度路径受影响，系统 Chrome 154 中原失败的两项 `glassVisual.spec.ts` 已恢复通过；截图位于 `apps/extension/test-results/pr-followup-glass-fixed/`，检查了深色 Files 和减少透明度 Browser App，无溢出或文字遮挡。此前系统 Chrome 的文件/ZIP/Music/UniPass 抽样 14 项通过；这些证据不关闭既有人工验收风险。
- `pnpm install --frozen-lockfile`、`pnpm verify`、`pnpm audit --audit-level=moderate` 通过：66 文件，393 passed / 1 skipped，Demo/MV3 构建和包体检查通过，无已知漏洞。配置调整后重新运行 verify，结果一致。
- CSS 压缩配置修复后上述冻结安装、verify 和 audit 再次通过，清单为 21 项；系统 Chrome Web 回归 `pnpm --dir apps/extension run test:e2e:web` 为 8 passed。完整 MV3/Web CI 仍以 PR #11 最终提交的 Checks 为准，失败的旧运行不作为通过证据。
- 本轮三个原远程分支均通过 `git merge-base --is-ancestor <ref> HEAD`；完整 GitHub MV3/Web 回归结果与系统 Chrome 抽样保留在 PR #11 和本轮任务中。既有风险与人工验收缺口沿用本记录的 Audit Report。
- 保留 Dependabot 自动更新。每轮只删除已合入 main 的分支，不删除后续自动产生且尚未验证的新分支。
