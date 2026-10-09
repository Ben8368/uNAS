# Architecture Decision Records

ADR 记录长期维护决策及其原因。实现细节进代码和测试，临时状态进 `CONTEXT.md`。

## 格式

文件名使用 `NNNN-short-title.md`，正文包含：状态、日期、背景、决策、后果和关联文档。

## 当前 ADR

- [0001-ai-governance-entry.md](0001-ai-governance-entry.md)：AI 单一入口、红绿灯审查与验证闭环。
- [0002-user-triggered-unipass-login.md](0002-user-triggered-unipass-login.md)：限定域名和 OAuth 参数的用户触发一键登录。
- [0003-crypto-boundary-and-legacy-retirement.md](0003-crypto-boundary-and-legacy-retirement.md)：密码学实现边界与 Legacy uNAS 退役原则。
- [0004-local-first-vault-cache-and-browser-import.md](0004-local-first-vault-cache-and-browser-import.md)：本地优先缓存、WebDAV 同步与浏览器 CSV 迁移。
- [0005-dnr-only-network-blocking.md](0005-dnr-only-network-blocking.md)：使用 Chrome DNR 与官方 URL 自动订阅的广告/追踪网络阻断。
- [0006-ad-filtering-page-access-and-recovery.md](0006-ad-filtering-page-access-and-recovery.md)：广告模块的自动页面访问、cosmetic/scriptlet 隔离与用户触发站点恢复。
- [0007-embeddable-legacy-source.md](0007-embeddable-legacy-source.md)：宿主显式安装的 Legacy 入口（历史同步条款已被根 ADR 0021 替代）。
