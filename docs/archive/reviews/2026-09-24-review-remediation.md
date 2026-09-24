# 2026-09-24 Review 修复与技术债自动验收

## 范围与边界

- 基于 main 的 bad11e8；只修复下载异常状态、边缘热区和分辨率计算，并补 TD-002/TD-003 自动证据。未提交、推送或发布，未改产品权限、真实用户 Profile、凭据或 Legacy 存量数据。
- 未追踪下载投影为 external（由 Chrome 管理、状态未知），不计入下载中、不显示伪进度，可移除本地记录且不依赖故障存储；不取消实际下载。警告不再遮住后续操作错误。真实任务轮询使用稳定 ID 集合，排除未追踪和终态，避免自身更新触发连续轮询。
- 顶/底热区层级低于 App：覆盖部分由窗口接收输入；露出部分仍可用，右侧状态抽屉仍在窗口上层。
- Windows 使用正的 DPR / browserZoom 恢复显示缩放，覆盖 DPR≤1；合成测试同时检查 Screen fallback 与 display API，zoom 为 0.5/0.8/1/2，不声明多显示器物理分辨率真机验收。

## 环境与可复现入口

- Windows win32 10.0.26200 x64；系统 Chrome 153.0.8010.53；Playwright 1.62.1、WXT 0.21.4、Node 24.13.0、pnpm 11.25.0；扩展 manifest 0.4.0。浏览器实际环境由每个 fixture 的 environment.json 留存。
- [Chrome 启动辅助](../../../apps/extension/e2e/browserLaunch.ts) 使用 Playwright 临时 Profile/测试专用 Profile，移除默认 --disable-extensions，通过 browser-level CDP Extensions.loadUnpacked 加载本地包，随后 detach；不导航预热 New Tab，不连接用户浏览器，不开远程调试 TCP 端口。
- 官方 API 核对日期 2026-09-24；参考 Chrome DevTools Protocol Extensions.loadUnpacked（`https://chromedevtools.github.io/devtools-protocol/tot/Extensions/#method-loadUnpacked`）与 Chromium 的 Chrome 137 branded builds 移除 --load-extension 公告（`https://groups.google.com/a/chromium.org/g/chromium-extensions/c/1-g8EFx2BBY/m/S0ET5wPjCAAJ`）；只采用测试用本地解包加载，不引入安装器、遥测或用户配置变更。
- 首次诊断：page-level CDP 返回 Method not available；browser-level 可返回 ID，但保留 --disable-extensions 时无 Worker；移除该默认参数后真实 UI 与 Worker 均可加载。不是通过放宽等待时间或跳过断言解决。
- Chrome 命令：PowerShell 设置 $env:UNAS_E2E_BROWSER='chrome' 后运行 pnpm --dir apps/extension exec playwright test --output=test-results/chrome-full-review --reporter=list，结束后 Remove-Item Env:UNAS_E2E_BROWSER。
- [下载回归](../../../apps/extension/e2e/downloadTracking.spec.ts)、[窗口回归](../../../apps/extension/e2e/review-regressions.spec.ts)、[实际缩放回归](../../../apps/extension/e2e/browserZoom.spec.ts) 可单独传入 Playwright；下载故障使用合成消息，不访问真实下载或凭据。

## TD-002 可替代人工的证据

| 检查 | 自动化范围 | 不替代的部分 |
| --- | --- | --- |
| 主题归属 | themeOwnership 单测、8 个 App 的共享 Token/控件/三种视口 | 存量未注册 PSD/Transcode 的交互 |
| 主题与材料 | 固定深色桌面；密码浮窗切换浅/深；高对比、减少透明度/动态 | 主观层级、透明材质实际对比度与触控体验 |
| 200% | tabs.setZoom 设置真实 2 倍缩放，核对 getZoom/innerWidth、窗口边界、键盘打开表单、提交按钮滚动可达和命中 | 维护者常用 Profile/设备手势；非视口模拟，也非所有 App 完整缩放验收 |
| 生命周期 | Chrome 隔离 Profile 重启、解包更新、合成 HTTPS 浮窗填充/关闭/销毁 | 工具栏 action 真实手势、无调试器自然休眠/唤醒 |

