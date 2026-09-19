# 2026-09-20 TD-002 主题技术债迁移

## 范围与依据

依据 Design System UI v1.3 的 UI-01/02/05/06、Blueprint UI-Glass-D 和 TD-002。本轮仅改展示样式与对应验收用例，保留前轮 Vault 修复，不改变认证、凭据、网络、权限或任务实现。

- `accessibility.css` 删除全局 light-theme 救场覆盖；共享可访问性和视口规则仍保留。
- Settings 样式从 `globals.css` 移至 `settings.css`；App 私有 `--mt-*` 主题定义全部移除，别名仅由 `window-theme.css` 定义（桌面壁纸变量不属于主题别名）。
- 下载器、日志、PSD、Transcode 的文字/表面/边框/状态消费共享 Token，避免深色硬编码导致浅色不可读。PSD/Transcode 当前未注册，仅做源码迁移，未宣称端到端验收。
- UniPass 在 closed Shadow DOM 中加载共享窗口 Token 与 `unas-theme.css` 映射；保留薄荷绿强调、原有布局和填充逻辑，移除旧 CSS 中已被映射的重复 Token。原生主题切换与页面取色逻辑不变。
- 新增 `themeOwnership.test.ts` 防止主题定义重新分叉，`appTheme.spec.ts` 覆盖下载器/设置/日志/文件管理器的深浅主题、可见控件焦点、720px 高对比与减少透明度场景；浮层 E2E 增加切换主题和减少动态/高对比截图。

前轮业务修复与证据见 [Vault 同步补充审查](2026-09-20-vault-sync-review.md)。

## 验证边界

- 系统 Chrome 定向命令：`$env:UNAS_E2E_BROWSER='chrome'` 后运行 `pnpm --dir apps/extension exec playwright test e2e/appTheme.spec.ts e2e/unipass-integration.spec.ts --output=test-results/td002-chrome --reporter=list`。
- Chrome 可执行文件版本 153.0.8010.37；5 项均在 fixture 等待 Service Worker 的 10 秒超时处失败，未进入 UI 断言；未诊断为产品主题问题，也不记为目标 Chrome 通过。未修改用户浏览器配置或权限。
- 已查看 bundled Chromium 下载器/日志浅色与 UniPass 浮层截图；截图不等于工具栏真实点击、200% 缩放或触控证据。
- TD-002 保留待人工验收；RISK-012、RISK-014 保持开放，不以自动化结果关闭发布或主观 Gate。

## 已完成的客观验证

- `pnpm verify`：32 个测试文件、153 个测试通过；治理、ESLint、边界、依赖、类型、Web/MV3 构建与包体检查通过。
- `pnpm test:e2e` 最终全量：46/46 通过，0 skipped（1.8 分钟）；bundled Chromium 151.0.7922.34，Windows win32 10.0.26200 x64。
- 初轮新增主题测试因选择未打开对话框内的隐藏按钮导致焦点断言失败；限定可见控件后，四个 App 的主题定向测试 4/4 通过。
- 最终 MV3 包体 946,391 B，初始静态 JS 261,012 B；浮层共享 CSS 只随用户触发脚本加载。
- `page-overlay.js` SHA-256：`fbcf0c1c127847addb54b6f5a7d8efa66d3c4cb326c7f74e79946616680921ae`。
- 已查看下载器/日志/文件管理器浅色截图及 UniPass 切换后的深色截图。截图产物位于被忽略的 `apps/extension/test-results/extension-e2e/`，由 E2E 命令重建。
- 收尾文档检查：`node scripts/governance-docs-check.mjs`、`git diff --check` 通过；Design System 人工篇幅预算低于 140 行 / 7,000 字符，未调整预算。
