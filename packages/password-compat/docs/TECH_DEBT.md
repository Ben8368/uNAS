# 技术债追踪

> 红绿灯审查中需要跨任务跟进的黄灯进入本文；红灯不得以登记债务代替修复。

## 分级

| 等级 | 含义 | 处理要求 |
| --- | --- | --- |
| P0 | 正确性或安全阻断 | 当前任务修复；影响阶段时在 `CONTEXT.md` 标记 |
| P1 | 用户体验、可靠性或维护风险 | 下个相关迭代优先处理 |
| P2 | 长期结构优化 | 扩展相关能力前处理 |

## 未偿还债务

- TD-009 Legacy uNAS 退役与 credential-core 收缩（P2，未偿还）：Legacy 被正式判定可退役后，删除 Legacy uNAS/Jupiter 运行能力、`credential-core` 中仅为 Legacy 存在的实现和 ABI、无用途的 Rust crypto dependencies，并清理对应测试和 artifact 规则；检查并清理 WASM build/hardening/audit/release infrastructure；若项目不再需要 WASM，删除 WASM-specific CSP 和构建特殊路径；同步 `ARCHITECTURE.md`、`SECURITY.md`、`CONTEXT.md`，运行完整验证并完成适用的真实 Chrome 人工验收。详见 [ADR 0003](ADR/0003-crypto-boundary-and-legacy-retirement.md)。

- TD-010 上游过滤列表兼容与站点验收（P1，未偿还）：四源官方 URL、保守网络转换、26 条静态 baseline DNR 规则（含 d3ward 131 host 兼容项）、d3ward/eXtreme 站点限定脚本/cosmetic 兼容规则、cosmetic MVP 和本地 `remove-attr` scriptlet 已实现。2026-09-17 已补全 selector 和受限 scriptlet 的全局/站点例外编译、按 host 合并和真实 Chrome CSS fixture 验证，例如 `##.ad-banner` 可由 `example.com#@#.ad-banner` 取消；成功 generation 会刷新打开页面，SPA 同步复用未变 CSS/scriptlet，受限 `remove-attr` 合并为单一属性定向限流 observer，真实 Chrome smoke 覆盖双属性移除、暂停恢复和无需刷新再应用。同日在 Chrome 153 临时隔离 Profile 加载 `dist/` 后，四源 ready（19,292 DNR / 101,953 domain entries）；AdBlock Tester 页面报 97/100 且 26 个请求明确为 `ERR_BLOCKED_BY_CLIENT`，Can You Block It eXtreme 页面加载且 12 个广告脚本被拦截，但首屏仍有其静态测试素材/占位，需按 cosmetic 漏拦截继续分析；d3ward GitHub 测试 URL 已显示项目归档页，无法验收其原分类。被动加载 BBC News、YouTube、Amazon、GitHub 登录页和 Stripe 首页均完成；未登录、未提交表单或支付，不代表真实业务流。仍需在隔离 Chrome Profile 中记录用户常用登录/支付/工作站点的误拦截、暂停/恢复，以及正常开发者模式安装后离线关闭/重开 Chrome 的 DNR/cosmetic 持久化。Anti-CV 其他 snippets、procedural、regex、同源视频广告与 DNR 不支持模式仍跳过；不得把本地 fixture 或测试站分数宣称为完整 Anti-CV 兼容。来源及边界见 [rules/SOURCES.md](../rules/SOURCES.md)。

- TD-011 Liquid glass 样式拆分（P2，未偿还）：`src/popup/liquid-glass.css` 已超过 500 行，当前仍仅负责玻璃视觉样式；下次扩展样式能力前，按窗口、导航控件与弹窗拆分，并保持 Popup 与页面浮层的加载顺序一致，回归浅色、深色及无障碍媒体查询。

- TD-012 Legacy 加载实测（P2，未偿还）：后台 15 分钟目录缓存已有复用、Worker 重建、隔离和失败回归测试；仍需在真实 Legacy 登录态记录首次打开、重复打开、缓存过期及手动同步的耗时和请求数，确认门户慢响应下的体验。

## 已归档

- TD-008 本地解锁密码：已于 2026-09-14 关闭；采用 PBKDF2-SHA-256 + AES-256-GCM 加密封装，失败计数仅 session，达到上限 fail closed，支持显式 lock/disable/remove；详见 [归档记录](archive/tech-debt/TD-008-local-unlock.md)。

- TD-007 设置页职责拆分：已于 2026-09-13 关闭；WebDAV 连接表单迁入 `webdav-settings.ts`，当前页账号创建迁入 `current-page-account.ts`。
- TD-006 空密码账号/应用过滤：已于 2026-09-11 关闭，详见 [归档记录](archive/tech-debt/TD-006-empty-password-filter.md)。
- TD-004 认证服务端化与客户端长期凭据退出：已于 2026-09-11 关闭，当前产品决定继续使用客户端解密；客户端明文短暂可见仍是已接受边界，详见 [归档记录](archive/tech-debt/TD-004-client-decryption-accepted.md)。
- TD-005 Rust credential core hardening：已完成仓库侧 ABI、Rust QA、可复现 WASM、产物审计、Chrome smoke、Release gate 与供应链收尾；真实账号路径保留为人工验收，详见 [归档记录](archive/tech-debt/TD-005-rust-credential-core-hardening.md)。

## 偿还流程

1. 红绿灯或用户反馈识别问题并分级。
2. 修复时补测试或明确真实浏览器验收。
3. 完成后从活跃清单移除；需要保留复盘时移入 `docs/archive/tech-debt/`，Git 历史保留变更依据。
