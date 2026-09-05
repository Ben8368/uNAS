# 窗口与任务状态回归验收

日期：2026-09-05。范围：Phase 1 mock Demo；未接入真实文件、下载或引擎。

## 原因与修复

- New Tab 原先读取本页 mock 任务，点击停止不会影响 Workspace。现在右侧显示 owner 发布的只读摘要，管理入口复用 Workspace；场景推进只在 owner 页面提供。
- 下载列表原先只轮询活动任务，旧历史快照继续覆盖取消或完成状态。现在成对刷新活动与历史列表，并订阅 mock 变更；请求代次避免旧响应覆盖新结果，卸载时移除订阅。
- 最小化原先卸载 App 子树并丢失草稿。现在隐藏保留实例，关闭才卸载；窗口容器统一处理焦点，Dock 活动标记排除最小化窗口。
- Web 冷启动逐帧复现窗口从 `(70,20)` 跳至 `(230,100)`，并先显示空内容。窗口原先以固定 viewport 计算首帧、在普通 effect 中修正；现在在 layout effect 中测量，懒加载时显示同色加载表面。
- Vite 开发环境的 React StrictMode 重复 effect 曾导致首个 Workspace 误报 owner 冲突。现在先跳过同步清理的申请，再获取锁；真正同时存在的页面仍互斥。

## 环境与客观验证

- Windows `win32 10.0.26200 x64`；Playwright Chromium `151.0.7922.34`，headless。
- 扩展加载 `apps/extension/.output/chrome-mv3`；Web 测试启动独立 Vite 开发服务器，默认 `127.0.0.1:15173`，可用 `UNAS_WEB_TEST_PORT` 调整端口。
- `pnpm verify`：通过，84 项单测、类型检查、Vite/WXT 构建、文档治理、源码边界、依赖与包体检查。
- `pnpm --dir apps/extension run test:e2e:web`：2/2 通过。冷加载首帧采样位置均为 `(230,100)`，尺寸均为 `960×640`，没有空白内容帧；覆盖加载态、StrictMode 所有权、草稿保留、窗口与启动器焦点。
- `pnpm --dir apps/extension run test:e2e`：最终全量 18/18 通过，耗时 42.0 秒。覆盖原有布局/扩展流程，以及新增的跨标签摘要、取消/完成同步、Workspace 复用和窗口草稿/焦点回归。新增测试初次运行的侧栏定位与完成态文案断言错误已修正，未改变产品逻辑以迁就测试。

## 本地证据

下列运行产物位于被 Git 忽略的 `test-results`，重新运行对应测试可生成：

- `apps/extension/test-results/web-e2e/windows-cold-App-launch-pa-f51f3-an-explicit-loading-surface/launch-frames.json`：逐帧位置、尺寸、内容是否为空及浏览器版本。
- 同目录 `web-app-open.png`：已检查打开后的内容表面与布局。
- `apps/extension/test-results/extension-e2e/review-regressions-New-Tab-7ff88-refreshes-the-download-list/newtab-owner-summary.png`：已检查完成、取消状态及 Workspace 管理入口；同目录 attachments 保存环境和运行观察。

## 验收边界

截图检查与逐帧 DOM 采样覆盖本轮具体缺陷，不代表稳定版 Chrome 真机、全部缩放比例、辅助技术、主观流畅度或性能 Gate 通过。继续由 RISK-001、RISK-002 跟踪；未新增依赖、权限、上传或真实能力。
