# 开发蓝图

本文把 Roadmap 拆成可执行工作包。它描述未来顺序，不代表任何产品源码、依赖或能力已经存在。

## 1. 开工原则

- 前端 Demo 先验证产品、视觉和状态完整性；真实能力随后通过 port/adapter 接入。
- Mock 与 Real 使用同一 App/File/Task contract，但 mock 必须可识别、确定性且不生成假文件。
- New Tab 先快后全；Workspace、Tool App、engine 和 WASM 全部按需加载。
- 每个真实能力工作包只回答一个决策问题，包含成功、失败、取消、页面关闭和清理证据。
- 依赖只在对应阶段评估并锁定，不为未来功能一次性安装。

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
- New Tab、Workspace、Service Worker entrypoint；Content/Offscreen 只留设计，不申请权限。
- 验证 New Tab 多实例与 Workspace 查找/复用的前端协议。

### FE-02 Design System

- token、主题、材料、排版、图标、间距、圆角、阴影和 motion。
- Button、Field、Menu、Dialog、Sheet、Toast、Progress、Empty/Error 等 primitive/system components。
- Liquid Glass 的常规、减少透明度和不支持 `backdrop-filter` 回退。

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
