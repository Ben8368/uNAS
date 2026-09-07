# Chrome 扩展 AI 开发指南同步

> 研究日期：2026-09-07。本文记录外部资料核对，不是 uNAS 能力或阶段状态表。

维护者补充私用背景后，采用策略以 [ADR 0008](../ADR/0008-private-preview-modern-chrome.md) 为准；本文保留外部事实与差异，迁移顺序只在开发蓝图 FE-09 至 FE-12 维护。

## 来源与版本

- [Chrome 官方入口](https://developer.chrome.com/docs/extensions/ai/build-with-ai?hl=en#modern_web_guidance)：本轮页面显示最后更新 2026-05-19，推荐 `chrome-extensions` 和 `modern-web-guidance` 两个 skill，以及 Chrome DevTools MCP。
- [Chrome `storage` API](https://developer.chrome.com/docs/extensions/reference/api/storage)：2026-09-07 核对。该 API 要求声明 `storage` 权限，`storage.local` 可供全部扩展上下文异步访问；官方明确不建议以 Web Storage 保存扩展数据，因为 Service Worker 不可用且清理浏览数据会丢失。Link App 因此使用 `browser.storage.local`，Vite standalone mock 才回退 `localStorage`。
- 本轮 npm registry 的 `modern-web-guidance` latest 为 `0.0.185`；包内扩展 skill 标记 `2026_08_06-8570fe7c`。这是检索时快照，不是 Chrome 发布版本，也不是新增 API 的发布日期。
- [发布仓库](https://github.com/GoogleChrome/modern-web-guidance)、[源仓库](https://github.com/GoogleChrome/modern-web-guidance-src)；包自述仍是 preview。核对内容来自该版本 tarball 的 `skills/chrome-extensions` 与 `skills/modern-web-guidance/guides`，未执行 CLI、安装 skill 或更改项目依赖。

## 与项目相关的发现

| 官方指南内容 | uNAS 的价值判断 | 采用边界 |
| --- | --- | --- |
| 按任务加载 MV3、权限、消息、存储、CSP 和发布参考 | 减少过时 API 和错误示例进入实现 | 作为检索入口；API reference 和目标环境实测优先，不自动覆盖仓库规则 |
| [Chrome 148 原生 `browser.*` 命名空间](https://developer.chrome.com/docs/extensions/develop/concepts/browser-namespace?hl=en)，`chrome.*` 继续保留 | 原生 adapter 迁移目标 | 按 FE-09/10 核对 WXT 产物后移除冗余兼容代码。指南另列 DevTools 扩展的命名空间自 Chrome 152 可用，不能类推所有消息行为 |
| 官方消息文档新增 Chrome 148 监听器 Promise 响应、Chrome 146 错误传播说明，均标注渐进推出及 DevTools 扩展例外 | 异步请求优先迁移目标，影响响应和失败语义 | 按 FE-10 验证灰度、多监听器与显式错误协议；缺失能力不默认以永久双路径解决 |
| DevTools MCP 增加扩展安装、重载、操作触发和运行面检查 | 优先接入以补充现有 Playwright，辅助 New Tab、工具栏和 Service Worker 问题定位 | 见 FE-12；不代替稳定版人工证据，生命周期验收须另做无调试器对照 |
| 原生 Dialog/Popover、CSS Anchor Positioning、container queries | 同页 App 的浮层、焦点与响应式迁移目标 | 见 FE-11；替换等价旧实现，不把应用内右侧抽屉改成 Chrome Side Panel |
| `scheduler.yield()`、优先级调度、长任务与 INP 诊断 | 改善桌面交互被 UI 更新阻塞的问题，便于定位而不是凭感觉优化 | UI 分片不能替代 Dedicated Worker；有 feature detection、取消和回退，并保留前后测量 |
| `CHROMEWEBSTORE.md` 跟踪用途、每项权限理由、隐私和发布资料 | 避免权限实现与披露脱节 | 未来 Store Gate 再创建，不为本轮研究提前开启上架或复制产品/安全事实源 |
| LanguageModel、Summarizer、Translator、LanguageDetector 指南 | 未来本地摘要/翻译可研究，包含可用性、模型下载与失败回退 | 只是观察项，不纳入 SP-01 或 V1；模型下载是联网行为，不等于上传用户内容，也不能宣称首次使用完全离线 |
| Side Panel、userScripts、tab context menu 等扩展 API | 当前 New Tab 本地文件工作区无直接需求 | 不新增权限、脚本执行或运行面；有真实需求后另走 Product/ADR/Gate |

上述是本轮看到的指南覆盖面，包含已有最佳实践，不是“全部 API 刚发布”的列表；未穷举 Chrome 发布日志。

命名空间迁移指南警告：提高 `minimum_chrome_version` 会使更旧浏览器用户收不到后续扩展更新。该事实保留用于对外开放评审，不再作为私有预览的迁移阻碍；版本策略见 ADR 0008，环境证据由 RISK-001 跟踪。指南建议的分析遥测仍不适用于 uNAS 的默认无遥测边界。

## 不能照搬的示例

1. 包内 `service-worker.md` 称打开 Port 即可保活；[官方生命周期文档](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle?hl=en)明确 Chrome 114 起仅打开 Port 不重置计时器。不要通过心跳、无意义存储写入或 offscreen 维持常驻；保留 Workspace/Worker 架构。
2. 包内 `message-passing.md` 将监听器返回 Promise 标为 Chrome 99+，与本轮读取的[官方消息文档](https://developer.chrome.com/docs/extensions/develop/concepts/messaging?hl=en)所述 Chrome 148 渐进推出不一致；Chrome 146 的错误传播也有灰度与 DevTools 扩展例外。发送端 Promise 与接收端监听器 Promise 是不同能力，不能混用版本结论。多监听器中不处理消息的 `async` 函数也可能以空响应抢答，需验证路由与错误协议。
3. 包内“读 `tab.url` 一定要 `tabs`”及侧栏示例中的宽 host permissions 不能作为增权依据；应核对 [Tabs 权限说明](https://developer.chrome.com/docs/extensions/reference/api/tabs?hl=en)，区分 `tabs`、匹配 host permission 和有效 `activeTab` 授权。普通 HTTPS 跳转不因此增加权限。
4. sandbox/blob/srcdoc 示例不是绕过 CSP 或执行远程/用户代码的许可。uNAS 的 System/Tool App 随包分发、Link App 只做 HTTPS 跳转，仍以 [SECURITY](../../SECURITY.md) 为准。

## 工具接入前提

- 官方安装入口是 `npx modern-web-guidance@latest install --choose`，两项 skill 由同一官方包提供；不要安装 npm 上同名的 `chrome-extensions` 包。本轮仅记录命令，没有执行安装。
- CLI 支持自动更新；包 README 披露默认匿名遥测包含安装计数、guide ID 和智能体生成的搜索词，关闭开关为 `DISABLE_TELEMETRY=1`。实际接入前需审查版本、来源、更新行为和数据流，不向检索发送私有代码、文件名或用户内容。
- [DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) 的扩展工具需启用 `--categoryExtensions`（或对应版本的 `--category-extensions`）。页面推荐的 `--autoConnect` 会连接已有 Chrome profile，不默认采用；优先隔离测试 profile，经用户同意后才改变调试设置或连接日常 profile。
- 工具配置、自动更新或外传诊断数据不在本轮授权范围；需要时按现有供应链、安全及 ADR 规则评审，核对工具自身遥测配置。不得用官方推荐代替同意。

## 文档落点

- AI 检索与外部指导优先级：[AI_RULES](../AI_RULES.md)。
- 组件采用原则：[FRONTEND_GUIDE](../FRONTEND_GUIDE.md)；验收证据：[QUALITY](../QUALITY.md)。
- 具体工作与探针：[DEVELOPMENT_BLUEPRINT](../DEVELOPMENT_BLUEPRINT.md)；壳层/组件迁移前移及阶段 Gate 见 [ROADMAP](../ROADMAP.md)。
- 浏览器、生命周期与商店不确定性沿用 [RISK_REGISTER](../RISK_REGISTER.md) 的 RISK-001、003、008，不为未采用工具新建实现技术债。
