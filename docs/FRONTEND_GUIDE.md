# 前端 Demo 与实现指南

本文规定前端先行阶段的技术框架、代码边界、mock 策略、响应式与验收方式。产品范围见 [PRODUCT.md](PRODUCT.md)，视觉规则见 [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)，App 语义见 [APP_CONTRACT.md](APP_CONTRACT.md)。

## 1. 前端先行的含义

Phase 1 先完成可交互的扩展前端 Demo，用于确认产品结构、桌面交互、视觉语言和完整状态，而不是证明文件能力。

- Demo 可以模拟文件、任务、进度、权限拒绝和输出，但必须显式标记 mock。
- UI 使用稳定 port/contract；真实文件、Worker、WASM 和 Chrome 权限在后续阶段通过 adapter 接入。
- 不为了做 Demo 在 React 组件中直接调用浏览器 API 或引擎库。
- Demo 的“成功”只代表交互验收通过，不代表任何格式、性能或浏览器能力已验证。

## 2. 计划技术基线

- TypeScript strict。
- React 作为界面与组件模型。
- WXT 管理 Manifest V3 entrypoint 和 Vite 构建。
- CSS Custom Properties 作为 token 载体，CSS Modules 或同等局部样式机制承载组件样式。
- Storybook 类组件工作台、Vitest 类单元测试、Playwright 类扩展 E2E 为计划方向；精确依赖与版本在对应 Gate 锁定。

不在 Gate 前锁定动画库、状态库、路由库或大型 UI 套件。Liquid Glass 需要原创材料层和严格降级，禁止直接套用通用“毛玻璃后台模板”。

## 3. 前端分层

```text
entrypoints/newtab | workspace | background | content
  → screens / app views
    → desktop patterns
      → system components
        → primitives + tokens

screens
  → application ports
    → mock runtime (Phase 1)
    → real runtime adapters (Phase 3+)
```

- entrypoint 只负责启动、上下文绑定和错误边界。
- screen 负责组合，不持有文件系统或 engine 实例。
- desktop pattern 只实现窗口、Dock、启动和布局语义。
- application port 暴露 App、Files、Tasks、Settings 等用例。
- adapter 负责 `chrome.*`、File System Access、IndexedDB/OPFS、Worker 和引擎库。

## 4. 页面与运行时

| Surface | 职责 | 禁止 |
| --- | --- | --- |
| `newtab` | 快速桌面、搜索、Link App、启动 Tool App | 预加载大型 WASM、成为长任务唯一所有者 |
| `workspace` | 复用的工具工作区和长任务所有者 | 假设页面关闭后任务仍持续 |
| `service-worker` | 安装、点击、菜单、消息路由、窗口复用 | DOM、长计算、仅存内存的关键状态 |
| `content-script` | 用户触发的网页上下文桥 | 广泛注入、任意 URL 抓取、接收未校验命令 |
| `offscreen` | 经探针证明必要的受限后台 DOM 场景 | 作为默认常驻应用或万能 Worker |

New Tab 必须把 Tool App 代码和 engine chunk 延迟到启动后；不能因增加媒体能力而拖慢每次新标签页打开。

## 5. Mock Runtime

Mock 场景必须确定、可复现并覆盖：

- 空状态、首次引导、已有数据。
- 选择文件成功、权限拒绝、文件损坏、资源超限。
- 任务排队、可确定进度、不确定进度、取消、失败、成功。
- Link App URL 非法、图标失败和重复名称。
- Workspace 已存在、重复打开、刷新与恢复摘要。

Mock 规则：

- scenario 使用固定 ID 和静态 fixture metadata，不读取用户真实文件。
- 延时由测试时钟控制，不用随机数制造偶发状态。
- mock 结果不能下载成看似真实的媒体/PDF/ZIP。
- 构建信息、About 或 Demo Banner 显示 `executionSource: mock`。
- 真实 adapter 接入后，mock 仍用于组件、视觉回归和失败路径测试。

## 6. 状态边界

- Desktop state：布局、Dock、窗口、焦点和主题。
- App Registry state：内置 manifest 与用户 Link App。
- File projection：UI 可见的文件摘要，不保存大型 Blob。
- Task projection：公共状态、进度和错误，不保存引擎私有对象。
- Capability state：可用性、原因、限制和证据，不能硬编码为浏览器名单。

状态容器的具体库后置决定；先以接口、事件和持久化边界约束，避免形成单个全局 store。

## 7. 性能约束

- New Tab 首屏不得依赖网络请求完成渲染。
- 媒体、PDF、Archive engine 和 WASM 不进入 New Tab 初始 chunk。
- 壁纸、图标和预览有尺寸、解码像素和缓存预算；不提交超大演示资产。
- 大面积 blur、实时反射和阴影动画必须在目标设备实测；无法稳定时自动降级。
- 性能数字只有在参考设备、浏览器版本和测量方法确定后才能成为 Gate 阈值。

## 8. 响应式与输入

- Wide 采用桌面画布与窗口；Regular 采用单主窗口和触控友好导航；Compact 只保证基本可用。
- 同一功能同时支持鼠标、键盘和触控；拖放必须有文件选择替代路径。
- 使用逻辑方向和可本地化布局，不把左右位置写死为业务语义。
- 组件在 200% 缩放、长文本和空/错误状态下不能溢出关键操作。

## 9. 前端验证

Phase 1 最低证据：

1. token 与 primitive 的组件状态矩阵。
2. Desktop、Files、Task Center 和各 Tool App 的 mock 主流程。
3. Wide/Regular、浅色/深色、减少透明度/动态。
4. 键盘导航、焦点、Dialog/Sheet 和错误提示。
5. 解包扩展中的 New Tab、Workspace 复用和刷新路径。
6. 初始 chunk 中不包含 engine/WASM 的构建证据。
7. 维护者对视觉、文案和任务流的主观确认。

## 10. 禁止事项

- 组件直接 import `chrome.*`、ffmpeg、PDF、ZIP、codec 或 OPFS 实现。
- 为追求“像系统”复制 Apple 图标、壁纸、字体或逐像素界面。
- 用 blur 掩盖层级问题，或在内容列表上叠加多层透明表面。
- Mock 成功路径写入真实能力文案、格式支持表或商店截图而不披露。
- 为 Demo 提前请求 `host_permissions`、downloads、clipboard 或其他宽权限。
