# QMC 用户 ekey 清单导入验证

日期：2026-10-20。决策见 [ADR 0025](../../ADR/0025-user-provided-qmc-ekey-import.md)。仅修改本地工作树，未提交、推送或发布。

## 实现范围

- 音乐 App 增加可选的本地 ekey 清单选择；清单在 Worker 内解析，UI 只持有 `File` 引用，不读取密钥内容。
- 支持 JSON 对象与“文件名 / ekey”交替行；1 MiB、10,000 项、名称和 ekey 各 4,096 字符预算；NFC 精确匹配与唯一 basename 回退。
- QMC `musicex`（`cex\0`）按 `MediaFileName` 查找；无 footer legacy QMC 按所选文件名查找；raw-key/QTag 内嵌 key 优先。
- 补充 `.mflac2` / `.mgg2` 文件选择入口；没有新增权限、网络请求、Native Helper 或任意路径读取。
- 直接 MMKV/SQLite/KGG 解析仍不支持；未提供清单的 `cex\0` 保持结构化失败。

## 客观验证

环境：Windows 10.0.26200 x64；Node `v24.13.0`；bundled Chromium MV3 构建目录 `apps/extension/.output/chrome-mv3`。

| 命令 | 结果 |
| --- | --- |
| `pnpm verify` | 通过（退出码 0）；治理检查、Git hook、lint、Demo 边界、依赖一致性、类型检查、Demo/MV3 构建、包检查和密码兼容包验证均通过 |
| `pnpm test:demo` | 75 个测试文件；495 passed / 3 skipped（跳过项为未配置的私有音乐夹具） |
| `pnpm --dir apps/extension exec vitest run src/features/music` | 4 个测试文件；30 passed / 3 skipped |
| `pnpm --dir apps/extension exec playwright test e2e/musicKeyImport.spec.ts` | 3 passed；覆盖 musicex 解密/哈希/清理、无 footer legacy 解密、缺少 ekey 的结构化失败 |
| `pnpm --dir apps/extension exec playwright test e2e/musicRecovery.spec.ts e2e/musicKeyImport.spec.ts e2e/musicDecrypt.spec.ts` | 7 passed / 9 skipped（私有夹具未配置）；既有音乐 E2E 的文件选择器已改为第一个 `input[type=file]`，未改变断言 |
| `pnpm --dir apps/extension exec playwright test e2e/appTheme.spec.ts -g "music"` | 1 passed；新增 ekey 清单行未破坏 music 的主题/布局状态 |
| `node scripts/governance-docs-check.mjs` | 通过 |

首次全量 `pnpm verify` 仅因既有 `src/features/password-manager/legacy/adapter.test.ts` 的 5 秒超时失败；该文件单独重跑 2/2 通过，随后全量重跑退出码 0（75 个测试文件，495 passed / 3 skipped）。本轮未修改密码管家或 Legacy adapter。

## 可复现证据与限制

- [musicKeyImport.spec.ts](../../../apps/extension/e2e/musicKeyImport.spec.ts) 在真实打包的 MV3 bundled Chromium 中加载 App，断言 `Worker READY`、导入清单文件名、`导入的 ekey` 来源、FLAC 音频签名、输出 SHA-256、暂存清理和 `remoteRequests` 为空。
- 测试向量由 uNAS 测试辅助逻辑生成：[musicex 样本](../../../apps/extension/e2e/musicKeyImport.spec.ts) 使用合成的 30-byte map cipher，不复制上游 `algo/qmc/testdata`、真实用户媒体或真实 ekey。
- 单元测试覆盖清单解析、冲突重复项、控制字符、预算、NFC/basename 查找、musicex tag 边界和 raw-key/QTag 优先级；见 [qmcKeys.test.ts](../../../apps/extension/src/features/music/qmcKeys.test.ts) 与 [algorithms.test.ts](../../../apps/extension/src/features/music/algorithms.test.ts)。
- 未验证：真实 QQ 音乐 `cex\0` 私有样本、目标 Chrome Stable、直接 MMKV/SQLite 解析、真实用户清单兼容性、峰值内存和跨版本行为。该证据不关闭 [RISK-015](../../RISK_REGISTER.md)。
