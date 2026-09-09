# SP-01：Extension Runtime

## 问题 / 阻断 Gate

验证 MV3 的受控消息、Service Worker 终止/唤醒及多页 Workspace owner 边界，记录已关闭 RISK-003（原 G2-Core）的证据。本探针覆盖当前本地解包扩展的重载更新；不验证文件、引擎、Worker 计算、Chrome Web Store 更新或真实任务运行期间的恢复。后者待首个真实任务接入后另行验收。

## 当前环境与方法

- 构建：`apps/extension/.output/chrome-mv3` 的解包 MV3，manifest 仅声明 `storage`。
- 自动化：Playwright 加载解包扩展；每次运行将浏览器版本、OS、扩展 ID、视口和构建路径写入 `apps/extension/test-results/extension-e2e/**/environment.json`。
- 消息：扩展页通过 `browser.runtime.sendMessage()` 发送已废弃的版本化 `workspace.launch`，预期获得结构化拒绝；不访问内部任务状态。
- 生命周期：测试经 Chrome DevTools Protocol 的 `ServiceWorker.stopWorker` 强制终止背景 Worker，再以同一受控消息验证按事件唤醒后的拒绝语义。该调试器辅助用例不替代无调试器的自然休眠对照。

## 初始结果

- 2026-09-08：Chrome for Testing 151.0.7922.34、win32 10.0.26200 x64、headless、1440×900 的解包 MV3 运行中，34 项扩展 E2E 通过。
- 2026-09-08：新增跨浏览器进程重启的解包扩展回归：两个独立 persistent Chromium context 复用同一 profile，Link App 配置在重启后仍可加载；该证据只覆盖 `storage.local` 持久化，不代表任务恢复或系统 Chrome。
- 2026-09-08：新增解包扩展更新回归：在临时目录复制构建物，写入递增 manifest 版本后经 `chrome://extensions` 的开发者模式 Reload 重载；新页面读取新版本，Link App 配置仍可加载。该证据覆盖 Chrome for Testing 中的解包重载，不代表 Chrome Web Store 更新、真实任务恢复或 Stable Chrome 自动化验收。
- 2026-09-07：Chrome for Testing 151.0.7922.34、macOS darwin 25.6.0 arm64、headless、1440×900 的解包 MV3 运行中，31 项扩展 E2E 通过。
- 已覆盖：New Tab 多页 owner、BroadcastChannel 消息限额/白名单、owner 关闭后的 fail-closed、强制 Worker 终止后的消息唤醒与拒绝；以及经 Service Worker 串行化的 Link App 跨标签并发删除。该回归在停止前后均收到相同的结构化 `workspace.launch` 拒绝，证明当前拒绝边界不依赖 Worker 内存状态；并发删除不会恢复任一已删除配置。
- 2026-09-07：维护者在普通 Chrome 的解包扩展中保持超过 40 秒空闲后，重新点击工具栏或刷新 New Tab，均未发现问题；作为无调试器自然休眠后唤醒的人工证据。该结论不声明 Worker 的精确终止时刻，也不覆盖真实任务。
- 2026-09-09：维护者确认 Chrome Stable 152.0.7977.82 / win32 10.0.26200 x64 的解包扩展自然休眠、唤醒、浏览器重启和 `chrome://extensions` Reload/update 路径验收通过；Link App 配置保持，未出现假成功终态。该人工验收与自动化证据共同关闭当前 MV3 壳层范围的 RISK-003。
- 当前范围外：Chrome Web Store 更新、optional permission 拒绝、静态 WASM、Dedicated Worker、offscreen 和真实任务运行期间的 Worker/任务终态。Chrome Web Store 只有进入商店计划后才按 SP-08 与 RISK-008 验收；真实任务生命周期只有首个真实任务接入后才有可执行验收对象。

## 当前结论

RISK-003 已关闭，范围是当前本地解包 MV3 壳层：多页 owner、fail-closed 消息边界、Service Worker 强制终止/唤醒、Chrome Stable 自然休眠与浏览器重启、解包扩展 Reload/update。该结论不外推到尚未实现的真实任务运行期间。

## 运行与证据

```text
pnpm build:extension
pnpm --dir apps/extension run test:e2e
```

测试产物是本机生成证据，不提交 Git。实际环境、失败 trace 和运行时观察保留在 `apps/extension/test-results/`；测试使用的 CDP API 为实验性，仅限诊断，不进入扩展包或产品运行时。

## 未来范围

后续仅保留范围外事项：真实任务接入后重新验收任务运行期间的 Worker/任务终态；进入商店计划后另按 SP-08 与 RISK-008 验收 Chrome Web Store 更新。不将这些未来事项重复计入当前 RISK-003 阻断。
