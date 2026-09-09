# 开发蓝图

本文把 Roadmap 拆成可执行工作包，描述后续顺序而非当前状态。Phase 1 的扩展壳、前端依赖和 mock Demo 已存在；实际阶段、验证范围与尚未接入的能力以 [CONTEXT.md](../CONTEXT.md) 为准，不能从本蓝图推断真实文件或引擎能力。

## 1. 开工原则

- 前端 Demo 先验证产品、视觉和状态完整性；真实能力随后通过 port/adapter 接入。
- Mock 与 Real 使用同一 App/File/Task contract，但 mock 必须可识别、确定性且不生成假文件。
- New Tab 先快后全；Workspace、Tool App、engine 和 WASM 全部按需加载。
- 每个真实能力工作包只回答一个决策问题，包含成功、失败、取消、页面关闭和清理证据。
- Phase 1 的前端与测试依赖已锁定；未来引擎依赖只在对应探针完成评估后再引入，不为后续功能一次性安装。

## 2. Phase 0 收尾

| ID | 工作 | 产出 | 完成条件 |
| --- | --- | --- | --- |
| P0-01 | 产品确认 | Product 批注 | 扩展唯一形态、V1/非目标无歧义 |
| P0-02 | 架构与 ADR | 0002 替代、0005/0006 状态 | 长期边界一致 |
| P0-03 | 设计确认 | Design System 批注 | Liquid Glass 使用、原创与无障碍原则接受 |
| P0-04 | Demo 计划 | Frontend Guide 与 App Contract | mock/real 边界和 App 类型明确 |
| P0-05 | 浏览器/法务责任 | owner 与阻断 Gate | Chrome 最低版本、参考环境和许可证责任明确 |
| P0-06 | 治理验收 | checker 输出 | 本地通过，链接与事实源有效 |

## 3. Phase 1 Frontend Demo 工作包

### FE-01 扩展壳与页面边界

- WXT/React/TypeScript 最小结构。
- New Tab、Workspace、Service Worker entrypoint；Content/Offscreen 只留设计，不申请其权限。Link App 配置仅使用 `storage`，不引入 host、文件或下载权限。
- 验证 New Tab 多实例与 Workspace 查找/复用的前端协议。

### FE-02 Design System

- 按 [DESIGN_SYSTEM](DESIGN_SYSTEM.md) 的当前基线对齐共享 token → primitive/system components → Desktop/Tool App 骨架，按受影响范围分批执行。
- 存量迁移先检查最终样式级联中的正文透明与嵌套玻璃，再处理页面私有值、状态和布局差异；不在此复制规范参数。
- 先留存当前 LocalDirectoryPane 的未授权/目录列表参照 → 保持结构提取 AppLayout 与公共控件、解耦窗口业务状态 → 逐个迁移下载、添加 App、设置与日志；未来 Tool App 直接复用，不新增可启动功能。
- 每次迁移移除被替代的私有布局样式，并验证窗口几何、槽位收起、长内容/窄窗口与原业务行为；不只通过统一外框颜色宣称复用完成。
- 每批按 [QUALITY](QUALITY.md) 第 5 节保留证据与例外；规范发布不代表这些实现项已验收。

### FE-03 Desktop Shell

- DesktopCanvas、Dock、AppIcon、搜索/Command Palette、WindowFrame。
- Wide 的桌面窗口与 Regular 的单主视图；窗口越界恢复和键盘切换。
- 首次引导、空桌面、日常桌面和错误边界。

### FE-04 App Runtime

- 静态 System/Tool manifest 与持久化 Link App registry。
- App 启动、单实例聚焦、关闭、分组、Dock 和布局摘要。
- Link URL schema/scheme 校验、重复名称、图标失败和删除确认。

### FE-05 Files Demo

- 选择/拖入入口、文件网格/列表、来源、授权状态、Inspector 和 Open With。
- 首次授权、权限拒绝、句柄失效、损坏、资源超限的 mock 状态。
- 不读取真实文件，不把演示 metadata 写成能力报告。

### FE-06 Tool App Demo

- Image、Archive、PDF、Media 共用工具页骨架：输入、参数、检查、提交、进度、结果、导出。
- 每个 App 有一个成功和一个领域特有失败 scenario。
- 未选择进入真实 V1 的能力仍可演示信息架构，但必须标记计划/模拟。

### FE-07 Task Center

- 队列、运行、不确定进度、取消中、取消、失败、成功和混合批次摘要。
- Workspace 关闭提示、刷新恢复摘要和 owner 冲突状态。
- Mock 时钟确定性，可被测试控制。

### FE-08 响应式、无障碍与演示验收

- Wide/Regular、浅色/深色、减少透明度、减少动态、200% 缩放和长文本。
- 键盘启动/切换 App、焦点陷阱、Escape、拖放替代路径和触控目标。
- 构建证据确认 New Tab 初始 chunk 无 engine/WASM。
- 维护者走查完整主流程并记录主观结论。
- 验收 FE-11 的原生组件与 UI 调度迁移；保留前后截图、焦点/键盘、减少动态和性能对照。

