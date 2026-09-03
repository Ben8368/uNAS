# ADR 0006：前端 Demo 先行与可替换能力适配

- 状态：已接受
- 日期：2026-09-03

## 背景

产品的主要差异在新标签页桌面、App 模型和文件工作流。先完成技术引擎会延迟对产品结构和视觉体验的验证；但直接在 Demo 中伪造“已支持”又会污染能力事实。

## 决策

- Gate G0 后先建设可交互前端 Demo，再进行真实文件和引擎能力接入。
- Demo 使用与正式运行时相同的 App、File、Task 和 Error contract，通过确定性 mock adapter 提供数据。
- 所有 mock 结果显式标记，不产生可被误认为真实处理的输出，也不升级任何格式支持状态。
- UI 只能依赖 application port；真实 Chrome API、文件系统、Worker 和 engine adapter 在后续阶段逐项替换 mock。
- Liquid Glass 风格遵循原创、克制、可降级和无障碍原则；视觉验收与能力验收分开。

## 后果

好处：可以尽早确认产品与交互，组件和失败状态不等待全部引擎。代价：真实能力证据可能要求调整交互，因此 Demo 不是最终实现，adapter seam 和能力文案必须严格。

## 替代方案

- 引擎探针全部完成后再做 UI：拒绝作为主顺序，产品体验反馈过晚。
- Demo 组件直接调用临时库：拒绝，会把视觉原型变成不可替换的产品耦合。
- 仅做静态设计稿：拒绝，无法验证窗口、任务、键盘和响应式行为。

## 关联文档

- [FRONTEND_GUIDE.md](../FRONTEND_GUIDE.md)
- [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md)
- [ROADMAP.md](../ROADMAP.md)
- [QUALITY.md](../QUALITY.md)
