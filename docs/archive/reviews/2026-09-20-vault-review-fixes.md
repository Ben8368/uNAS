# 2026-09-20 Review 修复验收

## 范围与实现

基于 `342be57` 的本地未提交修复，仅处理本轮审查的三个问题，不改变权限、凭据协议、加密格式、依赖或 UI 样式。

- Vault 配置修改共用后台串行队列：新建、连接、重连、删除、锁定、本地解锁材料及失败次数均在读取前进入队列；拒绝的操作不会阻塞后续请求。
- `fetchWithTimeout` 改为在响应消费回调完成后清除超时；WebDAV GET/目录列表的响应体读取在该作用域内。HTTP 错误和只读取响应头的调用中止未消费 body，保留原有错误文案；支持调用方取消。
- Browser App 视觉测试按 `--window-surface-content` 检查正文背景，覆盖深浅主题、减少透明度、正文无二次 blur 和窗口降级；不通过改 CSS 迎合旧透明度断言。

## 回归证据

- 新增测试：[Vault 配置并发测试](../../../apps/extension/src/unipass/background/vault/vault-configuration.test.ts)、[响应体超时测试](../../../apps/extension/src/unipass/shared/fetch.test.ts)。
- 配置测试在修复前运行首批 8 项，7 项失败：并发删除/保存恢复记录、锁定恢复会话、解锁失败次数漏计均可复现。修复后新增定向测试共 19 项通过。
- `pnpm verify`：通过；29 个测试文件、139 个测试，治理/Lint/边界/依赖/类型/Web 和 MV3 构建/包体检查均通过。
- `pnpm test:e2e`：42/42 通过，0 skipped；修复前为 41 通过、1 个 Browser App 材质断言失败。
- `pnpm --dir apps/extension exec playwright test e2e/glassVisual.spec.ts --repeat-each=3 --output=test-results/glass-review-repeat`：6/6 通过。
- 本地 Node HTTP 探针：服务立即发送响应头、延迟 500 ms 发送 body；真实 fetch 消费回调配置 40 ms deadline 后在 87 ms 观察到超时拒绝，未等到 body 完成。该数值只证明取消路径，不是性能承诺；可复现逻辑由上述 fake-timer 单测覆盖。

## 环境与产物

- Windows `win32 10.0.26200 x64`；Playwright bundled Chromium `151.0.7922.34`，headless、sRGB、1440×900，隔离临时 Profile。
- WXT `0.21.4`，Vite `6.4.3`；MV3 包 938,777 B，初始静态 JS 260,994 B。
- `background.js` SHA-256：`464e853521361e08ea0dce3433c2a7ec1fa5656df5a8284e238327acc51d7b34`。
- 生成截图/环境附件位于被忽略目录 `apps/extension/test-results/extension-e2e/`，重复运行产物位于 `apps/extension/test-results/glass-review-repeat/`。重跑上述命令可生成。
- 已查看 Browser App 浅色及深色减少透明度截图，确认窗口内容与表单完整显示；这不替代目标 Chrome 人工、缩放、触控或独立 UniPass 对照验收。

## 边界

配置队列仅保证单个 Service Worker 运行期的修改顺序，不是跨中断的数据库事务，也不会自动重放中断写操作。合成 storage/network 测试不证明真实 WebDAV 冲突恢复或 Legacy 兼容性。[RISK-014](../../RISK_REGISTER.md#risk-014p0unipass-融合的真实凭据路径与发布身份尚未全部验收) 保持开放；本轮不接触真实账号、不上传用户文件、不提交或发布。