### FE-09 现代 Chrome 基线

- 先记录维护者 Chrome Stable 的完整版本、OS 与参考视口，验证 `browser.*`、Promise listener 和拟用组件 API；不读日常浏览历史或用户文件。按 ADR 0008 确认 manifest 起始下限及构建目标。
- 对齐 WXT 输出、TypeScript 类型、测试 mock 和 Playwright 环境；自动化 Chromium 不能代替目标 Stable 的证据。
- 产出：精确环境清单、可用/不可用结果、拟移除 shim/依赖清单。核心 API 缺失时先解决基线，不默默引入永久 fallback。

### FE-10 扩展 adapter 与消息迁移

- 依赖 FE-09：扩展 adapter 统一原生 `browser.*`，真正异步的 runtime 请求迁移为 Promise 响应；同步拒绝无需为了语法统一变成 `async`，不将所有 listener 无条件 Promise 化。
- 检查 WXT 包装和实际打包依赖，删除确实冗余的旧版 shim；当前源码迁移锚点为 `src/runtime/extensionAdapter.ts`、background entry、WXT 配置及相应测试，不假设仓库已经存在可移除的 polyfill。
- 盘点旧跨标签启动协议和 `workspace.html` 兼容入口，区分“过期 bundle 防重复启动”与“旧浏览器兼容”。可删除无消费者入口，但须同步替代 ADR 0007 的对应条款，验证旧页拒绝/刷新提示；不能仅因私用取消 owner 校验。
- 验收：New Tab、工具栏、同页 App、多页 owner、未知消息、异步失败/超时和旧页残留；BroadcastChannel 保持原传输边界，不能因 Promise 改写拓扑。

### FE-11 原生组件与调度迁移

- 依赖 FE-09，按顺序迁移 Dialog 焦点/Escape → Popover 与锚定菜单 → App 容器响应式 → 简单 CSS 动效/局部 View Transitions → 有测量依据的 UI 分片。
- 优先原生替换等价的自建定位、滚动监听和动画逻辑，替换后删除旧实现，不长期保留新旧两套组件。当前未锁定动画库；未来只有明确无法由 CSS/平台能力满足的复杂交互才可单独评估引入，并须完成回归与包体审查。
- 每个组件保留原有公开语义，验收嵌套浮层、焦点恢复、200% 缩放、长文本、减少动态/透明度和失败态；原生 top layer 不替代完整窗口系统，也不把应用抽屉改为 Side Panel。
- `scheduler.yield()`/任务优先级只处理主线程 UI 工作；先定位长任务并记录改善，不能把引擎计算搬回 UI。React/WXT 大版本升级只有解决具体限制时另立工作包，不作为附带升级。

### FE-12 开发工具接入

- 优先准备官方两个 skill 与 Chrome DevTools MCP：记录版本、来源、更新方式、关闭遥测配置和最小工具范围，审查后再安装；不加入产品运行时或随包发布。
- 默认隔离 profile，建立构建 → 解包加载/重载 → 操作 → Console/trace → 回归证据流程；用户另行同意后才连接日常 profile。生命周期另做无调试器对照。
- 可与 FE-09 的准备工作交错进行；工具不可用时沿用现有 Playwright/人工流程，不阻塞组件迁移，不增加产品权限。

以上是计划工作包，非执行记录；本轮文档授权不触发编码、安装、浏览器设置或数据重置。默认顺序 FE-09 → FE-10 → FE-11，FE-12 按需接入；真实文件/引擎仍等后续 Gate。

## 4. Demo Scenario 格式

每个 scenario 记录：

```text
scenarioId / executionSource=mock
初始状态与目标用户任务
输入 metadata（非真实用户文件）
用户动作
预期 App / Window / Task 状态
错误、取消或恢复路径
Wide / Regular 差异
键盘与无障碍要求
不得被理解为真实能力的文案
```

Scenario 属于测试与演示资产，不是产品支持矩阵。

## 5. Phase 2 能力探针

### SP-01 Extension Runtime

- New Tab override、Workspace 单实例、多标签消息、Service Worker 终止/唤醒和扩展更新。
- CSP、静态 WASM、Dedicated Worker、可选 offscreen 和最小权限。
- 复用 FE-09/FE-10 的环境与消息证据，仅对浏览器或依赖变化重跑相关项，不重复建设第二套基线；扩展到完整 owner 与真实 Worker 生命周期。
- 覆盖 runtime 消息显式错误、超时与多监听器，以及灰度不可用的拒绝/升级路径；区分 Chrome 消息的 JSON 序列化与 BroadcastChannel/Worker 的 structured clone，不直接迁移 Blob/handle 传输假设。
- 验证可选权限请求的用户手势与拒绝路径；若采用 `storage.session`，覆盖 Service Worker 重启、扩展重载与浏览器退出，不能把它当持久恢复。
- 使用已接入的 DevTools MCP 辅助诊断或现有等价工具；生命周期结论必须另有无调试器对照，方法见 [QUALITY](QUALITY.md)。
- 输出：生命周期矩阵、消息边界、页面关闭语义和最低浏览器策略。

