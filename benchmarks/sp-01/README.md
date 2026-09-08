# SP-01：Extension Runtime

## 问题 / 阻断 Gate

验证 MV3 的受控消息、Service Worker 终止/唤醒及多页 Workspace owner 边界，收敛 RISK-003（G2-Core）。本探针不验证文件、引擎、Worker 计算、扩展更新或真实任务恢复。

## 当前环境与方法

- 构建：`apps/extension/.output/chrome-mv3` 的解包 MV3，manifest 仅声明 `storage`。
- 自动化：Playwright 加载解包扩展；每次运行将浏览器版本、OS、扩展 ID、视口和构建路径写入 `apps/extension/test-results/extension-e2e/**/environment.json`。
- 消息：扩展页通过 `browser.runtime.sendMessage()` 发送已废弃的版本化 `workspace.launch`，预期获得结构化拒绝；不访问内部任务状态。
- 生命周期：测试经 Chrome DevTools Protocol 的 `ServiceWorker.stopWorker` 强制终止背景 Worker，再以同一受控消息验证按事件唤醒后的拒绝语义。该调试器辅助用例不替代无调试器的自然休眠对照。

## 初始结果

- 2026-09-08：Chrome for Testing 151.0.7922.34、win32 10.0.26200 x64、headless、1440×900 的解包 MV3 运行中，32 项扩展 E2E 通过。
- 2026-09-07：Chrome for Testing 151.0.7922.34、macOS darwin 25.6.0 arm64、headless、1440×900 的解包 MV3 运行中，31 项扩展 E2E 通过。
- 已覆盖：New Tab 多页 owner、BroadcastChannel 消息限额/白名单、owner 关闭后的 fail-closed、强制 Worker 终止后的消息唤醒与拒绝；以及经 Service Worker 串行化的 Link App 跨标签并发删除。该回归在停止前后均收到相同的结构化 `workspace.launch` 拒绝，证明当前拒绝边界不依赖 Worker 内存状态；并发删除不会恢复任一已删除配置。
- 2026-09-07：维护者在普通 Chrome 的解包扩展中保持超过 40 秒空闲后，重新点击工具栏或刷新 New Tab，均未发现问题；作为无调试器自然休眠后唤醒的人工证据。该结论不声明 Worker 的精确终止时刻，也不覆盖真实任务。
- 未覆盖：浏览器重启、扩展更新、optional permission 拒绝、静态 WASM、Dedicated Worker、offscreen。通用 fixture 和不发现 Worker/不启用 tracing 的独立 Playwright profile 都在 46 秒后仍观察到 BACKGROUND context；headless 远程调试会话无法证明自然休眠，故采用上述普通 Chrome 人工对照。它们保持为 SP-01 未完成项，不能据此关闭 RISK-003。

## 运行与证据

```text
pnpm build:extension
pnpm --dir apps/extension run test:e2e
```

测试产物是本机生成证据，不提交 Git。实际环境、失败 trace 和运行时观察保留在 `apps/extension/test-results/`；测试使用的 CDP API 为实验性，仅限诊断，不进入扩展包或产品运行时。

## 下一步

验证解包扩展更新、浏览器重启与页面关闭终态；结论再决定 RISK-003 的降级、接受或关闭。
