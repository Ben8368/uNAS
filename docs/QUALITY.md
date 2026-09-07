# 质量与验收策略

## 1. 质量目标

uNAS 的长期优先级是：正确输出与数据安全 > 可取消和可解释失败 > 能力真实性 > New Tab 响应 > 视觉完成度 > 格式数量。

Frontend Demo 阶段的优先级是：交互真实性 > 状态完整 > 无障碍与可读性 > 响应式 > 视觉效果。Demo 通过不等于文件能力通过。

## 2. 证据类型

| 状态 | 可声称内容 | 不可声称内容 |
| --- | --- | --- |
| 文档设计 | 方案、边界、计划 | 已实现、可运行 |
| Mock Demo | 信息架构、交互、视觉与模拟状态 | 格式支持、真实性能、真实输出 |
| 已实现未验证 | 代码存在、测试范围 | 目标浏览器可用、性能达标 |
| 已验证 | 约定环境和夹具内的结论 | 未覆盖浏览器、输入或规模 |

演示截图、视频、PR 和商店材料必须保留相同证据语义。

## 3. 测试分层

| 层级 | 关注点 | 典型证据 |
| --- | --- | --- |
| 文档治理 | 事实源、预算、链接、ADR | `docs:governance:check` |
| Token/Component | 主题、状态、键盘、无障碍 | 组件测试、状态矩阵 |
| Visual | Liquid Glass、布局、降级、回归 | Wide/Regular 截图与人工审查 |
| App Contract | manifest、Intent、URL、生命周期 | schema round-trip、contract tests |
| Mock Flow | Desktop、Files、Tasks、Tool App 状态 | 确定性 scenario E2E |
| Runtime Contract | Job、owner、输出提交、错误 | unit/contract tests |
| Adapter/Worker | 固定文件、取消、损坏和清理 | Worker 集成与元数据断言 |
| Extension E2E | New Tab、Workspace、权限、CSP、升级 | 解包扩展真机与自动化 |
| Performance | New Tab、包体、时间、内存、配额 | 固定环境基准与趋势 |
| Subjective | 信息层级、文案、流畅感和原创性 | 维护者/用户人工确认 |

## 4. Frontend Demo 验收

- 所有 App 和任务状态来自确定性 scenario，可重复选择和重放。
- `executionSource: mock` 在 UI、构建信息和演示材料中可见。
- Mock 不读取用户真实文件，不生成可误认的媒体/PDF/ZIP 输出。
- New Tab 初始 chunk 不含 engine/WASM，不依赖网络完成首屏。
- New Tab 多实例只显示 projection；Workspace 复用和 owner 冲突有模拟状态。
- 空态、加载、权限、错误、取消、恢复和长文本与主流程同等验收。

## 5. 视觉、响应式与无障碍

- Liquid Glass 只在导航、控制和临时层使用，内容表面保持稳定。
- 每个 glass 组件验证浅/深壁纸、减少透明度、高对比和 `backdrop-filter` 回退。
- Wide/Regular 必须完成主流程；Compact 保证关键操作可用且不丢失数据。
- 键盘可完成启动/切换 App、菜单、Dialog、文件选中后的主要动作。
- 200% 缩放、长文本、本地化和触控目标不遮挡关键操作。
- `prefers-reduced-motion` 下没有弹性、视差和持续背景动画。
- “像 macOS/iPadOS”只是方向，不是验收证据；原创性和许可证需单独审查。

## 6. 浏览器与扩展矩阵

目标矩阵须在 Gate G1 前确认；当前未定的浏览器版本、验证 OS 和参考视口由 RISK-001 跟踪。每项真实验收记录：

- OS、设备 CPU/内存、浏览器与精确版本、扩展版本。
- New Tab override、Workspace 页面、Service Worker、CSP 和存储上下文。
- File System Access、IndexedDB/OPFS、WebCodecs、SharedArrayBuffer 和 WASM probe。
- required/optional permissions、用户触发点和拒绝路径。
- 页面关闭、浏览器重启、扩展更新和卸载后的数据后果。

普通网页或开发服务器成功不能代替 MV3 解包扩展证据。

