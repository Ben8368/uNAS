# uNAS 密码兼容模块

本目录是 `@unas/password-compat` 内部 workspace 包，只服务 uNAS。没有外部项目镜像、同步或独立发布关系。`dist/` 是 Chrome smoke/hardened 验证用测试壳，不是第二个产品；产品入口在 `apps/extension`。源码维护与品牌边界见 [ADR 0021](../../docs/ADR/0021-unas-only-brand.md)。从仓库根运行 `pnpm install --frozen-lockfile` 与 `pnpm verify:password-compat`。

## 构建与安装

从根目录构建 `pnpm build:extension`，安装与验收按 [根 README](../../README.md) 执行。内部测试壳不提供独立下载、tag 或 Release。

## 权限边界

- `activeTab`：仅在用户点击扩展后读取当前标签页地址，并在当前 HTTPS 页面挂载本次页面浮层和授权本次填充。
- `scripting`：在用户点击扩展后临时注入页面浮层，点击“填入”后注入固定填充脚本；用户点击“一键登录”后，只在固定 uNAS/Tec-IAM 登录流程中点击两个精确匹配的按钮。
- `clipboardWrite`：仅响应用户点击，将用户选择的账号或密码写入系统剪贴板。
- `storage`：保存短期凭据可用性状态、用户主动开启的 Jupiter 保活配置和结果，以及一键登录的临时标签页状态；密码不会写入持久化存储。
- `alarms`：木星保活、Vault 同步及过滤订阅更新；后台任务不刷新页面。
- `tabs`：识别当前页面、管理用户触发的一键登录标签页，并把新获取的木星会话同步到已打开的木星标签页。
- `https://portal.unipass.top/*`：调用企业门户 API，并使用浏览器已有的企业登录会话。
- `https://accounts.feishu.cn/*`：仅在用户点击“一键登录”后，对固定 Tec-IAM OAuth 客户端和回调地址点击“授权”；不读取飞书账号数据或授权码。
- `https://jupiter.tec-do.com/*`：仅在用户主动开启木星保活后登录并同步会话。
- `https://easylist-downloads.adblockplus.org/*`：后台读取固定的官方过滤订阅 URL，不发送登录凭据。
- `optional_host_permissions: https://*/*`：仅在用户在扩展齿轮的密码库设置中主动测试/保存 WebDAV URL 时申请对应的 `https://host/*`；测试完成、保存失败、地址迁移或删除连接后会回收不再使用的 origin。
- `declarativeNetRequest`：由 Chrome 持续执行后台订阅与小型离线 baseline 的广告/追踪网络规则；默认启用且不记录请求。

扩展不申请 `cookies`、`privacy`、`webNavigation` 或 `contextMenus`，不使用密码填充常驻脚本；广告模块单独注册固定的 `http://*/*`、`https://*/*`、`document_start`、`all_frames`、`ISOLATED` 内容脚本，以按站点读取已编译的选择器数据并清理页面广告位。

## 本地构建与加载

```powershell
npm install
npm run verify
```

credential core 固定使用 Rust 1.98.1 和 wasm32-unknown-unknown。开发调试使用 `npm run build`；实际本地安装必须使用 `npm run build:hardened` 或完整的 `npm run verify:hardened`。hardened 构建要求开发机提供 `wasm-opt`；缺失时默认失败，只有显式设置 `UNAS_ALLOW_UNOPTIMIZED_WASM=1` 才允许调试降级。构建同时生成非敏感的 `runtime-config.json`；构建报告和 `integrity.json` 写入 `artifacts/hardened/`，不会进入最终 `dist/`。`npm run verify` 和 `npm run verify:hardened` 是两条独立门禁；发布或发版前另运行 `npm run verify:wasm-reproducible`。上述运行时不要求最终用户安装 Rust、Node、Binaryen 或其他外部运行时。

打开 `chrome://extensions`，开启开发者模式，然后加载已解压的 `dist` 目录。请先在独立 Chrome Profile 验证；测试壳不携带外部商店身份，不依赖旧扩展的设置或存储自动迁移。

“从浏览器导入密码”使用用户主动选择的 Chrome/Edge CSV，支持 `name,url,username,password` 或重排字段的 `url,username,password`，包括引号、逗号、换行和转义引号。导入先预览，再按目标 origin/path + username 选择跳过、覆盖或保留重复记录；部分失败不会回滚成功记录。CSV 不上传、不写入 storage/IndexedDB/日志，完成后请立即删除 CSV 并清空回收站/废纸篓。

