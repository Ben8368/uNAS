# 2026-09-04 Demo review 修复与验收

## 范围与方法

基于 `afaf08b` 的代码 review 和用户提供的 review，修复既有 Demo 的隔离、确定性、交互与生命周期问题；由三个子代理并行修改，主代理做文件归属协调、交叉审查、集成、构建和截图检查。不提交、不推送、不发布。

这轮不接入真实文件、引擎、Native Helper、账号或网络下载，不更改 Roadmap Gate 的批准状态。当前阶段唯一事实源仍为 [CONTEXT.md](../../../CONTEXT.md)。

## 对原 review 的核实

原 review 的主要代码定位与 Windows 验证失败属实。严重度需结合实际执行环境：path grant 的桌面调用依赖外部注入 bridge，仓库没有证明实际注入；文件选择读到了名称/大小，没有证据表明读取内容或上传网络。导航竞态与批量部分提交是异步契约缺陷，当前立即返回的 mock 不必然复现真实网络时序。

原 Demo 已有部分 DEMO DATA 提示，但覆盖不足，不能据此断言完全没有 mock 标识。`pnpm verify` 失败会返回非零，不会自动形成 CI 成功；分别执行构建不能写成标准命令通过。素材公开分发、G1 与引擎探针的阻断范围按风险台账分别判断，不能统一升级为所有 Gate 的阻断。

## 修复对照

| 问题 | 实现与回归边界 |
| --- | --- |
| Windows 验证入口失败 | 根脚本调用 workspace scripts；不再拼接 Unix `.bin` 路径。失败保留非零退出码 |
| Demo 绕过 adapter | 文件授权通过同一 API；去掉 real 导出、浏览器 bridge 与桌面关机路径；静态和构建检查阻止回归 |
| 真实文件 metadata 与假下载 | 只接受固定 fixture ID，运行时拒绝 File/额外字段；按钮查看模拟结果；URL 接口明确拒绝假下载 |
| 不确定 scenario | 固定 ID/时间、可重置可推进的 11 场景；完整 snapshot 重放测试；没有真实媒体产物 |
| 取消状态不一致 | 下载任务和 Job 共用 ID/终态；取消不改写已完成任务；两处视图共享事实 |
| PSD 轮询生命周期 | AbortSignal、单请求和整体期限、卸载停止观察；取消操作查询终态；关闭窗口不冒充任务已取消 |
| 导航竞态 | 请求所有权覆盖导航、初始化、刷新、回收站切换及卸载；旧响应不能提交 |
| 部分成功 | 有界并发、逐项成功/失败、保留失败项供重试，刷新失败不抹掉操作结果 |
| 路径与回收站 | 固定完整路径、完整子树删除与恢复、名称冲突、部分失败、资产投影同步 |
| Workspace 缺少实现 | 版本化消息/来源白名单、查找打开复用、Web Locks owner、冲突只读、跨标签摘要；刷新重新开始 fixture，不宣称恢复执行 |
| 桌面产品遗留 | BrowserApp 改为 HTTPS Link 管理；补 Image/PDF/Archive/Task Center 的统一模拟流程，Cookie 能力禁用且 API 拒绝 |
| 状态文档冲突 | SECURITY/README 引用 Context；checker 检测当前阶段声明冲突 |
| 素材与包体 | 移除来源未知 PNG/WebP；原创 SVG/CSS 有生成器/哈希/预算；依赖版本和许可证文件可追溯，公开分发仍待决定 |
| 布局、辅助功能、样式债 | 窗口越界恢复、Regular 单主窗口、Compact 滚动、键盘启动/切换、启动器焦点/Escape/inert、主题与降级设置；拆分旧大样式文件 |

交叉审查额外修复：过期 tab 缓存可能覆盖用户网页；多 Workspace 不能猜 owner；scene 重置先卸载旧窗口，避免确定性 ID 复用后旧轮询观察新任务。

## 可重复命令

```text
pnpm verify
pnpm test:e2e
node scripts/governance-docs-check.mjs
node scripts/dependency-inventory.mjs --check
git diff --check
```

