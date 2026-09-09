# 视觉与交互设计系统

本文是 uNAS UI 的唯一规范：视觉值、页面骨架、组件状态和输入行为以本文为准。适用于 Desktop、System/Tool App 与 Link App 管理界面。实现方式见 [FRONTEND_GUIDE](FRONTEND_GUIDE.md)，验收见 [QUALITY](QUALITY.md)。

**基线 UI v1.1 · 2026-09-09**：本轮固定的设计目标；新增和改动 UI 必须遵循，存量界面按受影响范围对齐。这不是已实现或已验证声明，不追认旧截图达标，也不要求无关页面同步重做。

## UI-01 视觉方向与材料

采用原创、克制的桌面语言：中性内容面、蓝色主操作、清晰层级，玻璃仅用于导航和临时控制。借鉴 [Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials) 的原则；禁止复制 Apple 图标、壁纸、字体文件或逐像素布局。

| 层 | 用途 | 固定规则 |
| --- | --- | --- |
| 背景 | 壁纸与环境色 | 不承载正文；无持续漂浮、视差或自动轮播 |
| 内容 | 文件、参数、表格、预览、正文 | 使用不透明 content/raised 表面，不随壁纸改变文字色 |
| 控制 | Dock、窗口标题栏、导航 | 一层 navigation glass；窗口根与内部工具栏不得叠加 blur |
| 临时层 | 菜单、Popover、Dialog、Sheet、Toast | overlay 表面；长表单及正文仍用实色 |

仅透明度、边缘高光和静态阴影表现材料，不做实时折射或鼠标追光。不在内容卡片嵌套玻璃。壁纸不可读时改用实色表面，不靠加重文字阴影补救。

## UI-02 语义 Token

以下是设计名和目标值，长度单位为 CSS px；不是已存在的 CSS API。实现沿用共享变量入口并统一映射；已有 window-* 语义变量可复用，不为同一语义新建第二套变量。App 不得私设主题值。

| 颜色 Token | Light | Dark | 用途 |
| --- | --- | --- | --- |
| color.background | #EFF1F3 | #1B1D20 | 壁纸回退、侧栏 |
| color.content | #F8F9FA | #202225 | 正文主面 |
| color.raised | #FFFFFF | #282B2F | 浮层、抬升面 |
| color.control | #E7EAEE | #34383E | 控件底色 |
| color.text | #24282E | #F1F3F5 | 正文 |
| color.muted | #5B6470 | #B0B6BE | 次要说明，不用透明度再淡化 |
| color.divider | #DCE0E5 | #373B41 | 装饰分隔线 |
| color.border | #7B8490 | #87919D | 输入框等必要识别边界 |
| color.primary / on-primary | #2467CD / #FFFFFF | #2467CD / #FFFFFF | 主按钮 |
| color.accent | #185EB3 | #81BDFF | 链接、选中标识 |
| color.danger | #B32332 | #FF9999 | 错误、危险操作 |
| color.warning | #835500 | #F2C66D | 警告 |
| color.success | #21643E | #85D6A5 | 成功 |
| color.focus | #165DAB | #B6DCFF | 键盘焦点 |

状态色配图标与文字，默认放在 content/raised 上；不把状态文字色直接当按钮底色。选中使用 control 底色 + accent 边标/勾选，不只换颜色。主按钮 hover/pressed 用 8%/16% 黑色遮罩；中性控件用 text 色 4%/8% 覆层；焦点环始终保留。

| Token 组 | 固定值与使用方式 |
| --- | --- |
| space.1…8 | 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48；控件内距 8–12，组内 12，区块 24 |
| type | system-ui, 'Microsoft YaHei', sans-serif；caption 12/18、body 14/22、section 16/24、title 20/28（字号/行高）；字重 400/500/600 |
| icon | Lucide 矢量体系，24 视盒、stroke 2；列表 16、控件 20、空态 32；独立图标必须有可访问名称 |
| size | 常规控件高 36；紧凑列表行最小 40；表格行最小 44；coarse pointer 命中区至少 44×44；不得重叠 |
| radius | control 8、panel/menu 12、window 20、dialog 16；胶囊仅用于状态标记，不作为通用卡片 |
| border / focus | 边框 1；焦点环 3、外偏移 2；禁止只用阴影表示焦点 |
| material.navigation | Light rgba(248,250,253,.88)，Dark rgba(27,29,32,.88)；blur 16、saturate 110% |
| material.overlay | Light rgba(255,255,255,.96)，Dark rgba(40,43,47,.96)；blur 12 |
| shadow | window：0 16px 48px rgba(0,0,0,.20/.40)；floating：0 8px 24px rgba(0,0,0,.16/.32)（Light/Dark） |
| motion | fast 120ms、normal 180ms、slow 240ms；ease-out；仅 transform/opacity，不动画 blur |
| layer | desktop 0、window 100–199（聚焦排序）、shell 200、drawer 300、popover 400、modal 500、toast 600；原生 top layer 按打开顺序管理 |