### SP-02 File Workspace

- 文件/目录选择、拖入、句柄查询/请求权限、IndexedDB/OPFS、分块、配额、清理和 download fallback。
- 输出：可恢复/不可恢复说明、临时数据策略和导出提交方案。

### SP-03 Image

- PNG/JPEG/WebP、伪扩展名、EXIF orientation、透明度、色彩、像素预算、取消和输出验证。
- 输出：首个真实操作与舒适/谨慎/拒绝范围。

### SP-04 Archive ZIP

- Zip64、流式读写、重复名、加密状态、路径穿越、压缩炸弹预算和取消。
- 输出：V1 ZIP 操作表和安全策略；不顺带验证 RAR/7z。

### SP-05 PDF

- 合并、拆分、旋转、页面渲染、图片转 PDF；加密、损坏、字体、对象数、超大页和外部引用。
- 输出：V1 PDF 操作表、视觉/元数据验证和不支持项。

### SP-06 Media Native

- WebCodecs 配置、demux/mux、时间戳、VFR、音视频同步、缩略图和输出播放性。
- 输出：可走原生路径的最窄操作。

### SP-07 ffmpeg.wasm

- 同一夹具的单/多线程、冷/热加载、耗时、内存、取消、Worker 终止、临时 FS 和扩展 CSP。
- 输出：是否进入 V1、core 组成、包体、哈希、许可证和拒绝阈值。

### SP-08 Packaging 与本地交付

- Chrome 解包安装、Link App 与工具关系、required/optional permissions、本地隐私说明和离线包。
- 输出：权限清单、安装/升级/卸载步骤、包体与离线资源报告、公开分发前置项。
- 权限清单按实际构建 manifest 核对 required/optional/host permissions、用户动作、用途、拒绝与撤销后果；不为商店或工具示例增加权限。进入未来 Store Gate 时再按官方模板生成 `CHROMEWEBSTORE.md`，引用 Product/Security 与实际证据，不复写当前阶段，也不把资料准备视为发布授权。

## 6. 探针记录格式

每个探针在 `benchmarks/<probe>/README.md`（进入 Phase 2 后创建）记录：

```text
问题 / 假设 / 阻断 Gate
环境（OS、设备、浏览器、扩展版本、安全上下文）
输入夹具（来源、许可证、哈希、大小、结构）
步骤与命令
测量方法与结果
失败、取消、页面关闭和清理
结论：接受 / 降级 / 延后 / 拒绝
替换哪个 mock scenario
需更新的 Product / Architecture / Contract / Risk / ADR
```

原始大文件不进 Git；保留生成脚本、小型夹具、manifest、哈希和汇总结果。

## 7. Phase 3 真实垂直切片顺序

```text
App/File/Task schemas
  → Job transition + staged output contract tests
  → capability probe + planner
  → File Workspace adapters
  → Workspace owner + Worker runtime
  → Image adapter
  → 替换 Files/Image mock
  → output validation/export/cleanup
  → Extension E2E + New Tab regression
```

真实 adapter 接入以 scenario parity 验收：同一 UI 流程在 mock 和 real 下结构一致，但能力原因、性能和结果来自真实证据。

## 8. 前端与依赖策略

已接受方向：pnpm workspace、TypeScript strict、React、WXT/Vite、CSS token + 局部组件样式。精确版本和新增库按 Gate 锁定。

前端候选依赖需回答：

- 是否支持扩展 CSP、ESM、tree-shaking 和按入口拆包。
- New Tab 初始包体、样式运行时和主题成本。
- 键盘、触控、无障碍与减少动态能力。
- 是否迫使组件绕过 token 或产生全局样式耦合。
- 维护状态、许可证和替代方案。

引擎候选依赖额外回答：WASM 体积、Worker、CSP、流式、取消、Transferable、确定性输出、供应链和许可证。

## 9. Issue / PR 拆分

- Design token、primitives、Desktop Shell、App Runtime、Files、Task Center、各 Tool App 分开评审。
- 一个 PR 不同时引入视觉系统、真实 engine 和新权限。
- Mock scenario 与对应 UI 同 PR；真实替换另建 adapter PR。
- 每个 SP 独立 issue；Media Native 与 ffmpeg.wasm 不合成一个“大媒体选型”。
- 权限、文件写入、持久化、远程资源、公开 contract 和阶段范围变化关联 ADR/Risk。

## 10. Gate 评审材料

1. 本阶段目标与明确非目标。
2. 可操作 Demo 或真实路径的证据清单。
3. Mock/Real 状态和未运行项。
4. 风险变化、降级和接受决定。
5. 设计、App、Task 或安全契约是否变化。
6. 下一阶段允许替换哪些 adapter，明确仍不允许的能力。
