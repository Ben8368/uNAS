# ADR 0003：统一 Job / Engine Contract 与 Worker 隔离

- 状态：已接受
- 日期：2026-09-03

## 背景

图片、媒体、ZIP 和 PDF 使用不同库，但都需要输入验证、能力探测、进度、取消、错误、导出和清理。若 UI 直接调用各库，每个模块会形成独立生命周期，Web 与 Extension 也无法复用。

## 决策

- 所有耗时操作表示为版本化 `TaskSpec` 和统一 Job 状态机。
- Capability Planner 根据运行时证据生成 `ExecutionPlan`，UI 不选择具体 adapter。
- 重计算在 Dedicated Worker；adapter 包装 Web API、JS 库、WASM 或未来 Native 能力。
- 公开契约只暴露稳定状态、进度、错误和文件引用；引擎临时路径、WASM FS 和命令参数保持私有。
- `succeeded` 只有在输出验证与提交完成后成立；所有终态执行幂等清理。
- V1 不自动重试重计算任务，除非未来 ADR 证明幂等和输出提交语义。

## 后果

好处：多个引擎共享可靠性与 UI，Extension 和未来 Native adapter 无需第二套模型。代价：首个垂直切片需要先建设 contract/core，简单按钮功能不能直接调用库。

## 替代方案

- 每个模块自建 hook/store：拒绝，状态和错误语义会分裂。
- 单个“万能 Worker”直接解析命令数组：拒绝，难以校验、测试和限制资源。

## 关联文档

- [ENGINE_CONTRACT.md](../ENGINE_CONTRACT.md)
- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [QUALITY.md](../QUALITY.md)
