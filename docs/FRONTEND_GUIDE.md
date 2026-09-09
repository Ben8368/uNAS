# 前端实现指南

本文只规定 UI 的工程接入、mock 与真实 adapter 边界；当前实现状态见 [CONTEXT](../CONTEXT.md)，固定视觉和交互规则见 [DESIGN_SYSTEM](DESIGN_SYSTEM.md)，验证门禁见 [QUALITY](QUALITY.md)。

## 1. 开工路径

1. 从 Design System 选定页面骨架、UI 编号、公共组件和 token；列出本次涉及的状态及例外，不另建 App 私有规范。
2. 涉及 App 注册、Intent、启动、权限或生命周期时读 [APP_CONTRACT](APP_CONTRACT.md)；涉及任务语义再读 [ENGINE_CONTRACT](ENGINE_CONTRACT.md)，纯样式调整不预读全部契约。
3. 源码改动遵循 [AI_RULES](AI_RULES.md) 与 [ARCHITECTURE](ARCHITECTURE.md)；实际调用浏览器/文件能力时按 AGENTS 路由读取安全规则。
4. 完成后按 Quality 第 5 节给出受影响范围内的视觉、行为及降级证据；改共享 token/组件需检查消费方，不只看当前页面。

## 2. 技术与样式归属

- React + TypeScript strict；Vite 用于本地 Demo，WXT 承载 MV3。精确版本以 [package.json](../apps/extension/package.json) 和锁文件为准，不在本文复制版本或权限清单。
- CSS Custom Properties 承载语义 token，现有共享窗口主题入口是 [window-theme.css](../apps/extension/src/styles/window-theme.css)；[globals.css](../apps/extension/src/styles/globals.css) 组织样式，src/styles/ 按职责拆分，不使用 CSS Modules。
- Zustand 管理本地 UI 状态，Lucide React 提供统一图标。布局/样式/状态优先复用现有公开组件，不引入另一套设计库或私有主题。
- token 值按 Design System 映射；兼容别名只能引用同一语义源。App 私有样式只处理领域布局，不覆盖主题、玻璃材料、窗口壳与基础控件状态。
- 原生 Dialog/Popover、容器查询与动效迁移遵循 [ADR 0008](ADR/0008-private-preview-modern-chrome.md)；平台 API 不自动提供完整的键盘、焦点、定位或可访问性验收。

### 共享窗口与内容布局

以下是实现目标，不是已存在的组件 API；复用现有入口，禁止并行建设另一套 Window。

| 归属 | 复用边界 |
| --- | --- |
| AppWindow / DesktopWindow | 共用加载/错误边界、标题栏、窗口控制、拖动缩放和焦点；只接收通用元数据、内容和可选 headerStatus |
| appPresentation / windowStore / windowGeometry | 单一尺寸预设、实例状态与可视区约束；不按 App 复制默认值，CSS 与几何计算必须对齐 |
| AppLayout（待抽取） | 组合 sidebar、navigation、actions、filters、notice、content、inspector、footer 槽位；拥有网格、间距、收缩及滚动规则 |
| 公共控件 | 复用 Toolbar、SearchField、FilterBar、EmptyState、StatusBar、Button 等；侧栏优先复用 ResizableAppSidebar |
| App 业务层 | 提供槽位内容和回调；文件授权、任务订阅、字段校验留在各自 controller/port，不进入通用布局 |

Files 的接入参照为 [LocalDirectoryPane](../apps/extension/src/apps/file-manager/LocalDirectoryPane.tsx)，不是旧 MockFileManagerPane。先在原页面提取公共布局，再由其他 App 消费；不得让其他 App import 文件管理私有组件或复制 fm-* CSS。

[Window.tsx](../apps/extension/src/Window.tsx) 中按 appType 选择的写入模式/色域状态应由 App 集成层通过 headerStatus 注入；公共壳不直接订阅文件 port，不因新增 App 增加业务分支。槽位使用组合而非大量布尔开关；搜索、筛选或 footer 缺省时由布局统一收起。视觉参数只查 Design System UI-03。

## 3. 层次与 Surface

| 层 | 职责 |
| --- | --- |
| entrypoints | newtab/workspace 共用 bootstrap；background 处理受限入口与消息校验 |
| Desktop / App Host | 启动、窗口、焦点和布局；内置 App 在当前标签页打开 |
| App View | 组合公开组件、展示 projection、提交用户意图 |
| application port | App、Files、Tasks、Settings 的稳定用例 |
| adapter / Worker | mock 或真实能力、浏览器授权、存储与计算隔离 |

New Tab 保持轻量，App 与 engine chunk 按需加载；逻辑 Workspace 的任务所有权和多页连接按 [ADR 0007](ADR/0007-inline-app-workspace.md) 执行。service-worker 不承担 DOM 或长计算；content-script/offscreen 的适用边界由 Architecture 定义，不从 UI 需求推导新权限。

## 4. Mock 与真实能力

- 每项能力明确来源，不能用“所有功能都是 mock”覆盖已接入的真实路径，也不能用一个真实 adapter 推断整款 App 已具备真实处理能力；已验证范围只查 Context 与对应 benchmark。
- mock scenario 使用固定 ID、fixture metadata 与测试时钟，不读取用户文件，不用随机延时，不生成可误认的真实输出。真实目录/文件交互必须经对应 adapter 和授权路径。
- UI 展示来源、能力可用性、原因及限制；不得硬编码浏览器/格式支持表。演示标记的位置与文案遵循 Design System。
- 确定性场景覆盖空数据、首次引导、成功、权限拒绝、损坏、资源超限、已知/未知进度、取消、失败、恢复和 owner 冲突；实际只加载本次相关场景。
- mock 与真实 adapter 使用同一 port/contract，mock 长期保留用于状态、视觉与失败路径回归；真实替换仍需夹具及目标扩展证据。

## 5. 状态与资源

- Desktop state 只保存布局、焦点和主题；Registry 保存内置 manifest 与 Link 配置；File/Task projection 只保留 UI 必要摘要，不持有引擎对象或大型 Blob。
- 能力、授权、任务终态由对应服务提供；关闭窗口与取消任务分别发出意图，不能由组件自行推断运行时结果。
- New Tab 首屏不依赖网络，不包含大型 engine/WASM；图标、壁纸、预览有资源预算，大面积效果的性能结论须实测。
- 存储、句柄恢复、授权、清理与上传边界由架构/安全契约维护；App View 不直接触碰特权 API 或文件系统。

## 6. 变更交付

交付说明只列：适用 UI 编号、受影响组件/页面、mock 或真实来源、验证命令与证据、未覆盖项/例外。响应式阈值和验收矩阵只链接 Design System / Quality，不在工作包或页面文档重复。

既有界面不因规范发布自动达标；实现时检查相关样式的最终级联，包括 [accessibility.css](../apps/extension/src/styles/accessibility.css) 对材料和布局的覆盖。受影响部分按本规范修正，无关实现差异不在本指南维护清单。