浅色/深色/跟随系统为主题选项。减少透明度或 blur 不可用时，导航用 background、浮层用 raised 的实色；高对比用实色、明确边界，forced-colors 尊重系统色。减少动态时取消位移、缩放、弹性与非必要过渡，进度仍可读。降级效果须由用户设置或已验证的检测触发，不宣称尚未实测的自动性能判断。

## UI-03 页面骨架与密度

以当前文件管理的外框比例与“导航/操作 → 搜索筛选 → 提示 → 主内容 → 底部摘要”为共同母版。只吸收布局语言，不把文件操作或现有样式缺陷推广到其他 App；UI v1.1 将上一版窗口目标校准到该参照。

所有内置 App 使用同一 WindowFrame：左侧图标/名称，中间可选状态，右侧最小化/最大化/关闭；标题栏高 50、水平内距 16、标题字号 14。工具栏最小 44；内容内距上/左右/下为 22/24/16，区域间距 14；多行内容可增高。侧栏默认 200（可调 160–360），Inspector 280。一个区域只设一个主操作，危险操作分开。

| Surface | 固定结构与行为 |
| --- | --- |
| Desktop | 左侧 Dock 宽 64，画布与窗口安全边距 20；搜索/启动器一个主入口；App 单元宽 92、图标 48、间距 16、名称最多两行并可查看全名；不堆业务统计卡片 |
| Window | 所有 App 在 Wide 初始 960×640、最小 760×520，最终尺寸受安全区约束；最大化保留边距；标题和恢复入口始终可达；关闭 UI 不暗示取消任务 |
| 状态抽屉 | Wide 从右侧展开，宽 320，遮罩外点击或 Escape 收起；显示任务摘要和进入详情入口，不常驻占用画布；Regular/Compact 改 Sheet |
| Files | 目录/操作 → 搜索排序 → 授权提示 → 文件列表 → 数量摘要；可选网格/详情；空目录与未授权分别呈现 |
| Tool App | 输入 → 参数 → 检查与执行 → 进度 → 结果与导出；输入/预览为主区，参数为次区；窄容器按该顺序纵排，不因工具不同重建导航 |
| Task Center | 状态筛选 → 任务列表 → 任务详情；行内保留名称、状态、进度/阶段及可用操作；抽屉与详情读取同一任务语义 |
| Settings / Link 管理 | 分类导航 → 标题说明 → 分组表单；内容最大宽 760；添加/编辑用同一表单，错误贴近字段 |

公共内容布局固定为可选 sidebar + 主列 + 可选 inspector；主列顺序为 navigation/actions、filters、notice、content、footer。无内容的槽位不渲染、不留空白；没有侧栏的 App 主列占满窗口。业务操作不能挤入系统窗口按钮区。

App 只改变图标/名称、导航项、筛选字段、业务内容、状态与操作，不私改窗口默认尺寸、标题栏、外框、通用控件或区域间距。用户手动缩放是同一套规则内的实例状态，不强制所有已打开窗口同步尺寸。Link App 的外部网页不受此窗口规范约束。

内容区负责主滚动，标题和关键操作保持可达；列表/预览允许独立滚动，禁止无必要的多层滚动。长文件名保留扩展名并提供全名查看入口；关键错误和主操作不得省略。

## UI-04 响应式

阈值是布局规则，不是设备或浏览器支持声明。Desktop 按 viewport，App 内部按自己的可用容器宽度判断；即使桌面很宽，小窗口也必须折叠。

| 模式 | 可用宽度 | 行为 |
| --- | --- | --- |
| Wide | ≥1100 | 桌面多窗口；App 可并排内容、参数与侧栏 |
| Regular | 700–1099 | 单主窗口充满安全区；默认收起 Inspector/次要侧栏；保留左侧启动入口 |
| Compact | <700 | 全屏 App；侧栏与参数按需 Sheet/纵排；Dock 改底部 56 高；内容内距 16 |

