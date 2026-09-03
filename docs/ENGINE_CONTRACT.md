# 统一任务与引擎契约

> 本文定义扩展内部跨 App、Workspace、Worker 与 adapter 的稳定语义，不是最终 TypeScript 源码。实现开始后，代码事实源位于 `packages/contracts`，本文保留兼容规则和意图。

## 1. 目标

- 所有 Tool App 使用同一种任务生命周期，UI 不感知具体引擎库。
- 前端 Demo 和真实运行时共享状态、进度、错误与 App 流程，但 mock 不能成为能力证据。
- 输入验证、能力探测、资源预算、取消、输出提交和清理由 runtime 统一治理。
- 未来新增 adapter 不产生第二套任务或 UI 语义。

## 2. 概念模型

```ts
type EngineKind = 'image' | 'media' | 'archive' | 'pdf'
type ExecutionSource = 'mock' | 'real'
type TaskStatus =
  | 'draft'
  | 'validating'
  | 'queued'
  | 'running'
  | 'cancelling'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

interface FileRef {
  id: string
  name: string
  size: number
  declaredType?: string
  source: 'picker' | 'handle' | 'opfs' | 'mock'
  authorization: 'available' | 'requires-user' | 'expired' | 'not-applicable'
}

interface TaskSpec {
  schemaVersion: 1
  id: string
  engine: EngineKind
  operation: string
  inputs: FileRef[]
  options: Record<string, unknown>
  output: { mode: 'download' | 'file-handle' | 'directory-handle' | 'opfs' }
}

interface TaskEnvelope {
  spec: TaskSpec
  executionSource: ExecutionSource
  ownerId: string
}

interface CapabilityReport {
  supported: boolean
  route?: 'native-web' | 'wasm'
  reasons: string[]
  limits: Record<string, number | string | boolean>
  evidence: Record<string, string | number | boolean>
  checkedAt: string
}

interface ExecutionPlan {
  taskId: string
  adapterId: string
  estimatedResources: Record<string, number>
  checkpoints: string[]
  fallbacks: string[]
}
```

- 每个 `operation` 有独立共享 schema；未知 option 不静默忽略。
- 引擎临时路径、WASM 内部文件名和命令参数不进入公开 `TaskSpec`。
- `ownerId` 绑定 Workspace 任务所有权，New Tab Client 只能查询 projection 或发送命令。
- Mock 使用 `source: mock` 与 `executionSource: mock`，不能被持久化为真实 FileRef 或能力报告。

## 3. 状态转换

| 当前状态 | 允许的下一状态 |
| --- | --- |
| `draft` | `validating`、`cancelled` |
| `validating` | `queued`、`failed`、`cancelled` |
| `queued` | `running`、`cancelled` |
| `running` | `succeeded`、`failed`、`cancelling` |
| `cancelling` | `cancelled`、`succeeded`、`failed` |
| 终态 | 无 |

约束：

- 终态只有 `succeeded`、`failed`、`cancelled`。
- `succeeded` 必须满足引擎完成、输出验证和导出/持久化提交全部完成。
- 取消是请求；若提交已不可逆完成，`cancelling` 可以进入 `succeeded` 并说明取消到达过晚。
- 页面关闭、owner lease 丢失、Worker 崩溃或扩展更新不伪装为 `cancelled`；无法恢复时进入结构化失败。
- V1 不自动重试重计算任务；重试需新 task ID 或明确 attempt 模型，并先证明幂等与提交语义。

## 4. 进度

```ts
interface TaskProgress {
  phase: 'read' | 'inspect' | 'process' | 'encode' | 'package' | 'validate' | 'export'
  completed?: number
  total?: number
  unit?: 'bytes' | 'frames' | 'pages' | 'entries' | 'items'
  determinate: boolean
  message: string
}
```

- 同一 phase 的确定进度不得倒退；切换 phase 不拼成虚假线性百分比。
- 无法测量时使用 `determinate: false`，不得用计时器制造进度。
- 高频事件在 Worker/Application 层节流；New Tab projection 可以进一步降频。
- Mock 进度由可控时钟驱动，但仍遵守真实状态机。

## 5. 错误分类

