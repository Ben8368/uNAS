# 文件预览与目录安全修复验证记录

日期：2026-10-03。源码基线：`dfb92cb` 加本轮文件预览与目录安全修复。

## 修复与回归范围

| 原问题 | 修复 | 回归证据 |
| --- | --- | --- |
| 已存在文件名被 trim 后删除错误文件 | 枚举名称保留原值；新建名称单独归一；拒绝控制字符和路径分隔符 | `fileWorkspace.test.ts` 与本地 OPFS E2E 同时创建 ` report.txt ` / `report.txt`，只删除前者；单测覆盖长名称 |
| 未闭合 Markdown 标记导致重复扫描 | 单调推进的分隔符扫描；256 Ki 字符、1,024 块、8,192 节点预算；超限按完整纯文本显示 | `MarkdownSafeView.test.tsx` 检查 40,000 个未闭合括号的搜索次数、原始 HTML/危险链接和预算降级；E2E 显示完整 2 MiB 文本 |
| 返回本地文件位置重置有效授权与子目录 | 同一有效授权恢复保留目录路由、FileRef 和用户开启的写入模式 | 单测恢复快照；E2E 在子目录切换位置后读取、导出原 FileRef |
| 关闭/替换预览静默丢失编辑内容 | 未保存修改确认、App 关闭守卫和按需 beforeunload；保存中阻止离开与重复提交；成功更新原文基线，失败保留草稿 | E2E 取消关闭/替换/断开/App 关闭，保存等待与冲突，检查 beforeunload 注册及撤销 |
| WebDAV 图片无 MIME 时误用文本预算 | 先限量读取 16 字节签名；图片最多 8 MiB、其他最多 2 MiB；共享读取器校验完整长度并清理 lease | `previewRead.test.ts` 覆盖无 MIME 图片、伪 MIME、超限、取消及短流；E2E 验证 3 MiB PNG 和超限文本 |

为收敛职责，从 `fileWorkspace.ts` 提取授权存储和 FileRef 读取模块；保留原 IndexedDB schema/store/key，公开 contract 未变。未新增依赖、扩展权限、上传能力或远程代码。

## 执行环境与命令

- macOS：`darwin 25.6.0 arm64`。
- 浏览器：Playwright `1.62.1` bundled Chromium `151.0.7922.34`，headless，sRGB；命令行加载 `apps/extension/.output/chrome-mv3` 解包 MV3。
- 本地目录测试用独立 Profile 中生成的 OPFS 夹具替代系统选择器；WebDAV 测试在真实 adapter/共享传输接口下拦截 HTTPS fetch，生成 Range/ETag/PUT 响应。没有访问真实 NAS，没有上传用户文件。

| 命令（项目根目录执行） | 结果 |
| --- | --- |
| `pnpm --dir apps/extension exec vitest run src/api/real/fileWorkspace.test.ts src/apps/file-manager/MarkdownSafeView.test.tsx src/apps/file-manager/previewRead.test.ts src/windowCloseGuards.test.ts src/api/real/davFiles.test.ts` | 5 个文件，26 passed |
| `pnpm verify` | 文档、lint、边界、依赖、typecheck、单测、Demo/WXT 构建和包检查全部通过；64 个文件，390 passed / 1 skipped |
| `pnpm --dir apps/extension exec playwright test filePreviewSafety.spec.ts fileWorkspaceDirectory.spec.ts fileManagerLocations.spec.ts localMediaPlayback.spec.ts` | 8 passed；新增安全用例没有未预期远程请求或页面错误 |
| `pnpm --dir apps/extension exec playwright test layout.spec.ts launchLifecycle.spec.ts inlineWorkspace.spec.ts --output=test-results/window-close-regression` | 23 passed；共享窗口布局、任务关闭守卫、跨页面所有权/文件变更及参数匹配到的 Bilibili 布局回归 |
| `node scripts/governance-docs-check.mjs`、`git diff --check` | 通过 |

`pnpm verify` 的回环 HTTP 合成服务与 Chromium 启动需要脱离受限沙箱运行。扩展总包体 1,202,235 字节、初始静态资源 248,041 字节；这些是本轮构建结果，不是性能结论。

## 截图与证据边界

- 新增可复现入口：[filePreviewSafety.spec.ts](../../../apps/extension/e2e/filePreviewSafety.spec.ts)。
- 本轮截图已查看：1440×900、1024×768、390×844；预览操作可见、无横向溢出。PNG 是浏览器生成的 1×1 像素图片并填充至 3 MiB，用于签名、预算和真实解码回归；不用于评价照片显示质量。
- 本机截图及环境记录：`apps/extension/test-results/extension-e2e/filePreviewSafety-WebDAV-p-f6650-arge-Markdown-as-plain-text/preview-{1440,1024,390}.png` 与 `environment.json`。目录被 Git 忽略，后续测试可能重写；可用上述命令重建。
- beforeunload 自动测试验证监听器与取消事件；没有宣称覆盖浏览器强制退出、崩溃或所有系统关闭行为。[MDN beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event) 与 [Chrome File System Access 指南](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) 于 2026-10-03 核对；使用现有原生 API，未安装外部 skill 或修改依赖版本。
- 目标系统 Chrome Stable 常用 Profile、真实目录权限手势、真实 NAS、主观视觉验收和缓存压力证据仍按 [RISK-012 / RISK-016 / RISK-017](../../RISK_REGISTER.md) 跟进；本轮不升级格式、浏览器或阶段 Gate。
