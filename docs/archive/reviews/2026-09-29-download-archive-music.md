# 2026-09-29 下载状态、ZIP 并发与音乐暂存修复

## 范围

- 下载查询缺失记录投影为 `external`（状态未知），保留移除入口；查询错误连续 3 次后停止观察，单次查询上限 10 秒，串行轮询避免请求重叠。恢复历史时不再静默丢弃失踪记录，不把查询失败写成下载失败。
- 对进入 `external` 的已跟踪下载增加“重新检查”菜单动作：只重置本地观察预算并查询既有 Chrome download ID，不重新发起下载。
- ZIP 从首个异步操作前占位，到提交结束才释放；同源 Web Lock 防止跨页面并发解压，缺失锁能力时报错。提交期取消仍不删除已提交文件，失败仍报告部分输出。条目枚举在第 201 项停止，不再先构建全部 entry 对象；不代表 ZIP central directory 解析或峰值内存已完整受控。
- Music 每个暂存文件在创建前取得 Web Lock，成功结果保留锁直到清理，以保护下载重试。打开 Music App 和开始新任务时回收无人持锁的精确 UUID `.stage` 文件；不递归删除目录，不清理无关名称或其他存活任务。
- 历史暂存回收失败降级为独立提示，不再阻断新解密任务；回收先完成文件名快照，再逐项尝试加锁和删除。
- Music 清理等待初始化和在途写入结束；仅将 NotFound 视为已删除，失败保留句柄供重试并显示错误。页面退出不依赖异步清理一定成功，下次打开通过锁恢复。
- SHA-256 对已提交 OPFS 快照的读取和计算移到 Worker；仍有至多 128 MiB 的整文件校验分配，不声明峰值内存降低或性能提升。
- 设备密钥只使用 IndexedDB 的非导出 CryptoKey；缺失 IndexedDB 时拒绝，不再把原始 AES key 存到 storage.local。没有为旧的不可达生产降级路径增加迁移或删除用户数据。
- 密码复制反馈明确剪贴板不随展示倒计时清除；未新增 clipboardRead 权限，不承诺清除系统剪贴板历史。
- UI 遵循 UI v1.8 / UI-05、UI-06：只调整下载未知态、Music 清理错误/重试和密码提示，不修改视觉样式。

## 验证

- `pnpm verify`：通过；54 个测试文件，319 passed / 1 skipped；治理、ESLint、边界、依赖清单、类型、Vite/WXT 构建和包检查通过。相对前一版新增 4 项单元回归，另调整创建恢复测试使用 IndexedDB CryptoKey 测试存储。
- PowerShell 设置 `$env:UNAS_E2E_BROWSER='chrome'` 后执行完整相关命令（下载、ZIP、Music、密码管家、设置和浮层）：21 passed。环境为 Windows 10.0.26200 x64、系统 Chrome 154.0.8037.58、headless、sRGB、1440×900、隔离 Profile、真实 MV3 解包扩展。
- 环境：Windows 10.0.26200 x64，系统 Chrome 154.0.8037.58，headless、sRGB、1440×900，隔离 Profile，真实 MV3 解包扩展。CDP 仅用于加载扩展，加载后断开额外会话；不代表无调试器的 SW 休眠验收。
- 一项 Music 回收用例最初误用了 New Tab 入口，未进入产品断言；改用 Workspace 入口后通过，未放宽产品断言。
- `git diff --check`、`node scripts/governance-docs-check.mjs`：通过。未运行主观 UI 人工验收、真实媒体私有夹具或峰值内存压力测试。

## 证据入口与限制

- 定向单元测试位于 `apps/extension/src/api/real/`、`apps/extension/src/apps/downloader/browserDownloadState.test.ts`、`apps/extension/src/workers/archiveExtraction.worker.test.ts` 和密码库测试中。
- [Music 回归](../../../apps/extension/e2e/musicRecovery.spec.ts) 使用自生成 NCM 容器与非可播放合成字节，记录输入/输出 SHA-256，验证真实 Worker → OPFS → 下载字节一致性，不使用第三方歌曲或私有媒体。
- 下载 E2E 使用受控扩展消息响应；ZIP 使用 OPFS 代替原生目录选择器；暂存恢复使用真实 Web Locks/页面关闭并构造孤儿文件，不等同操作系统杀进程或磁盘配额故障。
- 运行产物由 Playwright 写入忽略目录 `apps/extension/test-results/extension-e2e`；测试源码保留以便重现。没有提交、推送或发布。
- RISK-007、RISK-015、RISK-016 保持开放：原生目录和实际故障、完整 Task/FileRef owner lease、真实音乐矩阵/峰值内存、真实 NAS 均不由本轮自动化替代。
- 2026-09-29 核对 [Web Locks request](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request) 的 `ifAvailable` 语义及 [Chrome downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads) 查询语义；未安装外部 skill 或引入依赖。
