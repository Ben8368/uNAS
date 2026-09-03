# Roadmap

Roadmap 只描述阶段结果和门禁；具体工作包见 [DEVELOPMENT_BLUEPRINT.md](DEVELOPMENT_BLUEPRINT.md)，当前优先级见 [CONTEXT.md](../CONTEXT.md)。阶段以证据退出，不用日期、页面数量或代码量伪装进度。

## Phase 0：产品、设计与治理

**目标：** 在产品代码前明确扩展原生的新标签页定位、前端先行策略、App/Task 契约、视觉约束、安全边界和决策机制。

交付物：

- Product、Architecture、App Contract、Engine Contract、Security、Quality。
- Design System、Frontend Guide、Roadmap、Development Blueprint。
- Risk、Tech Debt、ADR、治理路由与无依赖检查。

**Gate G0 — 允许 Frontend Demo：**

- 确认扩展是唯一产品，New Tab 是主入口，Workspace 是工具和任务运行面。
- 确认前端 Demo 先行、真实能力后置，并接受 mock 真实性边界。
- 确认 System/Tool/Link App 类型和 V1 非目标。
- 接受 ADR 0001、0003–0006；ADR 0002 已由 0005 替代。
- 决定 Chrome 最低版本策略、验证 OS 和 Wide/Regular 参考视口。
- 文档治理检查通过；当前阻断风险有 owner 或明确接受人。

## Phase 1：Frontend Demo

**目标：** 在不接入真实文件和引擎的前提下，交付可安装、可交互的新标签页扩展 Demo，验证产品结构、Liquid Glass 视觉方向和完整任务状态。

交付：

- WXT/React/TypeScript 最小扩展壳：New Tab、Workspace、Service Worker entrypoint。
- Design token、primitive、Desktop、Dock、Window/Regular layout 和系统组件。
- App Registry、System/Tool/Link App、启动、聚焦、关闭和 URL 校验。
- Files、Image、Media、PDF、Archive、Task Center、Settings 的确定性 mock 流程。
- 空态、权限拒绝、资源超限、处理中、取消、失败、成功和恢复摘要。
- Wide/Regular、深浅主题、减少透明度、减少动态、键盘与触控验收。

本阶段禁止真实格式承诺、真实输出、engine/WASM 和未来宽权限。

**Gate G1 — Demo 设计候选：**

- 维护者确认信息架构、核心流程、视觉原创性和文案。
- Mock 在 UI、构建信息和演示材料中可识别，不产生假输出。
- New Tab 首屏不含 engine/WASM，不依赖网络完成渲染。
- 解包扩展验证 New Tab、Workspace 单实例复用、刷新和多标签摘要。
- Wide/Regular、键盘、主题和无障碍降级有证据。
- 记录真实能力接入后可能改变的交互假设。

## Phase 2：扩展能力探针与契约收敛

**目标：** 保留已验收前端，通过隔离探针验证 MV3、文件、存储、Worker 和各引擎现实；探针不直接进入 UI。

工作流：

1. Extension Runtime：MV3 CSP、New Tab 多实例、Workspace owner、Service Worker、更新和 offscreen 边界。
2. File Workspace：文件/目录授权、句柄恢复、IndexedDB、OPFS、配额、导出和清理。
3. Image：解码像素、EXIF、透明度、色彩、转换和取消。
4. Archive：ZIP 列表/解压、Zip64、路径穿越、炸弹预算和取消。
5. PDF：合并/拆分/渲染、加密、损坏、字体、对象和像素预算。
6. Media：WebCodecs、容器、ffmpeg.wasm、CSP、冷/热启动、内存和输出播放验证。
7. Packaging：Chrome 解包安装、包体、离线资源、权限清单、更新迁移和许可证。

交付物：能力矩阵、固定夹具 manifest、基准结果、资源阈值、依赖/许可证清单、需要修改的契约和 ADR。

**Gate G2-Core — 允许真实 Files + Image：**

- Extension Runtime、File Workspace 和 Image 各有成功、失败、取消与清理证据。
- 明确 Workspace 所有权、页面关闭终态、OPFS 策略和最小权限。
- Task/Output 提交契约已收敛，mock 与 real adapter 可以按 port 替换。
- Files 与 Image 被标记为可实现、降级、延后或不支持。
- 阻断 G2-Core 的风险已关闭、降级或由维护者接受。

ZIP、PDF、Media 不阻断 G2-Core；它们在进入各自集成前完成模块 Gate。

## Phase 3：真实垂直切片

**目标：** 用 Files + Image 证明从用户授权到 Worker、输出验证和导出的真实闭环，同时保留 Phase 1 桌面体验。

交付：

- 真实 File Workspace adapter 和 capability UI。
- Image 一个最窄但完整的操作。
- Task Core、Worker runtime、资源治理、取消、错误、staged output 和清理。
- Mock/Real 构建与场景隔离。
- 目标 Chrome 解包扩展 E2E。

**Gate G3 — 允许扩展真实模块：**

- UI 不直连引擎或 Chrome 特权，App/Task contract 稳定。
- 授权拒绝、损坏输入、资源超限、取消、页面关闭和导出失败均有证据。
- New Tab 性能不因 Image engine 接入而退化到预算外。
- 输出验证和提交边界明确，无假成功或遗留临时数据。

## Phase 4：ZIP、PDF、Media 模块化接入

**目标：** 按风险从低到高替换对应 Tool App 的 mock adapter，不重写 Desktop 或 App Runtime。

默认顺序：Archive ZIP → PDF → Media。

每个模块自己的进入 Gate 至少要求：

- 成功、损坏、伪扩展名、资源膨胀、取消和清理夹具。
- 目标浏览器、设备、输入、耗时、内存、输出验证和不支持表。
- 依赖、WASM、字体/素材、许可证、CSP 和包体影响可审计。
- Tool App 文案只展示已验证能力，未接入部分继续显示 mock 或不可用，但不能混为真实。

**Gate G4 — V1 功能候选：**

- Product 中实际选择进入 V1 的模块都有真实扩展证据。
- 无活跃的 V1 阻断风险或 P0 技术债。
- Task Center、文件关联、历史摘要、迁移和升级路径完整。
- New Tab、Workspace、权限、包体、无障碍和性能回归通过。

## Phase 5：Chrome 本地可用候选

**目标：** 形成可在目标 Chrome 环境中解包安装、升级、回滚和卸载的本地可用候选；本阶段不以上架扩展商店为目标。

**Gate G5 — 本地交付：**

- 产品用途与实际功能一致；Link App、文件处理和权限关系可解释。
- required/optional permissions 逐项有用户动作、用途和披露。
- 无远程可执行代码、未授权素材、DRM/CORS/登录绕过或隐藏数据流。
- 本地隐私说明、第三方许可证、WASM 哈希、安装说明和更新迁移完整。
- 解包安装、更新、回滚、卸载数据后果和故障恢复经过人工确认。

## Phase 6：证据驱动的增强

只有用户需求和真实数据证明必要时才进入：

- RAR/7z/TAR、更多 codec、复杂 PDF、长任务 checkpoint。
- 更复杂窗口管理、布局同步、Link App 导入/导出和主题生态。
- Chrome Web Store 上架、商店数据披露、审核材料和公开更新渠道。
- Firefox/Safari、云同步、账号、服务端处理或 Native Helper。
- 第三方可安装 App、用户脚本或远程能力平台。

每项需要独立 Product、安全模型、风险、ADR 和发布计划，不得作为 V1 的隐性范围。
