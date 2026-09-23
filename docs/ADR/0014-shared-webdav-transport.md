# ADR 0014：共享 WebDAV 传输层与密码库后端收敛

- 状态：已接受
- 日期：2026-09-23
- 背景：维护者要求密码管理仅发展 WebDAV，移除 GitHub/Cloudflare，并为其他 App 复用 WebDAV 做准备。现有 WebDAV 网络实现嵌在 Vault adapter，Legacy 的整体撤除仍有独立调用链待处理。

## 决策

- WebDAV 协议传输位于 apps/extension/src/runtime/webdav/client.ts；纯 HTTPS 地址校验位于共享层。传输层不依赖密码模块、React、扩展权限 API、密钥存储或远端 Vault 格式。
- Vault adapter 保留 objects/*.json、manifest、强制 ETag、条件写入/删除与业务冲突错误；加密、缓存、dirty queue、tombstone 继续归密码模块，不成为通用文件协议。
- 传输仅接受 endpoint 内相对路径；禁止重定向、浏览器 Cookie 与缓存。保留 12 秒整体请求超时，新增调用者取消及默认 16 MiB 请求/响应预算（最多可配置 64 MiB）。预算是实现防线，不是大文件支持承诺。HTTP 认证、权限、网络、超时、取消和资源限制输出可读且不含连接密钥的错误。
- 不增加权限、后台自动上传或其他 App 联网入口；调用方继续负责用户同意、主机授权、生命周期与并发。未来每个 App 须经受控 port 接入，不能从 UI 直接 import 传输，也不能复用密码库连接材料或 Vault Key；用户未同意时仍本地处理。
- VaultBackendType 收敛为 webdav。GitHub/Cloudflare 原本只有类型占位，没有实现、配置入口或运行中后端；不提供虚假的迁移流程。Legacy 保留为独立凭据兼容来源，本轮不自动撤除、不删除用户或远端数据。
- 部分替代 ADR 0013 的 WebDAV 代码归属；其余安全、品牌、兼容与数据格式决定不变。Legacy 的最终删除需先满足 [TD-003](../TECH_DEBT.md#td-003legacy-密码能力尚未完成应用级解耦)。

## 后果与替代方案

其他 App 可复用有边界的 WebDAV 请求，不必依赖密码服务；尚未实现统一连接中心、文件列表、流式大文件传输或跨 App 同步。拒绝将整个 Vault Core 下沉：它会泄漏密码业务模型。拒绝现在自动启用所有 App 上传：缺乏逐功能授权和真实服务验收。

## 关联文档

[Architecture](../ARCHITECTURE.md)、[Security](../../SECURITY.md)、[ADR 0013](0013-unas-native-password-manager-adblock.md)、[Risk Register](../RISK_REGISTER.md)。