## 最终验证结果

2026-09-04，Windows `win32 10.0.26200 x64`；Playwright 自带 Chromium `151.0.7922.34`，独立临时 profile，headless 加载本地 MV3 扩展。构建文件、环境和截图 SHA-256 见 [证据清单](2026-09-04-demo-evidence.json)。

| 命令 | 结果 |
| --- | --- |
| `pnpm verify` | 退出码 0；治理、源码边界、依赖清单、13 文件 / 81 单测、TypeScript、Vite、WXT、包体检查全部通过 |
| `pnpm test:e2e` | 退出码 0；重新构建后 22 项通过，42.3 秒；不重试掩盖失败 |
| `node scripts/governance-docs-check.mjs` | 通过 |
| `node scripts/dependency-inventory.mjs --check` | 通过，20 个依赖清单记录一致 |
| `git diff --check` | 通过，无空白错误；所有改动文本使用 UTF-8 / LF |

扩展总量 **431,268 B**，New Tab 初始静态 JS **213,069 B**，public 素材 **3,934 B**。相对初始约 18.94 MB 的包体下降主要来自移除旧位图、使用原创 SVG/CSS；这不是运行性能基准。Manifest 未声明 permissions、host permissions、content scripts 或 web-accessible resources，未放宽默认 CSP；构建扫描未见 WASM/桌面 bridge。

E2E 覆盖真正的 `chrome://newtab/` 替换、Workspace 打开/复用/冲突只读、无效消息拒绝、关闭后的中断摘要/所有权释放、刷新重置、Link 创建/编辑/删除持久化、拒绝非 HTTPS、固定文件导入/回收站恢复/无下载、部分成功、取消视图一致及 Image/PDF/Archive 模拟状态推进。测试中的网络观察未记录 HTTP(S) 请求或页面异常；没有把 Link 配置测试写成实际网站可用性验证。

### 截图与键盘检查

主代理检查了 13 张截图：Image 的 Wide 1440×900、Regular 1024×768、Compact 390×844、浅色、减少动画、高对比度、720×450 缩放布局模拟，以及 PSD/下载器/文件管理器各两档布局。主窗口边界断言通过，示例按钮可通过键盘 Enter 操作；Compact 的主流程与场景控制完整可见，较矮视口通过内部滚动访问后续内容。检查后修复横幅遮挡侧栏、Compact 控件截断、下载登录态标签挤压和“产出”误导文案。

这是本轮截图与局部键盘核查，不是屏幕阅读器、所有 App 状态、真实浏览器缩放或主观审美验收。截图与 HTML 报告位于 `apps/extension/test-results/extension-e2e/` 和 `apps/extension/playwright-report/`，由下一次运行更新；截图路径与哈希保存在证据清单。

## 🚦 Audit Report

- **总体评价：🟡 可通行。** 本轮已确认的 Demo 代码和 Windows 验证阻断已修复，自动化回归通过；不宣称 G1 批准。
- **🔴 本轮代码阻断：** 未发现剩余项。
- **🟡 跟进：** RISK-001/002 的 G1 基线和体验证据、RISK-003 的完整生命周期探针、RISK-009 的公开分发许可仍开放，具体范围如下。
- **验证：** 上表列出已执行命令；未执行项不计为通过。

## 仍需独立证据或决策

- 维护者确认最低 Chrome 版本策略、参考 OS/视口和主观视觉方向（RISK-001/002）；本轮自动化环境只是实测记录。
- 用户安装的 Chrome 稳定版人工走查、真实 200% 浏览器缩放、屏幕阅读器/触控目标、低端设备流畅性；视口和媒体偏好模拟不代替这些检查。
- Service Worker 强制终止/更新、崩溃恢复与真实文件/引擎/资源清理仍属于相应探针；Demo 刷新明确丢弃内存执行状态。
- 仓库许可证及公开再分发批准由维护者决定（RISK-009）。原资产来源未知的问题通过不再打包解决，没有虚构旧素材授权。
