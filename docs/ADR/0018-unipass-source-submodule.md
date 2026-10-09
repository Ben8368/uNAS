# ADR 0018：UniPass 源码子模块与 Legacy 集成边界

- 状态：已接受
- 日期：2026-10-09

## 背景

维护者要求参照 RockDSM-Virt 的 `linux-5.10.x`，建立指向 UniPass 的源码目录并解耦密码管家 Legacy。该目录是 Git submodule：`.gitmodules` 提供 URL，主仓库索引用 mode `160000` 固定子仓库 commit。它不是符号链接，也不会自动跟随远端 main。

本决定替代 [ADR 0009](0009-unipass-capability-integration.md) 的“UniPass 仅作只读来源”条款；其他安全和单扩展决定保留。

## 决策

- `sources/UniPass` 指向 `https://github.com/Ben8368/UniPass.git`；固定 commit 后构建只读取本地源码，不在扩展运行时下载或执行仓库代码。
- uNAS 的 `modules/password-manager/legacy/adapter.ts` 是唯一生产依赖入口，消费 UniPass 的 `src/legacy/index.ts`；旧 API、WASM loader、目录缓存、身份校验、登录辅助和 Jupiter 生命周期由 UniPass 维护。导入入口无注册事件副作用，宿主显式安装 adapter。
- uNAS 继续拥有 WebDAV Vault、App、页面浮窗、受控消息路由和唯一 WXT Service Worker；不导入 UniPass 的 standalone Service Worker、广告启动器或 Popup。账号契约保持结构兼容；设备密钥、storage key、Vault ID、密文格式不变。
- UniPass 的独立扩展仍可构建；本轮将可移植的登录、请求预算、Vault 创建恢复、配置写入串行化、同步与 CredentialSource registry 改进同步回其本地工作区。uNAS 的桌面、品牌和共享主题不整体覆盖 UniPass。
- 该解耦是源码所有权和 composition 隔离，Legacy 仍启用；WebDAV-only 构建、权限/WASM 删除继续由 [TD-003](../TECH_DEBT.md) 跟踪。

## 后果

- 初始化使用 `git submodule update --init --recursive`；私有 UniPass 仓库需要读取权限，CI 的 `SOURCE_REPOSITORIES_TOKEN` 需具有两个仓库的只读 contents 权限。
- 两个仓库有独立的改动、验证和提交。维护者授权提交/推送后，应先提交并推送 UniPass，再将主仓库 gitlink 更新到该 commit，最后提交主仓库。子仓库未提交修改不会包含在 gitlink 中；本地同步不等于远端同步。
- uNAS 执行 `pnpm verify` 和受影响扩展 E2E；UniPass 执行 `npm run verify`。构建和合成夹具不替代真实登录或 WebDAV 人工验收。

## 替代方案

- 只放 URL 文件：不能提供 GitHub 的子模块目录和固定源码快照，拒绝。
- 持续复制 Legacy 实现：会形成两个修复来源，拒绝。
- 直接导入 UniPass Service Worker：会重复安装后台和广告事件，拒绝。

## 关联文档

- [Architecture](../ARCHITECTURE.md)、[Security](../../SECURITY.md)、[README](../../README.md)
