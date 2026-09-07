# ADR 0007：同标签页 App 与逻辑 Workspace

- 状态：已接受
- 日期：2026-09-07
- 依据：维护者要求修复内置 App 分裂到不同标签页的交互。
- 关系：替代 ADR 0005 中 Tool App 进入另一 Workspace 页面的启动策略；扩展原生、本地优先和 Worker 边界保持不变。

## 决策

- 内置 App 窗口在当前标签页打开，保持已有窗口与表单；仅声明式 HTTPS Link App 打开外部网页。
- Workspace 是任务所有权与应用服务边界，不等于新建可见标签页。保留 `workspace.html` 兼容入口，但启动器不自动创建或聚焦它。
- Phase 1 仍只执行 mock：首次使用 Files/Downloader 的页面按需建立逻辑 Workspace，Web Lock 保证单一 owner；其他同源页面经 BroadcastChannel 请求 owner，UI 不直接持有真实文件、引擎或特权 API。
- 通信使用版本化消息、方法/参数白名单、owner/request ID、大小与并发上限、超时和去重。场景重置/推进仅由 owner 控制，不自动重放未确认写操作。
- 关闭普通客户端不终止 owner；关闭 owner 中断模拟任务并通知客户端。异常退出通过连接超时降级，禁止失联假成功与自动接管旧任务。
- 不新增权限、上传、Offscreen 或 Service Worker 长计算。真实任务生命周期仍需 RISK-003 探针，本轮不宣称真实长任务支持。

## 后果与替代方案

- 内置 App 不再分裂到不同标签页；懒加载保留，打开 New Tab 本身不取得任务所有权。
- owner 关闭后模拟文件与任务不能恢复；客户端显示中断，需要刷新后重新开始。BroadcastChannel 来源隔离由同源机制提供，扩展不向网页/content script 暴露通道。
- 拒绝仅删除路由检查而让每页各执行一份 mock；拒绝偷偷创建后台 Workspace 或把 Service Worker 当常驻引擎。

## 关联

- [ARCHITECTURE](../ARCHITECTURE.md)、[APP_CONTRACT](../APP_CONTRACT.md)、[SECURITY](../../SECURITY.md)
