# 2026-09-29 创建恢复、同步确认与站点并发修复

## 范围与结果

- 修复本轮 review 的两项 P1 和一项 P2；保留上一轮 Legacy 商店版本 5.3.5 更新。未提交、推送、发布或访问真实企业账号/NAS。
- 新建 Vault 在远端 manifest 写入前保存设备密钥加密的创建记录。失败保留记录，用户以同一规范化 endpoint 再次新建时复用原密钥；已有远端库必须解密成功且 ID 匹配才恢复。成功保存连接后清理记录；不自动覆盖、删除远端数据或后台重放创建。实现见 [pending-creation.ts](../../../apps/extension/src/features/password-manager/background/vault/pending-creation.ts)。
- 本地配置提交失败明确提示恢复方式；设备密钥保存等待 IndexedDB transaction.oncomplete，中止必须拒绝，不以 request.onsuccess 代替事务提交。
- 同步条件写入冲突先 GET 比较完整密文字节；一致则更新远端 revision，保留并发发生的新本地编辑；不同则保持冲突。旧版本已标记的相同内容冲突也可恢复，不强制覆盖或把确认计成新上传。实现见 [sync-engine.ts](../../../apps/extension/src/features/password-manager/background/vault/sync-engine.ts)。
- 暂停、恢复、过期整理共用后台队列，覆盖读取、DNR 替换、存储、通知和失败回滚；队列不会因一次失败失效。实现见 [site-pauses.ts](../../../apps/extension/src/features/adblock/engine/site-pauses.ts)。

## 自动化证据

- `pnpm verify`：通过；49 个测试文件，300 passed / 1 skipped；治理、ESLint、边界、依赖清单、类型、Vite/WXT 构建和包体检查均通过。
- 本轮新增 22 项单测：创建记录不能持久化时禁止远端写入；远端已创建而本地 profile 写入失败的重试；真实 AES-GCM manifest 的恢复；模块重新加载后的恢复；非匹配远端拒绝覆盖；设备密钥事务提交/中止；上传响应丢失与本地确认失败；真/假冲突；同步中的本地编辑；站点暂停/恢复/过期整理并发及失败回滚。
- `pnpm --dir apps/extension exec playwright test passwordManagerApp.spec.ts unipass-integration.spec.ts adblockApp.spec.ts settings.spec.ts --reporter=list`：7 passed。
- E2E 环境：Windows 10.0.26200 x64，Playwright bundled Chromium 151.0.7922.34，headless、sRGB、隔离 Profile，真实解包 MV3。覆盖入口、兼容页、HTTPS 浮层填充/关闭、广告 App 及 WebDAV 设置合成消息流程；没有真实 NAS 请求验收。
- E2E 环境与截图生成于被忽略的 apps/extension/test-results/extension-e2e；可复现的测试源码随仓库保留。
- `git diff --check` 与 `node scripts/governance-docs-check.mjs`：通过。

## 限制

- 不回溯恢复修复前已丢失且未持久化的 Vault Key；恢复依赖本机的加密创建记录和设备密钥仍存在。
- 失败创建记录保留到同 endpoint 恢复完成；本轮不增加丢弃恢复记录的 UI，以免误删唯一密钥。
- 真正的不同内容冲突仍保留，不自动选择一端；真实 NAS、多设备、断网/生命周期实机证据沿用 [RISK-016](../../RISK_REGISTER.md#risk-016p1共享-webdav-传输的真实服务兼容性待验收)。未声明系统 Chrome、视觉或性能验收完成。