WebDAV Vault 使用 local-first 模式：已同步的 AES-256-GCM ciphertext objects 保存在扩展 IndexedDB encrypted local cache，作为运行时目录和 Fill 数据源；WebDAV 仅作为跨设备恢复与同步后端。离线时目录、搜索、Fill、新增、修改和 tombstone 删除仍可用，写入进入 dirty queue；网络恢复后后台同步，ETag 412/409 标记 conflict，绝不静默覆盖。缓存不可用或首次设备没有缓存时，仍需连接 WebDAV 并提供 Vault Key，扩展不凭空创建远端 Vault。

齿轮中的“密码库设置”可在“添加密码库”和任一本地已保存密码库之间直接切换，也可从“重新连接”入口切回添加；不再提供与真实 Profile 混淆的“连接已有密码库”伪选项。添加时 Vault Key 留空会新建密码库，填写已有 Vault Key 则接入远端密码库。WebDAV 用户名、App Password 和 Vault Key 会以扩展设备密钥加密并长期保存在本机，浏览器重启后自动恢复登录态；重连时可直接保存，填写新材料则替换本机连接材料。配置 WebDAV 后，在页面浮层的“全部应用”中点击“打开扩展密码页”，再进入独立扩展页的“全部应用”；只有该页的应用详情支持查看 WebDAV 账号密码：连续点击应用图标 5 次进入账号列表；当前页面和页面浮层不显示“查看”，Legacy 企业门户 账号也不提供查看。表单直接完成 WebDAV 地址、用户名和 App Password 的测试与保存，不会新开标签页。只支持 HTTPS；连接/保存前由用户手势申请具体 WebDAV origin，并执行 `PROPFIND`/必要的 `MKCOL` 检查。当前 HTTPS 页面没有匹配账号时，可直接选择已连接 Vault 并保存账号与密码；扩展会使用当前域名创建或复用网站记录。Vault 网站记录暂不支持非默认端口；页面保存会明确拒绝，CSV 导入将这类 URL 计为无效，避免误合并不同服务。建议使用 WebDAV 专用账号或 App Password。原有手动 `X-Browser-Plugin-Version` override 保留为隐藏兼容路径；Popup 内自派生构建能力已移除。

## 项目治理

- [AGENTS.md](AGENTS.md)：AI 协作唯一入口与按需读取路由。
- [CONTEXT.md](CONTEXT.md)：当前决策、最近验证和三项优先级。
- [docs/AI_RULES.md](docs/AI_RULES.md)：`🚦 Audit Report` 红绿灯审查、验证和交付规则。
- [docs/GOVERNANCE.md](docs/GOVERNANCE.md)：单一事实源、篇幅预算和文档自治理。
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[SECURITY.md](SECURITY.md)：扩展数据流和凭据/权限边界。
- [CONTRIBUTING.md](CONTRIBUTING.md)：开发、验证与 PR 要求。

`npm run verify` 是普通构建门禁，依次执行治理检查、npm dependency audit、静态红绿灯、Rust QA、测试、类型检查、标准压缩构建和最终产物审计。`npm run verify:hardened` 负责 hardened 构建、运行文件审计、外置构建元数据审计、多个 strategy/vector 验证和 hardened Chrome smoke。两者都必须通过；审计使用精确白名单，并阻断源码/source map、调试语句、常见私钥/API token 格式和未审计文件。静态黄灯不会伪装成失败，但必须在人工 `🚦 Audit Report` 中确认并按需登记技术债；红灯会阻断验证。

WASM 本身保证 byte-for-byte 可复现；`dist` 文件内容由构建流程确定。自动化与人工 Chrome 清单见 [Chrome 验收清单](docs/CHROME-ACCEPTANCE.md)。

## 维护流程

只在本仓库维护；根 CI 运行宿主与兼容包的安全、测试、构建、WASM 及浏览器检查。不存在镜像导出、独立发布或商店版本跟随。

## 安全与行为

广告与追踪拦截默认持续启用。扩展随包提供小型 baseline，联网后从 EasyList、EasyPrivacy、EasyList China 与 Anti-CV 官方文本链接每小时更新；网络规则由 Chrome DNR 持久保存，页面脚本只使用经过验证的选择器数据。状态明确区分 baseline-only、ready、stale 和 error；更新失败保留上一版。用户只能主动选择当前网站暂停 10 分钟，暂停同时移除 DNR、cosmetic 和 scriptlet 效果，随后可恢复。Acceptable Ads 属于广告放行计划，不启用。来源、能力范围见 [规则说明](rules/SOURCES.md)，测试站矩阵见 [测试说明](rules/TESTING.md)。

