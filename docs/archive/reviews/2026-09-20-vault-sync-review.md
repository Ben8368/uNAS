# 2026-09-20 Vault 同步失败路径补充审查

## 范围

在[上一轮 Review 修复](2026-09-20-vault-review-fixes.md)上继续检查同步与共享状态，修复两个已复现的问题组；不改 UI、消息权限、加密协议、远端数据或依赖。

1. 同步就绪状态仍整表读改写：两个 Vault 同时完成会丢掉一个 ready 状态；clear 与 mark 交错可能恢复已清除状态。现在所有 readiness 修改共用串行队列，失败不会阻塞后续操作。
2. 远端 list 返回对象但 GET 返回空时，原实现静默跳过并可能报告 `synced`。现在中止本次拉取，在既有状态模型下返回 `offline`；显式 `pull()` 拒绝，不提交已暂存下载，保留旧缓存供下次重试。同步中后续上传/缓存提交失败时，也保留此前已成功完成的上传/下载计数。

## 可复现测试

- [sync-readiness.test.ts](../../../apps/extension/src/modules/password-manager/background/vault/sync-readiness.test.ts)：并发 mark、clear/mark 交错、同 Vault 顺序、存储写失败后恢复。
- [sync-engine.test.ts](../../../apps/extension/src/modules/password-manager/background/vault/sync-engine.test.ts)：新增与已有对象 GET 丢失、不完整拉取不提交、上传/下载部分成功计数、下载中本地编辑保护、远端版本冲突保护、失败后重试。
- 修改前首批 9 项测试中 7 项失败；修复后扩展为 12 项，全部通过。
- 定向命令：`pnpm --dir apps/extension exec vitest run src/unipass/background/vault/sync-readiness.test.ts src/unipass/background/vault/sync-engine.test.ts`。

## 完整验证

- `pnpm verify`：通过，31 个测试文件、151 个测试；治理、Lint、边界、依赖、类型检查、Web/MV3 构建及包体门禁全部通过。
- `pnpm test:e2e`：42/42 通过，0 skipped。
- 环境：Playwright bundled Chromium 151.0.7922.34，Windows win32 10.0.26200 x64，隔离临时 Profile；不是系统 Chrome 人工认证。
- MV3 包 938,840 B，初始静态 JS 261,012 B；`background.js` SHA-256：`627b0b8759ae8f20e990a9d057a6ad2d5dcdeea62feb2b46396f4bbc0c9e0081`。
- `node scripts/governance-docs-check.mjs`、`git diff --check`：通过。

## 边界

使用内存 cache store、合成 backend/storage 验证实际同步引擎逻辑，不代表真实 WebDAV 服务兼容性。串行化 readiness 写入不等于为所有同步任务提供生命周期取消，也不构成跨 Service Worker 中断事务。真实外部服务和人工路径继续由 [RISK-014](../../RISK_REGISTER.md#risk-014p0unipass-融合的真实凭据路径与发布身份尚未全部验收) 跟进，未关闭任何发布 Gate。
