# ADR 0006: 广告过滤页面访问与恢复边界

- 状态：已接受
- 日期：2026-09-16

## 背景

仅靠 DNR 无法清理页面自生成的广告容器和残留占位。产品方向改为广告与隐私保护优先，允许广告模块自动访问 HTTP(S) 页面；但 UniPass 的密码填充仍必须保持用户触发、HTTPS、origin/path 匹配和临时注入。

## 决策

- 仅广告模块注册固定的 `http://*/*`、`https://*/*`、`document_start`、`all_frames`、`ISOLATED` content script。该脚本只请求当前 frame 的已验证 selector/scriptlet 描述，不调用 Vault、Credential 或 Fill 消息。
- Cosmetic 只支持有限通用/站点 selector 和本地实现的 `remove-attr`；远程文本不能直接成为 CSS、HTML 或 JavaScript。未知 procedural、selector、scriptlet、参数或作用域跳过并计数。
- 四源订阅的 DNR 与 cosmetic 结果使用 generation/staging 提交流程；跨 API 失败恢复上一代。小型本地 baseline 只用于首次离线最低网络保护，不冒充完整订阅。
- 默认保护常开。用户可以从当前活动网站主动暂停 10 分钟；通过精确 host 的临时 DNR allow 规则、cosmetic 清理和 scriptlet 清理同步停用，之后可恢复；不保存访问历史或默认放行站点。

## 后果

页面访问权限扩大到广告过滤所需边界，能处理静态广告位和少量已审计反规避属性，但仍不承诺完整 Anti-CV/procedural 或同源视频广告兼容。隔离的广告 content script 不改变密码模块的权限与消息契约；真实站点误拦截、跨浏览器重启和暂停语义仍需人工验收。

关联：[SECURITY.md](../../SECURITY.md)、[ARCHITECTURE.md](../ARCHITECTURE.md)、[rules/SOURCES.md](../../rules/SOURCES.md)、[TECH_DEBT.md](../TECH_DEBT.md)。
