# ADR 0017：受控 FileRef、WebDAV 分段读取与交互式预览

- 状态：已接受
- 日期：2026-09-30
- 背景：[ADR 0014](0014-shared-webdav-transport.md) 的共享 WebDAV 客户端为小文件传输提供字节预算；[ADR 0015](0015-file-manager-dav-cache.md) 授权 Files 的单文件读取上限为 16 MiB。媒体、PDF 与通用预览需要独立的文件读取生命周期，但不能把特权、凭据或无界 Blob 交给 UI。

## 决策

- FileRef 是当前 Workspace Owner 文档内存中的不透明引用，只序列化稳定元数据和授权状态；FSA handle、WebDAV endpoint、凭据、OPFS 根目录和大型内容不进入 Desktop Store、BroadcastChannel、持久化或日志。引用绑定授权会话，断连、授权失效或 Owner 丢失即失效。
- UI 通过 application port 使用受限读取租约。FSA 路径通过已授权且当前目录已枚举的直接子项取得；WebDAV 仍由 ADR 0014 的 WebDavClient 负责授权、路径、重定向、请求取消与小请求安全边界，不建立第二个 WebDAV 客户端。
- 大文件的 WebDAV 读取只走独立 WebDavRangeReader：每个分段最多 512 KiB、按消费者拉取、每租约最多 1 GiB，必须验证 HTTP 206、Content-Range、长度、总文件大小和强 ETag；后续请求发送 If-Range。忽略 Range、416、ETag/长度变化或权限撤销时停止并给出错误，不退回整文件下载。没有强 ETag 的服务不能通过当前 Files 分段读取入口。
- WebDAV 文件会话仅存在当前 Owner 页面内存。切换 Files 位置或隐藏预览不会断开会话；用户手动断开或页面退出会取消读取并释放连接。会话与 Vault 凭据、跨页面文件权限和 Task 生命周期相互独立。Files 页面离开不表示任意扩展标签页关闭后仍能播放。
- 当前通用预览只接入有界栅格图片、UTF-8 文本和安全 Markdown 子集：文本最多 2 MiB，图片最多 8 MiB；HTML、SVG、PDF、Office 和未知签名显示不可用原因，不执行远端活动内容。Markdown 渲染不信任原始 HTML，链接仅允许 HTTP、HTTPS 与 mailto。
- 远程文本保存最多 2 MiB，必须基于列表时取得的强 ETag 使用 If-Match；HTTP 冲突不覆盖、不自动重试。连接中断后的写入结果提示未知，要求刷新核对。
- 本地播放器仅接受用户已授权目录中的浏览器 File，用 object URL 播放并在切换/卸载时释放；canPlayType 仅是提示。远程认证音视频不进入原生 audio/video；浏览器无法设置其 Basic Auth header，当前范围不宣称原生远程媒体播放。未实现兼容容器 demux 前，不把普通 MP4 字节直接交给 MSE。

## 兼容性与迁移

- 不改变现有 WebDavClient 小文件默认预算、Vault 对象格式、权限声明或 ADR 0015 的下载/缓存限制。现有文件操作继续使用原预算；仅显式打开的 FileRef 读取使用分段 adapter。
- 旧版 FileRef 不持久化；更新无需数据迁移。会话刷新后，用户从当前列表重新打开文件并按当前权限建立引用。
- 此决定只准许受限 FileRef 与预览/本地媒体实现，不关闭 G2-Core、PDF、Office、Media 或 Music Gate。所有支持范围仍以真实夹具和目标 Chrome 证据为准。

## 后果

- 预览是交互读取能力，不创建后台任务；搜索、转换、解压和批处理仍按现有 Task/Worker Contract 运行。
- Range response 目前由共享客户端先缓冲单个有界分段，再交给 pull stream，因此内存受单段与队列限制，但还不是网络 Response 的零缓冲直通。
- 不支持 Range 或不提供强 ETag 的 NAS 仍可使用既有受限小文件操作；大文件流式读取会明确拒绝。

## 关联

[Architecture](../ARCHITECTURE.md)、[App Contract](../APP_CONTRACT.md)、[Engine Contract](../ENGINE_CONTRACT.md)、[Security](../../SECURITY.md)、[ADR 0014](0014-shared-webdav-transport.md)、[ADR 0015](0015-file-manager-dav-cache.md)、[Risk Register](../RISK_REGISTER.md)。
