# ADR 0012：仓库自维护的补充拦截订阅

- 状态：已接受
- 日期：2026-09-21
- 依据：维护者本轮要求将 B 站规则做成指向本仓库的订阅，并明确为已有订阅链接以外的补充规则；不包含自动提交、推送或发布授权。

## 决策

- 原有四个 ABP 订阅及 DNR 更新事务不变。新增独立、数据型 JSON 订阅，唯一维护源为 [filters/unas.json](../../filters/unas.json)，固定 GET `https://raw.githubusercontent.com/Ben8368/uNAS/main/filters/unas.json`。
- 增加唯一所需 `https://raw.githubusercontent.com/*` host permission。Chrome 忽略 host permission 的路径，实际代码固定完整 URL、拒绝重定向，不接受网页传入地址；不获取任意仓库、GitHub token 或用户内容。
- `credentials: omit`、`referrerPolicy: no-referrer`、20 秒超时、流式 100,000 bytes 上限、严格 UTF-8/JSON schema。GitHub 会接收到正常请求 IP 和网络信息，但不发送浏览页面、文件、账号、凭据或遥测。
- 仅接受精确 host 和受限 CSS 选择器，禁止脚本、远程代码、任意 CSS、通用元素目标、嵌套关系选择器、include 及协议外字段。保留 content script 的表单/按钮保护，不放宽第三方 ABP 编译器。
- 独立缓存和更新时间；现有每小时 alarm 同时触发两套互不阻塞的更新。失败保留已验证缓存或构建直接嵌入的同源快照，并将错误显示于现有拦截状态。无 DNR 或权限扩大到任意站点的新阻断行为。
- `version: 1` 固定协议，revision 递增；拒绝降级与同 revision 异内容。新版补充集替换旧集，允许提高 revision 后清空以撤回误伤规则。扩展升级只在缓存 revision 不低于随包版本时使用缓存。

## 安全评审与验收

权限及数据流参考 2026-09-21 核对的 [Chrome 跨源请求文档](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)，本轮 WXT 0.21.4。此变更无依赖增加、无远程脚本、无上传；仓库控制权和站点 DOM 变化仍是外部风险。HTTPS 与固定来源不等于签名；维护者需审查每次合入的规则和 revision。

schema/更新失败/独立事务由 `repository-*.test.ts` 验证，解包扩展 DOM 路径由 `bilibili-adblock.spec.ts` 验证。仓库文件尚未由本轮发布，远端首次获取及目标 Chrome 实站验收缺口登记在 [RISK-014](../RISK_REGISTER.md#risk-014p0密码管家融合的真实凭据路径与发布身份尚未全部验收)，不以本地构建替代线上结论。

## 替代方案

- 不把补充源塞进现有 ABP 批处理：纯 cosmetic 文件没有 DNR block，且仓库不可达不应阻止 EasyList 更新。
- 不全量开放远程 CSS/JavaScript：当前需求只需有限站点选择器；新增语法通过扩展版本审查。
- 不维护第二份硬编码 B 站规则：离线和在线共同消费同一文件，避免无法撤回旧规则和双份状态。
