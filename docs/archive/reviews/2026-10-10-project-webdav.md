# 项目级 WebDAV 与文件管理排版验证

日期：2026-10-10。决策见 [ADR 0023](../../ADR/0023-project-webdav-connections.md)。仅修改本地工作树，未提交、推送或发布。

## 实现范围

- Settings 统一管理共享 WebDAV，Files 与密码管家消费同一连接；旧管理页和浮窗跳转统一入口，旧独立配置消息经来源校验后拒绝。
- 认证信息在设备上加密保存；密码库只关联连接 ID 并保留自己的 Vault Key。旧配置迁移保留路径、密钥及锁定状态。
- 用户同意后保存连接并自动配置密码库；已有远端密码库需要恢复密钥，初始化失败显示部分成功，不覆盖已有数据。普通文件上传仍由用户明确触发。
- Files 移除重复认证表单，收紧工具栏、地址/搜索行及操作列；窄屏保留文件名与操作，长说明折叠到页脚。
- 更新/移除连接使旧 Files 会话失效；保护密码库路径；移除只清理关联的本地配置。

## 客观验证

环境：Windows 10.0.26200 x64；系统 Chrome 154.0.8037.98、headless、sRGB、隔离 Profile，通过 CDP 加载解包 MV3 后断开安装调试会话。构建目录为 `apps/extension/.output/chrome-mv3`，来自本轮本地修改。

| 命令 | 结果 |
| --- | --- |
| `pnpm verify` | 通过；74 个扩展测试文件，476 passed / 1 skipped；Git hook 15 项；兼容包 Node 184 项及 Rust QA 通过；Lint、边界、类型、Demo/MV3 构建和产物审计通过 |
| `pnpm --dir apps/extension exec playwright test --reporter=list` | 106 passed / 3 skipped，6.0 分钟；跳过项依赖未提供的授权音乐夹具 |
| `pnpm --dir apps/extension run test:e2e:web` | 8 passed，20.4 秒；含预期故障注入日志 |
| `pnpm --dir apps/extension exec playwright test sharedWebDav.spec.ts settings.spec.ts fileManagerLocations.spec.ts passwordManagerApp.spec.ts password-manager-integration.spec.ts native-overlays.spec.ts --output=test-results/webdav-chrome --reporter=list` | 设置 `UNAS_E2E_BROWSER=chrome` 后 11 passed，43.3 秒 |
| `pnpm --dir apps/extension exec playwright test sharedWebDav.spec.ts --output=test-results/webdav-responsive --reporter=list` | 同一系统 Chrome 下 1 passed，7.8 秒；补齐设置及 Files 三种视口截图与设置操作按钮滚动可达断言 |
| `pnpm lint` / `pnpm typecheck:demo` | 最终 E2E 调整后均通过 |
| `node scripts/governance-docs-check.mjs` / `git diff --check` | 通过 |

首次 MV3 全量回归为 103 passed / 3 skipped / 3 failed，三个失败来自已移除表单的旧测试入口。更新主题断言和文件预览夹具，保留原有编辑、冲突、取消断言后，全量重跑通过。文件预览夹具只验证共享连接可用和密码库部分失败提示；完整自动建库由下述共享流程独立覆盖。

## 可复现证据与限制

- [共享 WebDAV 流程](../../../apps/extension/e2e/sharedWebDav.spec.ts)验证单份加密认证存储、Vault 自动创建、Files 复用、隐藏密码库目录、设置重开及跨页面移除后的失效。
- 系统 Chrome 测试使用合成 DAV 响应与权限授权替身，实际执行扩展消息路由、存储、加密和 IndexedDB；不能代表真实 NAS 或原生授权弹窗兼容性。
- 响应式产物位于 `apps/extension/test-results/webdav-responsive`，包含 `environment.json`、运行观察与 `shared-settings-*` / `shared-files-*` PNG；视口为 1440×900、1024×768、390×844，深色主题。截图是忽略的本地产物，干净检出可通过上述命令再生成。
- 已视觉检查设置的字段层级、窄屏换行和 Files 操作列；自动断言横向不溢出及操作可达。仍未完成所有主题/材料、实际 200% 缩放、触控和维护者人工确认，不宣称整个 UI 基线验收通过。
- 真实 NAS、原生授权/撤销、跨页在途请求及常用 Profile 继续由 [RISK-016](../../RISK_REGISTER.md#risk-016p1共享-webdav-传输的真实服务兼容性待验收) 跟踪。兼容包既有大文件静态审计提醒未因本轮关闭。
