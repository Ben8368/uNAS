# ADR 0013：uNAS 统一品牌与密码管家、广告拦截模块解耦

- 状态：已接受
- 日期：2026-09-22
- **背景：** 原 UniPass 能力已经随 uNAS 单扩展交付，但密码、Vault、网页浮窗、DNR 和 cosmetic filtering 仍位于混合目录与部分共用路由中。继续以 UniPass 作为用户可见产品名会造成第二产品身份，也会使权限边界和回归责任不清。

## 决策

1. **保留单扩展架构。** uNAS 继续使用一个 WXT + Manifest V3 扩展、一个 Service Worker 和统一 App Registry。密码管家与广告拦截分别位于 `modules/password-manager` 与 `modules/adblock`，由统一 extension adapter 做消息分发，不拆成需要分别安装的扩展，也不引入 Electron、Native Helper 或常驻服务。
2. **建立独立业务边界。** 密码管家拥有 Vault Core、WebDAV、Legacy credential adapter、网页浮窗和填充路径；广告拦截拥有 DNR、订阅、规则状态、Cosmetic filtering 和站点暂停。广告模块不读取 Vault Key、凭据明文、缓存或 WebDAV 材料；普通网页和广告 content script 不能调用受保护的 Vault 操作。双方只通过共享扩展 API、sender 校验和明确消息 contract 协作。
3. **统一对外品牌。** 用户可见名称统一为 uNAS、密码管家、广告拦截。`UniPass` 仅在历史来源、服务端协议、旧登录 URL、`legacy-unipass` Vault 标识、IndexedDB/storage key、消息兼容名和加密/远端格式中保留；不作为独立 App、扩展名称或用户引导品牌展示。
4. **冻结密码浮窗视觉。** 既有网页密码浮窗的布局、尺寸、材质、主题、动画、closed Shadow DOM、打开/关闭、外部点击和 Escape 行为是本次重构的视觉基准。允许替换必要品牌文字；不把浮窗改造成 Desktop 组件，不全量替换 CSS，不让共享 Token 覆盖浮窗原值。Desktop 入口可以使用独立布局，但复用同一 Vault Core。
5. **保持 Vault 数据兼容。** 不改既有 IndexedDB 名称、storage key、Vault ID、AES-256-GCM envelope、AAD、PBKDF2 参数、设备密钥、WebDAV manifest/对象结构或 Legacy adapter。已有远端 Vault 通过用户提供原连接材料和 Vault Key 接入；不复制旧扩展本地 storage/IndexedDB，不自动卸载旧扩展，不删除远端对象。本次不需要数据迁移；若未来需要迁移，必须另行版本化、可失败恢复并记录 ADR。

## 后果

- uNAS 桌面可从 App Registry 在当前窗口打开完整密码管家管理页，同时工具栏仍提供网页密码浮窗；两者使用同一受控 Vault 服务，不创建第二套密码库。独立 `manage.html` 仅作为旧入口和恢复/排障兼容面保留。
- 广告拦截的初始化、订阅刷新和消息处理不再依赖 Vault 是否配置、解锁或同步可用。
- 目录迁移会产生新的物理模块路径，但 Legacy adapter、兼容标识和数据格式继续保留。
- `system.display` 不再声明为 required permission；系统详情继续 feature-detect，浏览器不提供时诚实显示不可用。该变更也避免仓库 CI bundled Chromium 因非核心权限启动异常。

## 已完成与待验证

已完成：独立模块目录与后台安装器、统一 App Registry 的密码管家入口、广告拦截独立运行路径、uNAS 用户可见品牌文案、既有兼容标识保留、桌面入口的明文隔离设计、CI 权限根因修复和治理文档同步。

仍待验证：目标 Chrome 的真实工具栏 action 手势、隔离 Profile 下浅/深主题与主要控件状态截图逐像素对照、真实 WebDAV 冲突恢复、生产来源许可与发布签名 key。Playwright 自动化可以证明合成页面与扩展路由，不替代这些人工或外部证据。

## 替代方案

- 拆成两个扩展：拒绝，因为会破坏单一安装体验、增加权限/数据迁移复杂度并使浮窗与桌面入口难以共享受控 Vault Core。
- 机械重命名全部 UniPass 字符串：拒绝，因为会破坏兼容 key、远端协议、登录来源和加密格式。
- 用统一 Desktop 组件重做浮窗：拒绝，因为浮窗已有稳定视觉与交互基准，且 Shadow DOM 隔离是安全和回归边界。

## 关联文档

- [PRODUCT.md](../PRODUCT.md)
- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [APP_CONTRACT.md](../APP_CONTRACT.md)
- [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md)
- [SECURITY.md](../../SECURITY.md)
- [RISK_REGISTER.md](../RISK_REGISTER.md)
- [ADR 0009](0009-unipass-capability-integration.md)（历史融合来源）
