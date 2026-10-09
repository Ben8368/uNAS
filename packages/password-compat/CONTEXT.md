# 当前状态

> **最后确认：** 2026-10-09
> **阶段：** uNAS 内部密码兼容模块；不独立发布，当前产品状态以 [根 Context](../../CONTEXT.md) 为准。

## 当前决策

- 账号和备注完整展示；账号级可用性检查和应用级过滤均由 Service Worker 执行，应用列表只展示至少含一个可用账号的应用，并区分空密码、凭据验证失败和账号目录失败。允许使用账号密码 Fill，但 plaintext password 不返回当前页列表；配置 WebDAV 后，只有“全部应用”页连续点击应用图标 5 次进入详情，WebDAV 账号才显示查看入口。
- 填充仅允许 HTTPS 且需匹配应用 origin/path；密码 Fill Content Script 仍按用户操作临时注入、不自动提交。广告 cosmetic Content Script 是独立的、受审计的自动页面脚本，不读取凭据或表单。
- uNAS 离线一键登录由用户点击触发，仅在一个标签页、两分钟窗口内操作固定门户和飞书 OAuth 页；不读取或保存 Cookie、授权码或页面数据。
- 企业协议请求版号保留 `runtime-config.json` 基线 `5.3.6`，可手动覆盖；不查询外部商店、不跟随独立项目版本。
- 设置页的版本覆盖仍保留隐藏兼容入口；Popup 内自派生构建、隐藏三击、静态文件读取消息和 `self-build-files.json` 已移除。查看 WebDAV 账号密码不再依赖系统认证、通行密钥、扩展 PIN 或 Advanced capability。
- uNAS AES-ECB-PKCS7 解密及 Jupiter 的 MD5/DES-ECB-PKCS7 密码转换已迁入随扩展本地打包的 Rust `credential-core.wasm`；availability 在 WASM 内只返回状态，Jupiter keepalive 从 uNAS ciphertext 直接得到 transformed password，JS 不再接触原始 Jupiter 明文。普通构建固定 `stable-v1` 材料，hardened 构建由 `UNAS_HARDEN_SEED` 生成 3～5 个 fragment、重排和轻量算术重构；JS/WASM 仍完全自包含。该措施只提高静态分析成本，动态调试仍可能取得运行时材料或明文；继续使用客户端解密是当前产品计划。
- Rust 构建使用固定工具链与 path remap；普通 WASM 要求 byte-for-byte reproducibility，hardened 构建要求 Binaryen 并将报告留在 artifacts。构建与 hardening 边界见 docs/ARCHITECTURE.md。
- Legacy 企业门户 仍在使用；`credential-core` 新增职责冻结为 Legacy compatibility，新的 Vault AES-GCM 等能力不迁入 WASM；退役与 core 收缩见 [ADR 0003](docs/ADR/0003-crypto-boundary-and-legacy-retirement.md) / [TD-009](docs/TECH_DEBT.md)。`legacy-unipass` 与 WebDAV 分离，禁止双写。
- WebDAV 以本地 AES-GCM 密文缓存为运行时副本、WebDAV 为同步/恢复后端；新设备由 endpoint、credential 与 Vault Key 建立缓存。连接材料受设备密钥保护；配置完成后，用户只能在“全部应用”页连续点击同一应用图标 5 次进入账号详情查看 WebDAV 密码，当前页与 Legacy 账号不提供查看入口。ETag 冲突 fail closed。Chrome/Edge CSV 经用户选择、预览和 VaultCore 写入，不上传或持久化明文；详见 ADR 0004。
- 广告含 26 条 baseline DNR、四源订阅、全局/站点 cosmetic 例外、更新刷新、SPA 幂等同步、受限 `remove-attr` 与 host 暂停/恢复。三站、正常安装后的离线重启和业务站误拦截待人工验收；广告消息/存储路径不接触凭据。
- 内部测试壳只使用 uNAS 品牌，不携带外部商店公钥，不同步或独立发布；[ADR 0021](../../docs/ADR/0021-unas-only-brand.md) 替代旧发布约定。

- 源码嵌入边界见 [ADR 0007](docs/ADR/0007-embeddable-legacy-source.md)；2026-10-09 完整验证（184 Node / 5 Rust）和系统 Chrome smoke 通过，见[分支合并验收](docs/archive/reviews/2026-10-09-branch-sync.md)。真实登录/WebDAV 仍待人工验收。

- Legacy 浮层复用用户隔离的 15 分钟目录缓存；手动同步强制刷新，当前页只请求匹配应用账号；真实耗时验收见 TD-012。

## 近期优先级

1. 广告拦截常开；EasyList / EasyPrivacy / EasyList China / Anti-CV 使用官方 URL 每小时订阅并合并同条件域名，baseline 覆盖已验证 OEM 缺口，d3ward 兼容与 `remove-attr` 仅处理固定 selector/属性，正文/远程代码不进源码，完整 Anti-CV 兼容与真实站点覆盖验收见 TD-010。Jupiter 新适配取消；Legacy 退役见 TD-009。

## 按需入口

- 架构与数据流：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 安全边界：[SECURITY.md](SECURITY.md)
- 审查与验证：[docs/AI_RULES.md](docs/AI_RULES.md)
- 活跃技术债：[docs/TECH_DEBT.md](docs/TECH_DEBT.md)
- 长期决策：[docs/ADR/README.md](docs/ADR/README.md)
