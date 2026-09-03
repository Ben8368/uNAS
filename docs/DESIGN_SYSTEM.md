# 视觉与交互设计系统

本文是 uNAS 前端视觉语言、响应式行为和无障碍约束的唯一事实源。目标是形成原创的桌面级浏览器体验；可以借鉴 Apple 当前的 Liquid Glass 原则，但不得复制 Apple 的商标、图标、壁纸、字体文件、界面截图或逐像素布局。

## 1. 设计目标

- 新标签页在第一眼像一个克制、可信、可工作的数字桌面，而不是工具链接集合。
- 宽屏使用桌面式层级与窗口；平板宽度使用触控优先的全屏页、侧栏和 sheet。
- 内容永远优先于效果；玻璃承担导航、控制和临时浮层，不承担大面积正文内容。
- 所有动态效果都有低性能、减少动态、减少透明度和高对比回退。
- Demo 与真实能力使用相同组件，但必须显式区分模拟结果和真实结果。

## 2. 视觉原则

### 内容层与功能层

```text
Wallpaper / ambient background
  → Content surface
    → Navigation glass
      → Transient overlay
```

- `Content surface` 使用稳定、近实色的表面承载文件、表单、表格、预览和长文本。
- `Navigation glass` 用于 Dock、工具栏、侧栏、窗口控制区和悬浮命令条。
- `Transient overlay` 用于菜单、popover、tooltip、任务通知和临时 sheet。
- 禁止在玻璃表面内继续嵌套同等级玻璃；禁止把所有卡片都做成透明磨砂块。

### Liquid Glass 的 Web 转译

- **透射**：允许背景色彩轻微进入表面，但不得损害文字和图标可读性。
- **边缘聚光**：只在边框和交互状态使用克制高光，不模拟夸张的实时光线追踪。
- **环境适配**：根据壁纸明暗选择 tint、shadow 和前景色，而不是固定一套透明度。
- **形变反馈**：点击、拖动和展开可有轻微尺度或圆角变化；不得持续漂浮、闪烁或追随鼠标制造噪声。
- **层级清晰**：玻璃的用途是把控制层从内容层中分离，而不是展示技术效果。

Apple 官方原则同样强调 Liquid Glass 主要用于 controls/navigation、应谨慎使用并提供降低透明度、提高对比度和减少动态的适配。参考 [Human Interface Guidelines: Materials](https://developer.apple.com/design/human-interface-guidelines/materials) 与 [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)。这些资料只作为设计原则来源，不作为视觉资产来源。

## 3. 设计 Token

Token 名称表达语义，不表达某个页面：

```text
color.background.*
color.content.*
color.text.*
color.accent.*
material.content
material.glass.navigation
material.glass.overlay
border.subtle / border.strong
shadow.window / shadow.floating
radius.control / radius.panel / radius.window
space.1 ... space.8
motion.fast / motion.normal / motion.slow
```

- 颜色、模糊、透明度、阴影和圆角必须来自 token，不在组件中散落魔法数。
- `backdrop-filter` 只是增强；不支持或被用户关闭时，使用不透明度更高的实色表面。
- 品牌强调色只用于主操作、当前 App 和关键状态；错误、警告、成功不能只靠颜色表达。
- 字体使用跨平台 `system-ui` 栈；不得随包分发 Apple 专有字体。
- 图标使用自有或许可证清晰的矢量集，建立统一笔画、视盒和光学尺寸规则。

## 4. 布局模式

布局按可用空间和输入方式适配，不通过 UA 模拟设备：

| 模式 | 主要行为 |
| --- | --- |
| Wide | 桌面画布、Dock、可移动窗口、多列文件视图 |
| Regular | 单主窗口、可折叠侧栏、底部或侧边启动器 |
| Compact | 全屏 App、sheet 导航、单列内容；只保证可用，不作为首发主体验 |

- 优先使用 CSS Container Queries；viewport breakpoint 只作为壳层回退。
- 宽屏窗口必须有最小/最大尺寸和安全边界，不能拖出可视区后无法恢复。
- 触控目标建议不小于 44 CSS px；鼠标专属 hover 不能承载唯一信息。
- 键盘必须完成 App 启动、窗口切换、搜索、文件选择后的主要操作和退出弹层。

## 5. 核心组件

组件分层：

```text
Tokens
  → Primitives
    → System Components
      → Desktop Patterns
        → App Views
```

- **Primitives**：Button、IconButton、TextField、Select、Switch、Progress、Divider。
- **System Components**：GlassPanel、Toolbar、Sidebar、Dialog、Sheet、Menu、Toast、EmptyState。
- **Desktop Patterns**：DesktopCanvas、Dock、AppIcon、WindowFrame、CommandPalette、TaskShelf。
- **File Patterns**：FileGrid、FileList、DropZone、Inspector、OpenWith、ExportPanel。

App 页面只能组合公开组件和 token；不得复制一套私有 Dock、Window 或 Dialog。

## 6. 动效

- 动效解释状态变化：启动、聚焦、最小化、展开、拖放、任务进入终态。
- 快速反馈优先，长动画不得阻塞输入；持续动画不得成为背景常态。
- 窗口和 glass 形变使用 transform/opacity 等可合成属性，避免高频触发布局和大面积重绘。
- `prefers-reduced-motion: reduce` 下移除弹性、视差、跟随和非必要形变，只保留短淡入淡出。
- 动效是否达到稳定帧率必须由目标浏览器实测；设计稿不能宣称性能通过。

## 7. 无障碍与可读性

- 支持浅色、深色、自动模式，以及减少透明度、高对比和减少动态的产品设置。
- 玻璃背景上的正文、图标和焦点环必须在实际壁纸组合上验证对比度。
- 焦点状态不能只靠阴影；选中、拖放目标和危险操作需同时有形状或文本提示。
- 模态层正确管理焦点、Escape、背景 inert 和恢复焦点。
- 文件类型、任务状态和进度不能只用图标表示。

## 8. Demo 验收画面

Phase 1 至少覆盖：

1. 空桌面与首次引导。
2. 已配置网址 App 的日常桌面。
3. Files 的网格/列表、拖入和权限说明。
4. Image/Media/PDF/Archive 的参数页与 mock 结果页。
5. Task Center 的运行、取消、失败和成功状态。
6. Wide 与 Regular 两种布局。
7. 深浅主题、减少透明度、减少动态、键盘焦点。

主观“像 macOS/iPadOS”不作为验收标准；验收的是层级、流动性、触控友好、原创性、可读性与完整任务体验。