```ts
type ErrorCategory =
  | 'invalid-input'
  | 'unsupported'
  | 'permission-denied'
  | 'quota-exceeded'
  | 'resource-limit'
  | 'owner-lost'
  | 'engine-load-failed'
  | 'processing-failed'
  | 'output-invalid'
  | 'export-failed'
  | 'cancelled'
  | 'internal'
```

公开错误包含稳定 `code`、`category`、用户可读 `message`、可选安全详情、`retryable` 和建议动作。堆栈、绝对路径、敏感文件名、浏览数据和引擎命令不进入跨上下文消息或用户遥测。

## 6. 输出提交协议

```text
execute
  → prepared outputs（临时、不可见）
  → validate signature/metadata/content budget
  → commit/export
  → succeeded
  → cleanup temporary resources
```

- adapter 不直接把未验证结果暴露为最终 FileRef。
- commit 前取消：rollback prepared outputs，最终 `cancelled` 或 `failed`。
- commit 中失败：最终 `failed`，保留可解释的部分结果信息，但不标记成功。
- commit 后取消：任务可成功，UI 明确说明取消未生效。
- cleanup 只删除临时资源和未提交输出；已提交用户文件不属于清理范围。
- 覆盖默认禁止；显式替换必须有临时文件/原子提交或安全回退方案。

## 7. Adapter 接口

概念接口：

```ts
interface EngineAdapter {
  readonly id: string
  readonly engine: EngineKind
  probe(spec: TaskSpec): Promise<CapabilityReport>
  plan(spec: TaskSpec, capability: CapabilityReport): Promise<ExecutionPlan>
  execute(
    plan: ExecutionPlan,
    context: ExecutionContext
  ): Promise<{ prepared: PreparedOutput[]; metadata: Record<string, unknown> }>
  validate(prepared: PreparedOutput[]): Promise<OutputValidation>
  commit(prepared: PreparedOutput[], target: TaskSpec['output']): Promise<FileRef[]>
  cleanup(plan: ExecutionPlan, prepared: PreparedOutput[]): Promise<void>
}
```

- `probe` 不写用户文件或做长时重计算。
- `plan` 可重复、可测试，不持有 UI 对象。
- `execute` 只消费已验证 plan，响应 AbortSignal，并登记资源 lease。
- `validate` 和 `commit` 与计算分离，便于测试无效输出和导出失败。
- `cleanup` 幂等，在所有终态尝试执行；失败进入结构化诊断但不改变已验证的用户文件。

## 8. 路由与 fallback

| 情形 | 选择 |
| --- | --- |
| 浏览器原生 API 完整覆盖且证据通过 | `native-web` |
| 原生不足、WASM 在预算内且输出可验证 | `wasm` |
| 没有安全、正确、已验证路径 | `unsupported` |

不存在失败后无条件换引擎。Fallback 必须来自 `ExecutionPlan`，且输入仍有效、未提交输出已回滚、资源已释放、错误符合允许降级的分类。

## 9. 批任务

- 批任务由稳定 parent ID 和独立 child task 组成；每个 child 有自己的终态、输出和清理。
- Parent 只提供聚合视图，不覆盖 child 事实。
- 全部成功才显示批次成功；混合终态显示“已完成但有错误”，该文案是聚合视图，不新增 TaskStatus。
- Parent 取消向未终态 child 发出取消请求；已提交 child 保持成功。
- 批量导出在所有选定 child 输出通过验证后单独提交。

## 10. Demo Contract

- `MockEngineAdapter` 只存在于 Demo/test runtime，不能进入发布能力矩阵。
- Mock scenario 必须覆盖成功、失败、取消、权限、资源限制和 owner 丢失。
- Mock 的 `succeeded` 表示 scenario 状态完成，不生成真实媒体、PDF 或 ZIP。
- UI 在任务详情、About/Build Info 和演示材料中显示 execution source。
- Real adapter 替换必须通过同一 contract tests，并新增真实夹具与扩展 E2E。

## 11. 兼容与演进

- Task、App Intent 和跨扩展上下文消息均带 `schemaVersion`。
- 破坏性变化新增版本、迁移层和 contract tests，不静默解释旧 payload。
- 持久化只保存恢复所需的最小元数据；句柄可恢复性由浏览器实测。
- 契约变化同步 App Contract、Product 能力表、ADR、风险和相关验收。