## 7. 真实文件夹具

- 每个夹具有来源、许可证、生成方式、SHA-256、大小、结构和测试目的。
- 优先程序生成或自有小型夹具；大文件只保留生成脚本、哈希和汇总。
- 每个引擎至少覆盖最小有效、常见有效、损坏、伪扩展名、资源膨胀、权限失败和取消。
- 输出至少验证签名、尺寸/时长/页数/entry、codec 或内容摘要，不能只看文件存在。

## 8. 资源与性能

- New Tab 单独记录初始 JS/CSS、冷/热打开、可交互时间和大面积特效降级。
- Workspace/engine 记录加载、读取、处理、验证、导出、峰值 JS/WASM 内存、OPFS 和最终体积。
- 测量方法、参考设备和统计方式先于数值阈值；未经统一方法的数字不进入 Gate。
- 真实阈值至少分舒适、谨慎和拒绝，并在分配大内存前执行。
- 预算依据解码像素、帧、页、对象、entry 和展开体积，不只看输入字节。

## 9. 安全与失败

- 输入不信任扩展名；ZIP 路径穿越/炸弹、PDF 复杂对象、图片像素炸弹和畸形媒体均有负向夹具。
- 取消、Worker 崩溃、owner 丢失、页面关闭、配额不足、导出拒绝和 engine load 失败有明确终态。
- 所有终态验证 URL、stream、reader/writer、handle、Worker、lease 和 OPFS 临时对象释放。
- 输出先暂存、再验证、再提交；默认不覆盖有效原文件。
- Link App URL 和跨上下文消息使用 schema、scheme 与 sender 校验。

## 10. Definition of Ready

工作包进入实现前：

- 属于当前 Roadmap 阶段，范围、非目标和证据类型明确。
- Frontend 工作有 mock scenario、视觉状态和无障碍验收。
- 真实能力工作有 contract、错误、资源预算、成功/失败/取消夹具。
- 新依赖完成维护性、包体、CSP、许可证、替代方案和 New Tab 影响评估。
- 长期边界有 ADR，外部未知登记到明确阻断 Gate 的 Risk。

## 11. Definition of Done

### Frontend Demo

- 交互范围完整，无静态占位按钮和未说明的假成功。
- mock 来源明确；New Tab 与 Workspace 分包边界有构建证据。
- 组件、mock flow、扩展 E2E 和主观视觉验收完成。
- 未验证真实能力仍保持计划/模拟状态。

### Real Capability

- 真实 adapter 替换对应 mock，contract tests 和 scenario parity 通过。
- 固定夹具覆盖输出、错误、取消、页面关闭、资源限制和清理。
- 目标扩展真机、性能、权限、CSP 和供应链证据完成。
- Product/Architecture/Contract/Risk 只在事实变化时更新。

## 12. 统一命令演进

Phase 0 的 `pnpm verify` 只有治理检查。引入前端后逐步扩展：

```text
docs governance → boundary/dependency → unit/contract → typecheck → build/package → selected extension E2E
```

视觉、真机、性能和商店材料可分命令，但对应 Gate 必须显式调用；未运行项写明原因，不能由构建通过代替。

现有 Demo 的跨平台入口是 `pnpm verify`；它当前依次执行治理、Demo 边界、依赖清单、Vitest、TypeScript、Vite/WXT 构建和包体检查，尚未配置 lint 工具。MV3 独立浏览器回归是 `pnpm test:e2e`（先构建扩展），Web 回归是 `pnpm --dir apps/extension run test:e2e:web`。首次运行需要安装 Playwright Chromium。

GitHub Actions 在 `main` 的 push、PR 和手动触发中运行：治理检查；使用 Node 22、根 `packageManager` 声明的 pnpm 和 `pnpm install --frozen-lockfile` 的 `pnpm verify`；以及在完整验证通过后执行的 MV3/Web E2E。E2E 报告、截图和失败 trace 以 CI artifact 保留 14 天。E2E 的浏览器版本、环境、截图和失败 trace 必须与结果一起记录；视口模拟不等于实际浏览器 200% 缩放或目标设备性能。
