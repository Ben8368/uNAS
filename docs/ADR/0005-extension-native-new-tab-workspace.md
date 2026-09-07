# ADR 0005：扩展原生的新标签页工作区

- 状态：已接受
- 日期：2026-09-03
- 启动策略修订：Tool App 的可见页面分流由 [ADR 0007](0007-inline-app-workspace.md) 替代；其余边界保留。

## 背景

产品目标已经从“独立 Web 工作台配套扩展入口”收敛为“以浏览器扩展交付的高级新标签页”。导航、桌面交互、本地文件工作区和内置处理工具属于同一产品；不再维护独立托管 Web 产品或传统桌面程序。

## 决策

- Manifest V3 扩展是唯一产品形态，首发目标浏览器为 Chrome。
- 当前通过 Chrome 解包扩展和本地安装验证交付，不把扩展商店上架作为 V1 门禁。
- New Tab 承载轻量 Desktop Shell、导航和 App 启动；重型工具按需打开或复用扩展内 Workspace 页面。
- Service Worker 只处理事件和消息，不作为长任务运行时；重计算进入 Workspace 的 Dedicated Worker。
- 内置 System/Tool App 随扩展打包；用户自定义 App 仅为声明式 HTTPS Link App，不嵌入远程页面、不执行远程代码。
- 本地文件只来自用户选择、拖放或明确授权；不提供任意磁盘扫描。
- V1 不提供独立 Web、PWA、Electron/Tauri、Native Helper、服务端处理或云同步。

## 后果

好处：产品入口统一、离线和隐私叙事清楚、导航与文件工具形成一个工作区。代价：受 MV3 生命周期、商店政策、扩展 CSP、浏览器文件权限和内存限制约束；页面关闭后的长任务不保证继续。

## 替代方案

- Web 为主、Extension 为入口：由本 ADR 替代，产品形态不符合当前目标。
- Chrome App 或传统桌面程序：拒绝，不是当前分发方向。
- 把所有处理放入 New Tab 实例：拒绝，多实例和频繁关闭会破坏任务所有权。

## 关联文档

- [PRODUCT.md](../PRODUCT.md)
- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [APP_CONTRACT.md](../APP_CONTRACT.md)
- [SECURITY.md](../../SECURITY.md)
