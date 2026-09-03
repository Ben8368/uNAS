# 架构经验

- A-001：UI → Task API → Planner → Worker → Adapter 是固定依赖方向；为赶进度从组件直连引擎会迅速制造不可测试耦合。
- A-002：WebCodecs 只提供编解码原语，容器 demux/mux、codec profile 和浏览器支持仍需独立探测与实现。
- A-003：统一 Job 模型先定义状态、取消、进度、错误和清理，再接入具体格式；不要让每个引擎发明自己的生命周期。
- A-004：Native Helper 是同一 Engine Contract 的新 adapter，不应让 UI 或任务模型出现第二套语义。
- A-005：公开契约只表达跨模块稳定事实；引擎私有参数、临时路径和实现细节不得泄漏到 UI 状态。
