# ADR 0015：文件管理 WebDAV、浏览器下载与受限临时缓存

- 状态：已接受
- 日期：2026-09-29
- 修订：临时缓存容量预算由 [ADR 0016](0016-file-cache-quota.md) 替代；本文件其他决策继续有效。
- 背景：维护者明确要求继续实现 WebDAV 文件模块，将文件管理改为下载 App 的侧栏布局，并研究扩展存储申请与默认临时缓存。本决策授权受限实现；真实 NAS、容量压力与人工视觉仍按风险项验收。

## 决策

- Files 通过独立 application ports 访问 WebDAV、浏览器下载记录与临时缓存；UI 不接触文件句柄、OPFS 根、扩展权限或网络传输。继续复用 ADR 0014 的 HTTPS 传输与预算，不复用密码库连接材料或 Vault Key。
- WebDAV 文件连接须用户勾选连接/上传同意并点击连接，adapter 在手势中申请单一 HTTPS origin 权限。凭据仅在本页内存，离开该面板/关闭页释放，不持久化、不自动重连，不进入 BroadcastChannel、Desktop store 或日志。文件名/内容仅在用户选择上传时发送给已连接服务器，保留与删除策略由该服务器控制。
- 仅 Depth:1 列表、受控目录导航、MKCOL、非覆盖 PUT、GET 和有强 ETag 的单文件 DELETE。拒绝外域、授权根外/嵌套条目、异常 XML 与路径；目录最多展示 200 项、响应最多 1 MiB、解析最多 1001 项，单文件传输最多 16 MiB；传输截止与取消由共享 adapter 处理。写入使用同源 Web Lock，PUT 使用 If-None-Match:*，DELETE 使用 If-Match；目录不递归删除，网络/取消的写入结果提示未确认，不自动重放。
- Files 的“下载”面板通过 Chrome `downloads` API 查看最近 200 条浏览器下载记录，并仅呈现文件名、状态、大小和时间；不持久化或展示来源 URL 和本机绝对路径。点击定位操作调用 `downloads.show()` 让 Chrome 打开系统文件管理器；文件实际保存位置由浏览器设置管理。扩展不读取文件内容、不授予目录句柄，也不要求用户另选下载路径。无法由下载记录 API 提供的文件内容管理仍需用户在本地文件面板单独授权。
- 临时缓存使用专属 OPFS 子目录，随机 ID 引用，载荷与短小元数据分开；Web Lock 串行化修改、记录关闭后才视为导入完成。单文件 32 MiB、总计 256 MiB/200 项（包括回收站），创建 24 小时过期，打开/刷新时清理。失败导入回滚，缺失提交记录的孤儿在下次扫描清理；未知或损坏记录拒绝处理，不扩大删除到其他 App 暂存。
- 回收站仅管理缓存副本，移动/恢复只修改元数据且不延长有效期；本地与 WebDAV 直接删除仍明确不可从这里恢复。清空缓存、清空回收站、远端删除均有对象/不可恢复说明；导出仅报告交给浏览器，不假报实际保存完成。
- 存储申请使用用户点击的 navigator.storage.persist()，失败仍在默认配额下使用且保留可读反馈；estimate() 显示扩展整体配额，不宣称可保证容量。Chromium 将 unlimitedStorage 标记为不可选权限，故本轮不新增该安装权限；持久化保护不增加配额，也不保证卸载后保留。缓存不是备份。

## 后果与替代方案

可在授权边界下管理少量远端文件并短期暂存本地副本；下载面板呈现浏览器记录，不代表扩展取得下载目录访问权。不承诺任意 NAS、无限大小、长期备份、后台续传、连接中心、多连接持久化或跨设备同步。拒绝默认 unlimitedStorage、自动上传、复用 Vault 凭据与本地文件自动删除到私有缓存：权限、容量和数据保留语义不能隐式扩大。

## 依据与关联

2026-09-29 核查：[Chrome storage](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies)、[Chromium 权限定义](https://github.com/chromium/chromium/blob/main/extensions/common/permissions/extensions_api_permissions.cc)、[RFC 4918](https://www.rfc-editor.org/rfc/rfc4918.html)。本地运行时版本以 package.json/lockfile 为准，无新依赖或外部 skill 安装。

[Security](../../SECURITY.md)、[Architecture](../ARCHITECTURE.md)、[ADR 0014](0014-shared-webdav-transport.md)、[Risk Register](../RISK_REGISTER.md)。
