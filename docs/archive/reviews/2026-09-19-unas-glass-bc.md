# uNAS Glass 工作包 B/C 验收记录

日期：2026-09-19。范围：Desktop、Dock、启动器与 `LocalDirectoryPane` 的展示层；不包含 UniPass 展示层适配或目标 Chrome Stable 人工验收。

## 已实现

- B：环境壁纸、Dock 与启动器改用共享导航/Overlay Glass；搜索框采用胶囊 Field，应用名可两行显示并通过 `title` 查看全名，空搜索有状态提示；窄屏 Dock 转为底部水平导航。
- C：文件管理器侧栏、工具栏、搜索/排序、操作、列表行、空态与状态区消费共享 Token；正文保持实色，空态移除额外 `backdrop-filter`；目录授权、写入确认、文件创建、删除与 ZIP 解压路径未改。

## 自动化与视觉证据

- `pnpm verify`：通过；治理、ESLint、边界/依赖检查、Vitest（27 files / 120 tests）、TypeScript、Vite/WXT 构建与包体检查均通过。
- `pnpm test:e2e`：通过；Playwright bundled Chromium，40/40、0 skipped、无报告错误；目录授权和写入确认测试覆盖真实 MV3 构建物。
- 人工查看本次 Playwright 报告中的真实扩展截图：1440×900 深色 Desktop、390×844 紧凑 Desktop、1440×900 浅色文件管理器。未见文本溢出、横向滚动、玻璃层盖住控件或列表内容透明化。

## 未覆盖

- 证据来自 Playwright bundled Chromium，不是已安装 Chrome Stable 或真实浏览器缩放/触控设备验收。
- 未完成 UniPass 的展示层 Token 适配；该工作保留给 UI-Glass-D。
