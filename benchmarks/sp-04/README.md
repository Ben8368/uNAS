# SP-04：Archive ZIP

## 问题 / 阻断 Gate

验证解包 MV3 扩展能否在用户已授权的目录中安全解压单个 ZIP。该探针关联 RISK-007；当前仅记录一条受限实现和自动化成功证据，不关闭 Archive 模块 Gate。

## 实现边界

- 输入：单个 `.zip`，先验证 ZIP magic；最大 50 MiB。
- Worker：打包的 `archive-worker.js` 使用 `@zip.js/zip.js 2.8.60` 严格读取，禁用其内部 Worker；最多 200 项、单项 32 MiB、展开总量 64 MiB、深度最多 12。
- 安全：拒绝绝对/反斜杠/穿越/保留名路径、加密、软链接、重复条目和文件目录冲突；读取时校验 CRC。
- 输出：先把已验证 Blob 暂存于受限内存，再创建唯一同级目录提交；不覆盖已有项目。取消仅在提交前生效，提交失败不标记成功并保留已写入的部分结果。

## 已验证证据

- 2026-09-10，Windows win32 10.0.26200 x64、Playwright bundled Chromium、解包 MV3：`pnpm build:extension` 后运行 `pnpm --dir apps/extension exec playwright test e2e/archiveExtraction.spec.ts` 通过。
- 夹具是内联、可复现的 Store/Deflate ZIP：`nested/hello.txt` 内容为 `uNAS ZIP extraction fixture`。测试将其写入隔离 OPFS handle，经过真实的扩展页 Dedicated Worker，确认 CRC 校验后的新目录 `fixture（解压）/nested/hello.txt` 内容精确一致；无页面错误、无 HTTP(S) 请求。
- 单元测试 `src/archive/zipSafety.test.ts` 覆盖相对路径、穿越/绝对/盘符/反斜杠/保留名/重复分隔符、加密、软链接、文件目录冲突和资源上限。

## 未覆盖

- 损坏/ZIP64/伪扩展名/压缩炸弹等真实负向夹具，原生 OS 目录与权限拒绝，取消与页面关闭，Worker 崩溃，配额/写入失败，以及目标 Chrome Stable 的人工验证和资源测量。
- 不支持 RAR、7z、TAR、分卷、密码输入或损坏包修复；不把本探针结论外推为通用 ZIP 支持。

## 当前结论

受限 ZIP 解压为**已实现未验证**：自动化 MV3 正向路径可运行，但 RISK-007 仍阻断 Archive 模块 Gate。后续证据和范围变化只更新本记录与 RISK-007。
