# ADR 0016：文件临时缓存容量预算

- 状态：已接受
- 日期：2026-09-30
- 背景：维护者要求将 Files 临时缓存的单文件上限放宽到 256 MiB，并取消应用层 256 MiB 总量上限。此前界面虽展示浏览器扩展配额估算，adapter 仍在 256 MiB 拒绝导入。

## 决策

- 替代 [ADR 0015](0015-file-manager-dav-cache.md) 的缓存容量条款：单文件上限为 256 MiB；最多 200 项（含回收站）；不设置应用层固定总字节上限。24 小时到期、Web Lock、导入回滚和专属 OPFS 子目录等边界继续沿用 ADR 0015。
- 实际总量受浏览器为扩展 origin 分配的存储配额与设备磁盘空间约束。`navigator.storage.estimate()` 只显示估算值，不作为保证可写空间，也不把 10.0 GB 等显示值写成产品容量承诺。写入失败时回滚本次导入并提示配额或磁盘不足。
- 持久存储申请仅降低浏览器回收风险，不提升磁盘容量；缓存仍不是备份。

## 后果与替代方案

用户可暂存较大的单个文件，多个文件合计可以超过 256 MiB。保留单文件与数量上限来约束每次写入和目录扫描；不再用固定总量阈值阻止浏览器允许的空间。更大规模的真实磁盘压力、页面中断和配额失败仍按 [RISK-017](../RISK_REGISTER.md#risk-017p1files-私有缓存与浏览器下载记录待验收) 验收。

## 关联文档

[ADR 0015](0015-file-manager-dav-cache.md)、[Security](../../SECURITY.md)、[Risk Register](../RISK_REGISTER.md)。

依据（2026-09-30 核查）：[Chrome 扩展存储说明](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies)、[StorageManager.estimate()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate)。
