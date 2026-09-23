# uNAS 品牌与模块解耦验收记录

日期：2026-09-22。范围：GitHub CI Browser regression 根因、密码管家/广告拦截模块边界、uNAS 品牌文案、密码浮窗视觉冻结和管理页入口。

## CI 根因

2026-09-23 复核远端原始日志后更正：GitHub Actions [CI #48](https://github.com/Ben8368/uNAS/actions/runs/35729855959) 的 Browser regression 并非在 Chromium 启动阶段失败，而是 appTheme.spec.ts 的侧栏 SVG 宽度断言仍期望 22px，实际为 17.5938px，导致 7 failed、57 passed、3 skipped。[更早的失败](https://github.com/Ben8368/uNAS/actions/runs/35712685512) 同样由该断言触发。提交 faab2ef 已把断言对齐为约 17.6px；其后的 [CI](https://github.com/Ben8368/uNAS/actions/runs/35736032270) 和 [最新基线 CI](https://github.com/Ben8368/uNAS/actions/runs/35747274969) 的治理、验证及浏览器回归均通过。

原记录还包含本地移除 system.display 后 extension.spec.ts 可启动的观察；它不能作为上述远端 CI 的根因证据。该非核心权限仍保持移除，systemMetrics.readDisplays() 继续 feature-detect，包体审计区分允许登记与当前 required。

## 浮窗视觉基准

自动化条件：Windows 10 x64，Playwright bundled Chromium 151.0.7922.34，headless，sRGB，视口 1440×900，缩放 100%，单 worker、无重试；扩展从 `apps/extension/.output/chrome-mv3` 解包加载。该证据不等同于系统 Chrome Stable 或真实工具栏手势认证。

- 重构前基准截图（既有浮窗）：`apps/extension/test-results/icon-theme/unipass-integration-the-mi-76ec6-and-dies-with-an-HTTPS-page/`
- 重构后截图：`apps/extension/test-results/extension-e2e/unipass-integration-the-mi-76ec6-and-dies-with-an-HTTPS-page/`
- 覆盖 `unipass-original-overlay.png`、`unipass-alternate-theme.png`、`unipass-reduced-effects.png`、`unipass-apps-overlay.png`；打开、关闭、外部点击、Escape、填充和页面销毁由 `e2e/unipass-integration.spec.ts` 覆盖。

对比结论：截图差异仅为有意的用户可见品牌文字（`UniPass` → `uNAS`/密码管家）；布局、尺寸、主题材质、控件间距、动画状态、Shadow DOM 边界和交互断言未改。真实 Chrome 工具栏手势、200% 缩放和人工视觉对照仍由 RISK-014 保留。

## 回归命令

```text
node scripts/governance-docs-check.mjs
pnpm verify
pnpm test:e2e
```

最终结果：治理检查通过；`pnpm verify` 通过（42 个 Vitest 文件、230 个测试，1 skipped，类型检查、Vite/WXT、包体审计通过）；MV3 E2E 65 passed、3 skipped；新增密码管家桌面入口管理页测试通过。