已查看系统 Chrome 的下载异常态、200% 表单及滚动至提交按钮、密码浮窗截图；修正进度列“状态未知”折行为“未知”，行内阶段保留完整说明。截图位于忽略目录 apps/extension/test-results/，由上述测试重建，不作为 Git 链接或人工验收通过声明。

## TD-003 可重复盘点

- 运行 node scripts/legacy-retirement-audit.mjs；[脚本](../../../scripts/legacy-retirement-audit.mjs) 只读源码与本地构建包，无网络请求、不读用户存储或凭据、不执行 Legacy。
- TypeScript AST 盘点发现 13 条到旧 API/core/source/catalog/login/Jupiter 的直接导入；service-worker 可达六个目标，credential-access/page-overlay/user-scope-guard 仍可达 API/core。
- Popup 不直接 import API 不代表解耦：另记录 20 处旧消息/legacy-unipass 标识，包含 session、登录、catalog、Jupiter 与版本配置。
- 构建包仍含三个旧服务 host（portal.unipass.top、accounts.feishu.cn、jupiter.tec-do.com）、credential-core.wasm（51,885 B）和 runtime-config.json（45 B）。脚本输出逐项 SHA-256；必须先构建以免读旧包。
- Vault/共享 WebDAV 的分层、空 registry、数据保留、冲突/错误等既有合成单测继续运行；这些不证明完整扩展已可禁用 adapter。TD-003 保持开放，composition adapter 解耦、WebDAV-only UI/消息、整包禁用回归以及真实 NAS/工具栏验收仍未完成。
- 脚本显式 retirementAccepted=false；保守包含 type-only 导入，记录相对导入解析失败；不以静态路径代替动态网络、树摇或运行时消息覆盖。

## 验证结果

- pnpm verify：通过；46 个测试文件，278 passed / 1 skipped；治理、lint、边界、依赖清单、类型、Web/MV3 构建、包体检查均通过。最终扩展 1,094,807 B，初始静态 JS 270,625 B。
- pnpm test:e2e：首轮 bundled Chromium 80 passed / 3 skipped；加入实际缩放用例后，以 pnpm --dir apps/extension exec playwright test --output=test-results/bundled-full-review-final --reporter=list 对最终构建重跑：81 passed / 3 skipped。
- 系统 Chrome 全量最终命令同上，但设置 UNAS_E2E_BROWSER=chrome，output=test-results/chrome-full-review-final：81 passed / 3 skipped。3 个跳过均为未提供私有授权 Music 夹具，不计入能力验收。
- pnpm --dir apps/extension run test:e2e:web：8 passed。
- Chrome 首轮全量 80 passed / 1 failed / 3 skipped：B 站 1100px 负向样式对照与扩展异步重同步竞争。只修测试：在同一页面 task 内临时替换旧 CSS、测量并恢复，保留 changed=true/misaligned=true 断言，不修改产品规则、不放宽阈值。Chrome 三轮 9/9、bundled 两轮 6/6，再最终全量通过。
- node scripts/legacy-retirement-audit.mjs：成功；13 个直接导入边、20 处旧 UI 引用、0 个未解析相对引用；旧 host/WASM 仍存在，不满足撤除 Gate。
- node scripts/governance-docs-check.mjs、git diff --check：通过。未改 Governance/Design/Frontend/Quality 的篇幅预算；Context 保持三项优先级。
- 最终构建标识：对 56 个产物按路径排序，取相对路径（正斜线）与文件 SHA-256 二元组数组，JSON.stringify 后再 SHA-256，结果 c01ef7e14548d44ed78cb5229c858633f5f6c65b4b644390afca55ff3aa45a13。

## 剩余验收与处置

- TD-002 保留 P1：真实工具栏用户手势、常用 Profile、触控、主观视觉/对比度与未注册工具仍需确认；不宣称整个 Quality 第 5 节已关闭。
- TD-003 保留 P1：本轮完成可自动重复的追踪，不实施 Legacy 应用级解耦或删除兼容模块；不得把空 registry 单测和导入盘点视为关闭证据。
- RISK-012/014 更新已消除的 Chrome 测试入口缺口，其余开放边界保留；RISK-016 真实授权 NAS 兼容性没有本轮实测，不变更状态。
