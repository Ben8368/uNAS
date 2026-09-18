# ADR 0009: UniPass Capability Integration into the uNAS MV3 Extension

- 状态：已接受
- 日期：2026-09-18

## 背景

uNAS 原先只有 WXT/React Demo 壳，UniPass 则拥有独立的 DNR、WebDAV Vault、Legacy `credential-core.wasm` 和页面浮层。继续保留两个 Service Worker 或把浮层改成普通 Popup 都会破坏产品入口与数据边界。

## 决策

- uNAS 是唯一构建与维护仓库；UniPass `main` 只作为只读来源与回归基线，本轮未修改。
- UniPass 源码放入 `apps/extension/src/unipass/`，由 uNAS 唯一 `entrypoints/background.ts` 调用 `installUniPassBackground()`；统一消息 listener 由 `installWorkspaceRouter()` 注册，先校验来源，再分发 UniPass 请求。
- 工具栏 action 保持无 `default_popup`，点击后通过 `activeTab` + `scripting` 注入原 UniPass `page-overlay.js`。浮层继续使用原始 popup DOM/CSS，并以 closed Shadow DOM 隔离样式。
- AdBlock 使用独立 `adblock.content.ts` 与后台 DNR 生命周期；Vault 使用 Web Crypto/WebDAV/加密 IndexedDB cache；Legacy API 和 WASM 只经 `legacy-credential-source.ts` 注册，不进入 Vault Core。
- Legacy 由独立 composition layer 注册到 credential-source registry；Vault Service 不直接依赖 Legacy。消息路由只允许严格的 `getCosmeticRules` 子 frame 请求；Vault mutation / popup fill 仅接受顶层扩展管理页，浮层打开管理页需要 action 注入的 tab/document-bound session capability token。
- 新增 `passwords.html` 和 uNAS `passwords` System App 入口，但它不替代工具栏页面浮层。
- 不复制本地 storage、IndexedDB、设备密钥或远端明文完成扩展迁移；旧 UniPass 用户必须用 WebDAV Vault Key/连接材料重新连接。旧扩展和远端数据在验证前不删除。

## 后果

uNAS 现在能在单一 MV3 包内初始化 DNR、Vault 同步、可选 Legacy 兼容和原版浮层；禁用 Legacy Adapter 不影响 WebDAV Vault 构建和运行，消息 capability 也避免广告 Content Script 进入密码管理特权路由。代价是当前包增加 WASM、外部主机权限和独立安全审计范围；UniPass 资源许可证、uNAS 最终签名 key、真实 WebDAV/Legacy 账号、真实 Chrome 工具栏手势和独立原版 UniPass 视觉对照仍需发布前证据。

## 关联文档

- [uNAS SECURITY](../../SECURITY.md)
- [uNAS ARCHITECTURE](../ARCHITECTURE.md)
- UniPass ADR 0003：`C:\UniPass\docs\ADR\0003-crypto-boundary-and-legacy-retirement.md`（来源仓库只读基线）
