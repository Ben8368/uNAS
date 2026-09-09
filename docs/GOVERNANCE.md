# 治理文档维护规则

## 目标

治理文档要让执行者快速获得正确边界、当前事实和下一步，而不是把历史、计划、命令和复盘复制到每个入口。原则是：**单一事实源、按需加载、证据分级、预算可检查、历史可归档**。

## 单一事实源

| 事实 | 唯一权威位置 | 不应重复的位置 |
| --- | --- | --- |
| AI 入口、硬边界、读取路由 | `AGENTS.md` | 工具摘要、专题文档 |
| 当前阶段、决策、三项优先级、最近验证 | `CONTEXT.md` | Roadmap、提交记录 |
| 可复发经验的索引与详情 | `LESSONS.md`、`docs/lessons/*` | Context、技术债 |
| 产品目标、用户、V1 范围、非目标 | `docs/PRODUCT.md` | Roadmap、README 展开内容 |
| 前端工程接入、组件复用、mock/真实边界 | `docs/FRONTEND_GUIDE.md` | Product、组件注释 |
| UI 基线、token 值、页面骨架、组件行为 | `docs/DESIGN_SYSTEM.md` | 页面私有样式、Product |
| App 类型、manifest、Intent、权限与生命周期 | `docs/APP_CONTRACT.md` | Desktop store、Tool App 私有文档 |
| 长期分层、依赖方向、运行时边界 | `docs/ARCHITECTURE.md` | 开发蓝图、组件说明 |
| Job / Engine 公共语义 | `docs/ENGINE_CONTRACT.md` | UI 或某个 adapter 私有文档 |
| 阶段结果与进入/退出门禁 | `docs/ROADMAP.md` | Context 中的展开计划 |
| 工作包、顺序、验收清单 | `docs/DEVELOPMENT_BLUEPRINT.md` | Roadmap、Context |
| 测试策略、UI 验收证据、质量门禁、完成定义 | `docs/QUALITY.md` | PR 描述模板 |
| 未验证假设与外部风险 | `docs/RISK_REGISTER.md` | 技术债、Context 详情 |
| 已产生的实现妥协 | `docs/TECH_DEBT.md` | 风险台账、Roadmap |
| 长期决策及理由 | `docs/ADR/*` | 状态卡、提交信息 |
| 历史状态、已关闭风险、长复盘 | `docs/archive/` 与 Git 历史 | 强制加载文件 |

`CONTEXT.md` 是当前状态摘要；探针、真机和基准的细颗粒度覆盖矩阵由对应 `benchmarks/<probe>/README.md` 维护。两者不一致时，以带环境、步骤和结论的探针记录为准，并在同一次改动中修正 Context 摘要与风险状态。

## 状态词

文档只使用下列能力状态，避免“支持”“完成”含义漂移：

- **设计中**：存在方案，没有实现。
- **计划**：已进入 Roadmap，但尚未开始。
- **已实现未验证**：代码存在，目标环境证据不足。
- **已验证**：通过约定的自动化或真实路径验收，并记录证据。
- **不支持**：明确拒绝或不在当前范围。

“候选技术”不等于“依赖已选择”，“构建通过”不等于“能力已验证”，“库声称支持”不等于“产品承诺支持”。

## 强制加载预算

下列文件会被频繁读取，由 `node scripts/governance-docs-check.mjs` 同时检查行数和字符数：

| 文件 | 最大行数 | 最大字符数 | 允许内容 |
| --- | ---: | ---: | --- |
| `AGENTS.md` | 85 | 5,200 | 路由、硬边界、执行入口 |
| `CONTEXT.md` | 45 | 3,000 | 当前事实、三项优先级、最近验证 |
| `LESSONS.md` | 20 | 1,800 | 任务标签到经验详情的路由 |
| `CLAUDE.md` / `.cursorrules` | 12 | 800 | 指向 `AGENTS.md` 的摘要 |

超预算时先拆分或归档，不允许单纯提高预算。

## 专题读取与预算

- 按实际修改/审查对象选路由，只读命中章节；不因文件互相链接而递归加载。审查全局治理时可扩大范围，普通 UI 调整不默认加载产品计划、引擎或全部 ADR。
- 规则放 Design System，工程接入放 Frontend Guide，证据门禁放 Quality；工作包只引用规则，不抄 token/状态矩阵。纯视觉方案不新增 ADR，也不为每个 App 新增规范文档。
- 下列专题预算由文档评审人工核对行数与字符数，**现有 checker 不自动检查**；超出时先去重或归档，不以堆长行规避预算。确需拆分的细节必须有任务路由，不进入强制加载面。

| 文件 | 最大行数 | 最大字符数 |
| --- | ---: | ---: |
| Design System | 140 | 7,000 |
| Frontend Guide | 90 | 4,000 |
| Quality | 160 | 6,500 |
| Governance | 110 | 4,000 |

## 更新触发器

1. 先判断事实属于哪个权威文档，只更新一处，其他位置只放链接或一句稳定摘要；探针状态的细节只写对应 benchmark。
2. `CONTEXT.md` 仅在阶段、当前阻断、前三优先级或最近验证结论变化时更新；每条“最近验证”必须链接其证据，优先级提到探针时必须链接对应 benchmark。
3. 更新 probe、风险或验收结论前，反向检索 `CONTEXT.md`、关联 `benchmarks/` 与 `RISK_REGISTER` 的已验证/未验证状态；冲突必须在提交前消除。
4. 产品范围变化更新 `PRODUCT`；阶段顺序或门禁变化更新 `ROADMAP`；具体工作拆分变化更新 `DEVELOPMENT_BLUEPRINT`。
5. 尚未验证的外部不确定性进入 `RISK_REGISTER`；代码已经产生且未来需偿还的妥协进入 `TECH_DEBT`，二者不得混用。
6. 影响长期边界、公开契约、数据流、权限、供应链或技术栈的决定新增 ADR；被替代时保留原文并标记替代关系。
7. 关闭的风险、已偿债条目、旧 Context 和长复盘按日期移入 `docs/archive/`。
8. 新增 lesson 只记录可复发且会改变后续行动的结论，不记录一次性事件流水账。
9. UI 公共基线变化只改 Design System 的版本/日期与规则；按 Quality 第 5 节验收。实现顺序只在 Blueprint 记录；规则发布不等于能力完成，不为发布规范刷新 Context 或重开历史 Gate。

## 变更验收

治理文档改动后必须：

1. 运行 `node scripts/governance-docs-check.mjs`。
2. 人工确认链接指向权威文档，没有把设计写成实现，没有把未测结论写成已验证；探针摘要与其 benchmark、风险状态不矛盾。
3. 确认 Context 仍只有三项可执行优先级，风险和技术债没有互相复制。
4. 核对本次涉及专题的人工预算；checker 只能验证结构、部分状态和链接，不能验证事实一致性或视觉实现。
5. 若改变产品、架构、安全或阶段边界，确认对应 ADR / Product / Roadmap 已同步。

产品源码引入后，完整验证入口统一为 `pnpm verify`；文档检查始终是其中第一道门禁。
