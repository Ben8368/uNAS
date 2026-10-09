# ADR 0007：可嵌入 Legacy 源码与密码功能回同步

- 状态：已接受
- 日期：2026-10-09

## 背景

uNAS 通过 Git submodule 引用 UniPass，需要复用 Legacy 实现而不安装独立扩展的 Service Worker 或广告模块。维护者同时要求同步近期密码功能改进。

## 决策

- `src/legacy/index.ts` 暴露 API、目录、凭据来源、作用域、登录与 Jupiter 能力；导入没有 Chrome listener 或网络副作用，只有显式 `installLegacyLifecycle()` 注册兼容事件，重复安装幂等。
- Legacy API/WASM 仍冻结为兼容职责。Vault Service 通过 CredentialSource registry 获取 Legacy 凭据，独立扩展在 composition root 注册；空 registry 拒绝 Legacy 请求。
- 同步 uNAS 的请求预算、Feishu 登录识别、WebDAV 传输、创建恢复、配置写入串行化及同步修复。共享传输放在本仓库 `src/shared/webdav-client.ts` 和 `webdav-url.ts`，不引用 uNAS 外部路径；不覆盖 UniPass 广告、品牌、UI 和签名身份。
- 密文与设备密钥、兼容 storage key、旧 Vault 标识保持不变。新建前的恢复记录仅存设备密钥加密的连接材料；先保存恢复记录再写远端，未确认创建可重试而不生成替代 Key。

## 后果

两个仓库独立验证、提交与推送。宿主固定 commit，不能通过 Git submodule 指针分发本地未提交源码。`npm run verify` 仍是独立扩展门禁；真实企业登录、WebDAV 冲突与工具栏手势继续按原验收清单补证据。

## 关联文档

- [Architecture](../ARCHITECTURE.md)、[Security](../../SECURITY.md)、[ADR 0003](0003-crypto-boundary-and-legacy-retirement.md)