高度不足以容纳 Window 最小尺寸时也切满可用区，最小尺寸不能阻止收缩。主操作换行或进入可见操作区；仅二维表格/画布可局部横向滚动，页面不得整体横溢。布局变化保持选中项、参数和任务状态，不能通过重建 App 丢失输入。

## UI-05 组件与状态

依赖顺序固定为 Token → Primitive → System Component → Desktop/File Pattern → App View。复用 Button、Field、Progress、Dialog、Sheet、Menu、Toast、EmptyState、WindowFrame、FileList 等公开组件，不在 App 内复制私有版本；新增变体先确认无法用现有组合表达。

| 组件/状态 | 必须呈现的行为 |
| --- | --- |
| Button / IconButton | default、hover、pressed、focus-visible、disabled、loading；主要/次要/危险三种语义；loading 保持宽度、阻止重复提交并有文字状态 |
| Field / Select | 可见 label、帮助、错误、禁用/只读；placeholder 不代替 label；错误关联字段且不清除输入 |
| 文件行 / 卡片 | hover、focus、selected、unavailable；鼠标与键盘都能打开；选择与打开动作分明，不依赖双击或拖动作为唯一入口 |
| 加载 / 空态 | 加载有文本或 skeleton，不展示假数据；空态说明原因和一个下一步；未授权显示授权入口，不冒充空目录 |
| 错误 / 能力缺失 | 说明发生什么、保留了什么、如何恢复；不可用操作给出原因；重试只在可重试时出现 |
| Progress / Task | 已知进度显示真实值，未知时显示阶段；排队、运行、取消中、已取消、失败、成功明确区分；准确终态由运行时提供 |
| 结果 / Export | 处理结果与保存结果分别反馈；没有真实输出不出现可误认的下载；导出失败保留可恢复结果，不假报保存成功 |
| Dialog / Sheet | 只用于需要聚焦完成的操作；模态焦点约束、背景 inert、Escape 与焦点恢复完整；有未保存输入先确认放弃，不嵌套第二层模态 |
| Menu / Popover / Tooltip | 短时上下文操作，非主导航；贴近触发点、避开视口边缘；Escape 关闭并恢复焦点；tooltip 不是关键信息唯一载体 |
| Toast / 行内反馈 | Toast 用于非阻断回执，默认 5 秒且 hover/focus 暂停；需要行动或持续失败用行内反馈/任务详情；不靠消失提示保留错误 |

## UI-06 输入、文案与可访问性

- 目标 WCAG 2.2 AA：正文对比度 ≥4.5:1，大字与必要图标/控件边界 ≥3:1；在实际主题、壁纸和交互态上验证，token 值不等于验收证据。
- Tab 按视觉任务顺序移动；Enter/Space 激活，Escape 关闭最上层临时 UI；菜单用方向键。App 启动聚焦标题或首个主操作，关闭后返回启动入口。浏览器保留快捷键不被覆盖。
- 拖放、窗口拖动均有按钮/菜单替代路径；触控可完成主要任务；hover 不承载唯一操作。对话框内 Toast 不得成为焦点约束外的必需操作。
- 中文为默认文案，动作使用“选择文件 / 开始处理 / 取消任务 / 导出”等动宾词；避免仅写“确定”、内部错误码或引擎术语。危险确认写明对象、影响及是否可恢复。
- mock 的输入、进度、结果处保留“演示数据/能力未接入”标记，不能只藏在 About；真实能力按各自来源显示，任务成功不等于导出成功。
- 200% 浏览器缩放、长文本和键盘路径必须可用；状态使用可访问名称/适度 live region 通知，不按每个进度 tick 打断读屏。

## UI-07 执行与变更

- 开工先引用本文件版本与适用 UI 编号，列出受影响页面、公共组件与状态；只写差异，不复制规范全文。新功能必须落入 UI-03 的骨架。
- 固定值是默认约束。需要例外时，在本次任务/PR 记录“规则编号、原因、影响、替代、验收”；未获维护者接受不得把例外作为新公共基线。纯视觉选择不要求另写 ADR，长期边界变更按 [GOVERNANCE](GOVERNANCE.md)。
- 普通修正直接更新本文并在变更说明交代影响；改变公共 token、页面骨架或组件行为时更新基线版本/日期，执行拆分只放 [DEVELOPMENT_BLUEPRINT](DEVELOPMENT_BLUEPRINT.md)，不在本文维护迁移进度。
- 完成条件与截图/状态证据统一见 [QUALITY](QUALITY.md) 第 5 节；文档检查通过只证明治理结构通过，不能证明 UI 已遵循规范。
