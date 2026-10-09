# Chrome 验收清单

## 自动化 smoke

`npm run smoke:chrome` 使用 `puppeteer-core` 和本机 Google Chrome，在临时用户目录加载 `dist/`。Chrome 路径按 `CHROME_BIN`/`CHROME_PATH`、系统 `PATH` 和当前操作系统的标准安装注册信息动态发现；脚本不绑定某个系统的绝对安装路径，也不回退到 Edge。`npm run smoke:chrome:hardened` 会先校验 `artifacts/hardened/` 的报告和完整性哈希，再加载 hardened `dist/`。两者验证 MV3 manifest、Service Worker 注册、popup、本地 `credential-core.wasm` fetch/instantiate、Vault 缓存真实 IndexedDB 并发写入、baseline ruleset、真实 DNR 阻断、独立 cosmetic fixture、全局 selector 被站点例外取消后的 CSS 可见性、`remove-attr`、无需刷新页面的暂停/恢复与第三方请求放行；同时收集 popup 的 console/page error。它们不使用真实账号或密码。

CI 和 Release 分别运行 normal 与 hardened job；normal job 运行 `npm run verify`/独立 WASM 可复现构建，hardened job 运行 `npm run verify:hardened`。无图形 Linux runner 通过 `xvfb-run` 提供显示环境。

## Manual authenticated Chrome acceptance

必须在独立 Chrome Profile 中加载同一份 `dist/`，由维护者使用脱敏/专用测试账号实际确认。不得把真实 credential、token、Cookie、响应或截图提交到仓库。

2026-09-14：维护者已在独立 Chrome Profile 完成真实 uNAS/Jupiter、凭据、用户作用域、Service Worker/WASM 重启和 Self Derived Build 验收，暂未发现问题。

- [x] uNAS session、uNAS login helper 与 Account catalog
- [x] Credential availability；包含空密码账号不展示
- [x] Reveal；包含 Unicode password
- [x] Copy username/password
- [x] 60 秒后清除 Reveal 明文
- [x] Popup Fill 与 Overlay Fill
- [x] HTTPS enforcement 与 URL mismatch 拒绝
- [x] 用户切换后的 scope 隔离；60 秒 TTL、页面离开与新 Reveal 的引用清理
- [x] Service Worker restart 与 WASM restart initialization
- [x] Jupiter login、keepalive 与 token session sync；确认原始 password 不经过 JS transform path
- [x] Self Derived Build 在独立 Profile 中解压后直接加载，并确认当前扩展目录可手动覆盖/重新加载
- [ ] AdBlock Tester：脚本、图片/横幅、分析与追踪，分别记录网络阻断和残留 DOM；不记录分数作为发布指标
- [ ] Can You Block It eXtreme：横幅、原生广告、弹层、pop-under、页内推送、视频前贴片；不点击广告、不授权通知、不下载
- [ ] d3ward：拆分网络、cosmetic 和其他类别；排除 DNS/CORS/站点不可用及浏览器自身弹窗阻止造成的假阳性
- [ ] 至少三个日常业务站：登录、支付、页面布局、误拦截、性能；误拦截时验证当前站点 10 分钟暂停与恢复
- [ ] 正常已安装扩展离线关闭/重开 Chrome 后 baseline、动态 DNR、cosmetic generation 恢复

当前范围关闭：Jupiter 适配计划逐步取消，“Disable keepalive cleanup”不再作为当前交付门槛。

自动化 smoke 通过不等于以上真实登录或广告站点验收通过；人工项目必须记录日期、Chrome 版本、Profile、扩展版本和未覆盖类别。自动化 smoke 使用本地 HTTP fixture 验证 baseline、动态 DNR、cosmetic、scriptlet、暂停/恢复、旧关闭设置迁移和 Worker 停止后的网络行为，不依赖线上广告服务。
## WebDAV Vault 多设备验收（本轮新增）

以下步骤必须在真实 WebDAV/NAS 或 Nextcloud 上由维护者手工执行，自动测试不能替代。

### Device A

1. 在独立 Chrome Profile 加载同一份 `dist/`，选择“创建新密码库”。
2. 输入 Vault Name、HTTPS WebDAV URL、WebDAV username 和 App Password；保存并连接。
3. 将只显示一次的 Vault Key 保存到离线安全位置；新增 App、Account 和 password，确认当前页 Fill 成功。

### Device B / clean profile

1. 用全新 Chrome Profile 加载扩展，选择“连接已有密码库”，不要选择创建模式。
2. 输入本地显示名称、相同 WebDAV URL、WebDAV App Password 和 Device A 的 Vault Key。
3. 确认读取到 Device A 的 App/Account；确认 catalog、当前页 Fill，以及在“全部应用”页连续点击应用图标 5 次后 WebDAV 账号详情中的 Reveal/Copy 可用。
4. 使用错误 Vault Key 重试，确认失败、不新增本地 profile、远端无 PUT/覆盖。
5. 删除远端 manifest 后分别验证：空 `objects/` 允许创建新 Vault；已有 `app_`、`account_` 或 `credential_` object 时创建被拒绝。

### Conflict and coexistence

- Device A/B 同时编辑同一 Account，确认后一方收到 conflict，而不是静默覆盖。
- 在 uNAS 登出后，仍能使用已连接 WebDAV Vault 展示 Apps、当前页 Fill 和五击进入后的 Reveal/Copy；Legacy account 仍要求有效 userScope。
- 验证权限拒绝、401/403、timeout、损坏 ciphertext 和不兼容 WebDAV 响应都显示为 error，不显示为 empty password。

### Current status

真实 NAS/Nextcloud 双设备、权限拒绝、冲突、本机 Chrome authenticated smoke 及 uNAS 登出后的 WebDAV 共存路径均已由维护者完成验收，暂未发现问题。自动化验证与人工验收均已完成；本轮不创建 Release。
