# 密码管家与 WebDAV 审查记录

日期：2026-09-23。范围：图标、Legacy 撤除准备、共享 WebDAV 传输与密码库后端声明。

## 审查结论

- P1：Legacy 的应用级解耦尚未完成。service-worker 静态安装旧来源及登录/Jupiter 生命周期；page-overlay、credential-access 和 user-scope-guard 仍直接访问旧 API。原有空 registry 测试只覆盖 Vault 服务，不证明整包能删除 Legacy。具体偿还与撤除验收唯一登记在 [TD-003](../../TECH_DEBT.md#td-003legacy-密码能力尚未完成应用级解耦)。
- GitHub/Cloudflare 只有 VaultBackendType 占位，本轮移除；旧存储中未知 provider 仍被过滤但不删除，不影响广告 GitHub 规则源。
- WebDAV 网络传输从 Vault 下沉至 runtime/webdav；地址校验下沉至 shared。Vault 保持远端目录、加密对象、ETag 和冲突语义，其他 App 尚未接入。稳定边界见 [ADR 0014](../../ADR/0014-shared-webdav-transport.md)。
- 密码图标使用与其他原创 SVG 相同的 64×64、60×60 圆角底板和 2.6 白色线条，背景为青蓝色；已加入资产生成脚本和 SHA-256 清单。

## 可复现验证

- 命令：node scripts/governance-docs-check.mjs；结果：通过。
- 命令：pnpm verify；结果：46 个测试文件通过，261 项测试通过、1 项跳过；ESLint、源码边界、依赖清单、TypeScript、Vite/WXT 构建与包体检查通过。
- 命令：pnpm --dir apps/extension exec playwright test passwordManagerApp.spec.ts unipass-integration.spec.ts overlay-icon.spec.ts；结果：4 项通过。覆盖 Desktop 图标解码/入口、WebDAV 管理空态、manage.html 兼容页、HTTPS 浮窗打开/填充/关闭/页面销毁和浮窗图标资源。
- 环境：Windows 10.0.26200 x64；Playwright bundled Chromium 151.0.7922.34，headless、sRGB、1440×900、隔离 Profile；不是系统 Chrome 人工验收。
- 生成截图和环境记录保存在被忽略的 apps/extension/test-results/extension-e2e 与 apps/extension/playwright-report。已查看 Desktop 实际截图，确认图标加载与同组尺寸/线条一致；主观偏好仍由维护者确认。
- 共享传输测试覆盖 endpoint/path 边界、请求/响应字节预算、取消、超时、401、错误信息脱敏和资源清理；Vault adapter 测试覆盖 If-None-Match/If-Match、ETag 缺失及 409/412，不自动重试写入。

## 提交前 CI 复核

- 远端历史失败及更正证据见 [2026-09-22 审查记录](2026-09-22-unas-brand-module-rework.md#ci-根因)；失败断言的修复已在 faab2ef，无需再次修改 workflow 或放宽测试。
- 当前完整 MV3 回归：pnpm --dir apps/extension exec playwright test，67 passed、3 skipped；跳过项缺少授权音乐夹具。
- 当前完整 Web 回归：pnpm --dir apps/extension run test:e2e:web，8 passed。

## 未运行

没有用户授权的真实 WebDAV 服务材料，未进行真实 NAS、多设备冲突/断网恢复与生产数据试验；沿用 [RISK-016](../../RISK_REGISTER.md#risk-016p1共享-webdav-传输的真实服务兼容性待验收)。目标 Chrome 工具栏真实手势、触控和 200% 浏览器缩放未运行，视觉缺口沿用 RISK-012。未撤除 Legacy；公开发布未执行。