- Normal Mode 可以展示完整账号并执行 Fill，但 plaintext password 不返回 UI：Popup/浮层只发送 `accountId`，Service Worker 获取所选 credential 后经临时 Content Script 填入页面。只有“全部应用”页连续点击应用图标 5 次进入账号详情后，WebDAV 账号才显示 Reveal 和 Copy Password；当前页面不显示查看入口。
- uNAS/Vault credential 明文密码不写入 `chrome.storage`、日志或持久化文件；WebDAV App Password 和 Vault Key 只以扩展设备密钥保护的密文长期保存，解密后才进入当前运行的认证 secret。查看 WebDAV 密码不依赖系统认证或扩展自有 PIN，入口由“全部应用”页的五击手势限制。
- Legacy 企业门户 是只读兼容数据源；WebDAV 是独立 New Vault。WebDAV 服务器只接收客户端 AES-256-GCM 加密后的版本化 App/Account/Credential objects，不接收明文密码或 Vault Key；WebDAV 连接材料会在本机长期保存并自动恢复。
- WebDAV 修改使用 ETag 对应的 opaque revision token，`If-Match`/`If-None-Match` 冲突会显式失败，不使用 silent last-write-wins。
- Credential panel 的明文凭据 60 秒后自动清除；关闭 Popup、Popup `pagehide` 或移除页面浮层都会清除当前 UI 内存。系统剪贴板不会被自动清空。
- 自动填充只处理当前页面主文档中的可见输入框，不自动提交表单。
- 企业服务请求版号由本地 `LEGACY_PLUGIN_VERSION` 生成到 `runtime-config.json`，可由用户临时覆盖；它仅用于既有服务协议，不跟随任何独立项目发布，不在线查询商店。
- 当前版本不监听 Cookie；若登录状态变化，重新点击扩展打开页面浮层即可刷新。浮层使用 closed Shadow DOM；广告内容脚本不读取正文、表单、Cookie 或页面存储，仅请求当前 frame 的已编译 selector/scriptlet 数据。点击页面外部、按 Escape 或再次点击扩展会关闭浮层。
- uNAS 离线时可点击顶部“一键登录”。前台浮层会显示登录中动画与状态；扩展在后台打开或复用登录页，依次点击“钛动科技”和固定 Tec-IAM 飞书授权页的“授权”，并在两分钟内确认 uNAS 会话，成功后自动刷新身份和当前页账号，同时关闭本次由扩展创建的后台登录标签；用户原有登录标签不会被关闭。账号选择、扫码、验证码、CAPTCHA 或授权内容变化时自动流程停止，需用户手动处理。
- 当前版本不自动清空系统剪贴板。最小权限下无法安全确认剪贴板是否已被用户的新内容替换，强制清空可能误删用户内容。
- 当前页面账号通过本地账号目录匹配：首次同步、目录超过 24 小时或用户点击同步按钮时，扩展会从企业门户拉取已保存应用的地址和账号展示信息。同步请求只使用服务器返回的应用地址，当前标签页 URL 不会发送到企业门户，目录中不保存密码。目录缓存优先按服务端稳定用户 ID 隔离；缺失时使用服务端登录名或邮箱，昵称和姓名不参与隔离。三者均缺失时不执行需要用户身份的目录、应用或凭据请求。
- 账号展示前，Service Worker 会按需检查匹配账号是否存在可用密码；检查结果只保存为 15 分钟会话缓存，Popup 不会在列表渲染时批量接收明文密码；解密失败会显式显示错误而不是伪装成空密码。应用列表只展示至少含一个可用密码的应用，Legacy 与 WebDAV 均在后台完成过滤。Normal 点击“填入”时密码只沿 Service Worker→Content Script 路径进入目标表单；只有五击进入的 WebDAV 账号详情才沿 `revealCredential` 路径返回当前 UI。
- 账号列表完整展示 username/email/phone/account name、备注并允许选择、打开应用和 Fill；当前页面不显示查看按钮，Legacy 企业门户 账号也不显示查看按钮。WebDAV 账号详情由应用图标五击进入，五次点击需在 1.5 秒内完成，计数超时自动清零。
- 凭据只允许填入 HTTPS 页面；填入前会再次确认当前标签页仍属于对应应用，避免切换页面后误填。目录、凭据和 Jupiter 保活消息会绑定当前用户作用域；uNAS 与 Jupiter 网络请求 12 秒超时，超时后返回可读错误。

## 已知限制

- 跨域 iframe 内的登录框不会填充。
- 高度定制的 Shadow DOM、Canvas 或非标准登录控件可能需要单独适配。
- 如果 企业门户的服务端 CORS/Cookie 策略禁止扩展页面直接请求，需要由服务端放行扩展来源，或改为受限的门户页面桥接方案。
- cosmetic 仅支持通用/站点限定静态 selector，以及一个本地实现的 `remove-attr` scriptlet；procedural、复杂 `:has()`、任意 scriptlet、同源视频广告和网页自生成的未知广告位仍可能保留。静态 baseline 不是完整订阅覆盖。
