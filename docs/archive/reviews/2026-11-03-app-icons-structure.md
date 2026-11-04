# 2026-11-03 桌面图标与 App 结构重构验证

## 范围与环境

- 起点：`c169bf0`；`git fetch origin` 与 `git pull --ff-only origin main` 成功，远端 main 无新增提交。未提交、推送或发布本轮改动。
- Windows 11（win32 10.0.26200 x64）、Node 24.13.0、pnpm 11.19.0；系统 Chrome 156.0.8078.74，隔离 Profile、headless、sRGB，加载本地 WXT MV3 构建。
- UI v1.9，影响 UI-02/03/05/06：本地 App SVG、Desktop/启动器/Dock/窗口图标、App 目录与实现组合。没有权限、引擎、文件能力、依赖或数据格式变化。
- App ID、入口顺序、窗口行为与按需加载保留。Link App 继续 HTTPS 跳转，用独立网页图标，不执行远程代码。

## 命令与结果

| 命令（根目录执行，另注除外） | 结果 |
| --- | --- |
| `pnpm verify` | 通过；扩展单测 539 passed / 3 skipped，Git hook 15 passed；兼容包 Node 184 passed、Rust 5 passed；lint、类型、构建、边界、包体与素材检查通过；依赖审计 0 vulnerabilities |
| `$env:UNAS_E2E_BROWSER='chrome'; pnpm exec playwright test appIcons.spec.ts launchLifecycle.spec.ts inlineWorkspace.spec.ts layout.spec.ts browserZoom.spec.ts`（apps/extension） | 27 passed；文件名匹配还包含 bilibili-layout.spec.ts 的 3 项；未运行完整 MV3 套件 |
| `$env:UNAS_E2E_BROWSER='chrome'; pnpm exec playwright test appIcons.spec.ts appTheme.spec.ts overlay-icon.spec.ts browserZoom.spec.ts`（apps/extension） | 16 passed；补强音乐启动完成断言后重跑图标用例，含 8 个 App、导航共享样式、闭合 Shadow DOM 内 AdBlock 图标与真实 200% 页面缩放 |
| `pnpm --dir apps/extension run test:e2e:web` | 8 passed；含故意拒绝 lazy chunk 的错误恢复用例，其预期 console.error 不代表套件失败 |
| `node scripts/governance-docs-check.mjs`、`node scripts/architecture-boundary-check.mjs`、`pnpm lint`、`pnpm --dir apps/extension run typecheck`、`git diff --check` | 收尾重新检查；治理文档链接修正后通过，架构扫描 368 文件、已登记耦合 0 条 |

完整验证保留兼容包已有两个单文件行数黄色提示：vault-service.ts（386 行）和 catalog.ts（357 行）；本轮未修改它们，不将静态提示冒充失败或新增安全结论。

## 证据与边界

- 新增 [appIcons.spec.ts](../../../apps/extension/e2e/appIcons.spec.ts)：比较各入口本地 SVG 路径、48/32px 尺寸、图标不重复读屏名称、搜索/键盘启动、关闭焦点恢复、图标加载失败回退。
- 视口覆盖 1440、1100、1099、1024、700、699、390 CSS px，另有 720×450 布局模拟；forced-colors、减少动态及既有 App 材料降级均有回归。视口模拟不等于设备实测。
- [browserZoom.spec.ts](../../../apps/extension/e2e/browserZoom.spec.ts) 经 tabs.setZoom 验证真实页面 200% 缩放；不冒充用户工具栏手势或触控。
- 目视检查桌面与已完成加载的音乐窗口截图；图标尺寸、边界和字形未见截断。白色主体与两端背景颜色的数值对比度由单测检查 ≥3:1，不代表所有视觉体验已验收。
- 本地日志：`artifacts/icon-structure-{verify,chrome,chrome-final,web}.log`；首轮截图与环境：`artifacts/icon-structure-chrome-initial/`；最终 Chrome 证据：`artifacts/icon-structure-chrome-final/`。均为忽略的本地生成产物，可通过上述命令重建，不作为 Git 链接目标。
- New Tab/App 固定深色；未改主题策略，浅色系统设置不代表浅色桌面。未扩大音乐格式、浏览器兼容、性能或安全认证声明。
- 人工识别性、维护者常用 Profile、触控和视觉偏好仍按 [TD-002](../../TECH_DEBT.md#td-002全局兼容样式的局部化迁移) 跟进，不以自动化关闭 UI 验收。
