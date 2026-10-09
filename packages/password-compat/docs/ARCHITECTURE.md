# 扩展架构

## 总览

uNAS 是 Chrome Manifest V3 扩展，由三个运行上下文和共享模块组成。广告与追踪拦截由独立的 DNR、cosmetic content script 和受控本地 scriptlet 模块组成，不进入 Vault 数据流：

```text
Popup / 页面浮层（展示与用户操作）
  → chrome.runtime message
Service Worker（uNAS API、登录辅助、凭据解密、缓存、Jupiter 保活）
  → 用户点击填入后临时注入
Content Script（定位输入框、写值、派发事件，不提交表单）
```

Chrome 的 Declarative Net Request engine 持续执行已下载并持久化的 dynamic rules；Service Worker 启动时检查订阅新鲜度，每小时下载并原子更新规则，每分钟重试清理旧关闭/白名单状态，不为每个 request 执行 JavaScript。订阅生成的 rules 排除固定 manifest extension ID 作为 initiator，因此 extension-origin 的 uNAS/Jupiter/WebDAV 请求不需要写死 WebDAV endpoint 动态规则。网络规则模块不读取 DOM、不收集请求记录。广告 cosmetic content script 是独立的页面层模块，见下文；它不具备密码、Vault 或凭据消息能力。
扩展同时声明一个不超过 100 条的本地 `rules/baseline.json`，仅作为首次离线安装的最低网络保护；四源订阅仍在后台完整下载、转换后以 generation/staging 顺序更新 DNR 与 `unipass_cosmetic_store`。完整 generation 提交后才通知已打开的 HTTP(S) 页面重取 cosmetic 规则；更新的跨 API 失败会恢复旧 DNR generation、保留旧页面数据且不打断现有效果。

广告 content script 在 `document_start`、`all_frames`、`ISOLATED` world 自动运行，只向 Service Worker 请求当前 frame host 对应的已验证 selector/scriptlet 描述。它生成有限长度的本地 CSS，保护密码输入、表单、按钮、可访问性控件和 `unipass-page-overlay`；SPA history 变化触发低频重同步，generation/规则未变时复用已安装 CSS 和本地效果。动态属性处理仅限白名单 `remove-attr`，由单一属性定向 observer 按每秒限流执行。暂停当前网站时，Service Worker 清除当前 tab 的样式和脚本效果；无权限的 frame 正常跳过。该脚本不读取页面正文、表单值、Cookie 或存储，也不发送凭据消息。

用户点击扩展 Action 后，Service Worker 只在当前 HTTPS 标签页临时注入 `content/page-overlay.js`，并在浮层初始化时检测当前页面主题；未手动指定主题时，白色页面使用浅色、深色页面使用暗色。该脚本挂载 closed Shadow DOM 浮层，复用 Popup 的展示控制器；点击页面外部、按 Escape、再次点击 Action 或页面离开时移除浮层。浮层不读取页面内容，只通过消息向 Service Worker 请求会话、目录和用户选中的凭据操作。Manifest 仅向 HTTPS 页面公开浮层所需的三个品牌图标。

离线状态下，Popup 的“一键登录”消息由 Service Worker 交给独立的 `legacy-login.ts` 状态机；它不经过通用 Content Script，也不接触凭据。

构建入口由 `build.mjs` 定义，先以固定 Rust `1.98.1` / `wasm32-unknown-unknown` 工具链构建并复制 `credential-core.wasm`，同时对 workspace、Cargo registry 和 toolchain 路径做 remap；esbuild 使用标准 minification、tree shaking、无 sourcemap 和 `debugger` 清理，并生成非敏感的 `runtime-config.json`。`npm run verify` 是普通门禁，`npm run verify:hardened` 是实际安装目录的独立门禁；后者要求 Binaryen `wasm-opt`（默认缺失即失败），使用 seed 选择有限的等价 reconstruction strategy，并把 `integrity.json`、strategy、hash、size 和 warning counts 写入 `artifacts/hardened/`。`dist/` 只保留运行文件。最终产物审计只允许固定文件清单，并验证 WASM magic/version、无 `name`/`producers` custom section、imports/exports 白名单、原始 key/协议文本、项目 `src/*.rs` path 和 JS 中的旧密码学特征；CI 与 Release 分别执行 normal 与 hardened job，hardened smoke 会先验证外置元数据。

## 模块职责

| 模块 | 职责 | 禁止事项 |
| --- | --- | --- |
| `src/popup/` | Popup/页面浮层的会话状态、目录与账号展示、WebDAV 连接设置、当前页 WebDAV 账号创建和用户点击查看/复制/填入 | 直接调用 uNAS/Jupiter API；列表阶段批量接收明文密码 |
| `src/background/` | 外部请求、uNAS 登录辅助、密码解密、凭据可用性检查、Jupiter 会话、Vault Service，以及独立 always-on blocker reconciliation | 把密码写入持久化存储；无用户选择扩大敏感数据输出；为每个网络请求执行 JS 拦截 |
| `src/background/blocking/` | subscriptions 定义四源固定 URL；filter-updater 下载校验并以 generation/staging 更新 DNR 与 cosmetic store；filter-converter 转换网络规则；cosmetic-compiler 只解析通用/站点 selector 与白名单 scriptlet；rule-compactor 按相同条件合并纯域名规则；site-pauses 管理用户明确的 10 分钟 host 暂停 | 依赖 Vault/WebDAV；记录 URL 或 blocked request；执行远程代码；把未知修饰符降级后继续拦截；生成任意 CSS/HTML/JS |
| `src/background/vault/` | `VaultService` 管理 VaultProfile/session secrets，`VaultCore` 管理 App/Account/Credential CRUD、tombstone 与目录，`EncryptedVaultCache` 保存本地 opaque ciphertext，`VaultSyncEngine` 负责 WebDAV reconciliation，`WebDavBackend` 只保存 opaque encrypted bytes | Backend 不得接触 plaintext、Authorization header 不得离开 Service Worker；Core 不依赖 ETag/Git SHA/SQL version |
| `src/shared/vault.ts` | Vault identity、`AccountRef`、通用模型、`VaultBackend`、opaque revision 与结构化错误 | 不绑定具体存储服务 |
| `src/shared/vault-crypto.ts` | Web Crypto AES-256-GCM、versioned envelope、nonce/key import/export | 不复用 Legacy 企业门户 密文格式；不上传 Vault Key |
| `src/manage/` | 保留的宽屏 Vault 管理界面 | 不读取 Legacy 密码；不直接访问 WebDAV 网络 |
| `src/content/` | `blocking/cosmetic-content.ts` 自动应用当前 host 的静态 cosmetic 数据并限流处理唯一本地 scriptlet；其他脚本仍只在用户点击扩展/填入后挂载浮层或写入标准输入框 | 广告脚本不得访问 Vault/credential 消息；填充脚本不得常驻；不得自动提交、读取或回传页面数据 |
| `src/shared/types.ts` | 跨上下文消息与数据契约 | 包含运行时副作用 |
| `src/shared/url.ts` | URL 规范化、HTTPS 与 path 匹配纯函数 | 依赖 Chrome API 或 DOM |
| `src/shared/api.ts` | uNAS API 包装、响应校验和密码算法 | UI 状态或 DOM 操作 |
| `src/background/credential-core.ts` | 单例加载扩展本地 WASM；校验输入/输出内存范围并释放/清零 WASM 分配；提供 reveal/fill 解密、availability 状态和 ciphertext→Jupiter transformed password | 网络加载代码、持久化密码或让 availability/Jupiter 获取原始明文 |
| `credential-core/` | `abi` 负责分配登记、边界、status 和 exports；`unipass` 负责 AES 解密/UTF-8；`jupiter` 负责 MD5/DES 转换；`secret` 负责 zeroizing secret ownership 与 key reconstruction | 变更 uNAS/Jupiter 协议、暴露给网页或承诺可阻止运行时分析 |

`src/background/service-worker.ts` 只注册 Chrome 事件并路由消息；启动时初始化 blocker，但 blocker 的持续拦截由 Chrome DNR engine 完成，不依赖 Service Worker 常驻。`src/background/blocking/blocker.ts` 清理旧关闭配置与白名单，不提供可写设置消息；filter-updater 保留上一版 dynamic rules 并按小时更新，上游正文不打包。`jupiter-keepalive.ts` 独占 Jupiter 登录、续期、存储和同源页面同步；`user-scope-guard.ts` 统一执行敏感操作前后的 uNAS 用户作用域校验。`VaultService` 将 `legacy-unipass` 与每个 WebDAV `vaultId` 合并为统一目录，但一个 VaultProfile 只有一个 primary backend，禁止双写。WebDAV Vault 初次同步后以 `EncryptedVaultCache` 为 primary runtime copy，`VaultSyncEngine` 在后台处理 dirty/clean/conflict；几个模块通过显式导出连接，消息契约明确区分 Fill 与 WebDAV Reveal。
Vault 同步引擎按 Vault ID 串行执行所有 synchronize/pull 入口，包括首次读取、重连和定时同步；冲突标记只应用于仍匹配快照 local/remote revision 的对象。CSV 导入完成时仅清除密码引用，结果和同步状态保留到关闭对话框。
`src/background/credential-availability.ts` 独立封装凭据可用性并发检查和 15 分钟会话缓存；只缓存三态结果，不返回或持久化明文密码。
`src/background/legacy-login.ts` 只处理用户触发的 uNAS/Tec-IAM 登录：复用或新建一个登录标签页，在两分钟窗口内依次校验并点击唯一的“钛动科技”和“授权”按钮。飞书阶段固定校验 OAuth `client_id`、`redirect_uri`、非空 `state` 和授权文案；离开已知认证 origin、完成授权、关闭标签页或超时后即清除状态。

## 关键数据流

认证边界补充：普通 MV3 扩展无法直接调用 Chrome 密码管理器的系统 PIN/密码弹窗，因此查看 WebDAV 账号密码不再调用系统认证、通行密钥或扩展 PIN。为降低误触，只有“全部应用”页同一应用图标在 1.5 秒内连续点击 5 次才进入账号详情；当前页和 Legacy 企业门户 不提供查看入口。

- 齿轮二级页的密码库选择器只展示“添加密码库”和真实的本地 Profile，两个入口都可自由切换；“添加密码库”中 Vault Key 留空即创建新库，填写则接入远端已有库，内部仍保持 create/existing/reconnect 三条 fail-closed 状态。表单直接提供 HTTPS 地址、用户名和 App Password；用户点击测试或保存时，由同一个 Service Worker 操作申请单一 origin optional host permission 并执行 WebDAV capability 检查；测试完成、保存失败、endpoint 迁移或删除后回收不再使用的 origin。Popup/页面浮层只在用户提交时短暂携带认证信息，不发起 WebDAV 网络请求；保存成功后清空 App Password。新建 Vault 时后台生成 Key、只向当前设置 UI 回传一次供用户安全保存；WebDAV credential 与 Vault Key 通过 IndexedDB 不可导出设备密钥保护的密文长期保存，浏览器重启后自动恢复连接，缺失时才进入重连流程，绝不生成替代 Key 或改写远端对象。查看账号密码仅允许在“全部应用”页五击进入的 WebDAV 账号详情中触发，不依赖系统认证、通行密钥或扩展 PIN。当前页仅将具有可恢复连接材料的 Vault 作为可写入目标；目录同步会单独报告密码库连接失败，不能伪装成 uNAS 应用同步失败。已选 Vault 可经确认从扩展中移除；该消息只由 Service Worker 清除本地 Profile、持久化/会话连接材料和未被其他 Profile 使用的 optional host permission，不删除 WebDAV 远端对象。账号元数据更新只接受可编辑字段，Vault Core 始终保留创建时的 `credentialId` 绑定。当前 HTTPS 页面没有匹配账号时，用户可就地选择已连接 Vault、填写账号和密码；后台按当前 HTTPS 域名创建或复用 Vault App 后写入账号。WebDAV Vault 可在未登录 uNAS 时独立展示和填入，但 Legacy 企业门户 仍要求稳定用户作用域。原有 uNAS 版本 override 保持隐藏兼容路径；Popup 内自派生构建能力已移除。

- Popup 内部按 `popup.ts`（初始化与事件协调）、`catalog.ts`（目录与账号渲染）、`current-page-account.ts`（当前页 WebDAV 账号创建）、`credentials.ts`（短生命周期凭据与填入）、`settings.ts`（主题和隐藏版本兼容）、`webdav-settings.ts`（WebDAV 连接表单）以及 `dom.ts`/`bridge.ts`（UI 基础设施）拆分。`getPluginVersionSettings` 返回本地构建、runtime config 网络基线、当前网络提交及其来源；`setPluginVersionOverride` 仅接受三段数字版号并由 Service Worker 存入 `chrome.storage.local`。网络请求优先使用手动 override，否则读取并缓存 `runtime-config.json`。设置页的“恢复默认”仅在手动版本覆盖非空时可点击；版本保存恢复为普通单次提交，不再响应隐藏三击。“全部应用”页同一应用图标在 1.5 秒内连续点击 5 次后才加载账号详情，详情中仅 WebDAV 账号显示“查看”。当前页不渲染“查看”。
- 页面浮层的 pageContext、页面主题、应用打开和填入消息由 Service Worker 以发送者标签页为准重新校验；页面主题检测仅读取当前 HTTPS 页面的根节点/正文及视口采样点的渲染背景色与 color-scheme，以识别由全视口容器渲染的深色页面；不读取页面正文、Cookie、表单值或页面存储；浮层不能自行指定目标标签页，也不能绕过 HTTPS/origin/path 匹配。

### 当前页面账号

1. Popup 主题检测、页面识别与会话检查并行启动；Service Worker 并行请求 `/login/isLogin` 与 `/session/current_user`，两者均成功且已登录才返回会话；账户页昵称 `nickName` 按用户请求仅传入 Popup 内存，用于用户名悬停提示，绝不持久化或参与身份作用域。Popup 的用户作用域优先服务端稳定 ID，缺失时使用服务端登录名，再回退邮箱；昵称和姓名不参与作用域。三者均缺失时不执行需要用户身份的目录、应用或凭据请求。
2. Popup/页面浮层读取或接收当前 HTTPS 标签页上下文；木星单页应用仅在其已授权的同一 origin 内允许路由变化，其他应用仍要求 origin/path 匹配。
3. Popup 从本地目录缓存匹配应用 origin/path；过期时请求 Service Worker。后台 `legacy-catalog.ts` 按稳定用户作用域复用 15 分钟的完整 Legacy 会话目录，合并并发请求，读取前后校验身份；手动同步强制刷新，失败不覆盖旧目录。当前页使用 `currentPageCatalog`，后台从可信标签页取得 URL，本地匹配应用地址后仅查询匹配应用账号；当前页缓存按规范化 URL 哈希隔离，不覆盖完整目录，已有完整目录优先复用。Legacy 与 WebDAV 目录并行加载；普通读取保留凭据可用性缓存，仅手动同步清除。
4. Service Worker 校验用户作用域后只返回账号展示信息；部分失败会显式标记，不能覆盖完整缓存。
5. Popup 当前页账号和应用列表均只请求凭据可用性；后台返回三态，不返回密码。应用列表由 Service Worker 逐应用读取账号 ID 后过滤，仅返回至少含一个 `available` 账号的应用，并以汇总计数区分空密码、凭据验证失败和账号目录失败。
6. Normal Fill 消息只携带 `AccountRef`（Legacy 兼容时另带其 API accountId）、目标 URL、用户作用域和 Popup 的 `tabId`（浮层由 sender 标签页确定）；Service Worker 在后台获取对应 Vault credential，Legacy 账号标识仍优先使用 `/app/app_config` 的后台响应，缺失时只从后台重新取得的可信账号目录解析。后台先从实时 Legacy 目录或 Vault 账号所属应用取得可信目标，再获取密码；随后经 HTTPS/origin/path/active-tab/document 校验填入 Content Script，Vault targets 随 Fill 消息用于页面复核，不向 Popup 返回 password。
7. “全部应用”页的应用图标由 Popup 使用 1.5 秒计时窗口累计 5 次点击；第 5 次才加载该应用账号详情。独立扩展页详情只为 WebDAV 账号渲染查看按钮，当前页与页面浮层不渲染查看按钮，后台以 sender 的精确扩展 URL 拒绝浮层 Reveal。
8. `revealCredential` 与 Fill 完全分开：Service Worker 只按 `AccountRef` 获取用户选择的 WebDAV credential 并返回 `{ username, password }` 给当前详情 UI；Credential panel 的明文在 Popup 内存中最多保留 60 秒，Normal UI 永远不预取 password。

### Vault 数据流

Browser password migration uses `src/shared/import/csv.ts` and `normalize.ts` to parse user-selected Chrome/Edge CSV without DOM or network coupling. The Popup previews masked records and sends only confirmed normalized records to the Service Worker; `VaultService` maps target + username to existing App/Account objects and calls `VaultCore.createAccount`/`updateCredential`.

1. `VaultService` 为每个 WebDAV `VaultProfile` 创建 `EncryptedVaultCache` 作为 `VaultCore` 的 primary runtime backend，并保留 `WebDavBackend` 作为 sync backend；`vaultId + objectId` 构成业务引用，Legacy 使用固定 `legacy-unipass` vaultId。创建新 Vault 与连接已有 Vault 是两个明确状态机：新设备通过 endpoint + WebDAV credential + Vault Key 读取远端加密 manifest，vaultId 始终来自 manifest，不重新生成。未来 Cloudflare/GitHub 只需实现同一 `VaultBackend`，不改变 Core、Crypto、URL matcher 或 Fill。
2. `VaultCore` 将 App、Account、Credential 分成独立对象。`VaultAccount.username` 是 username 单一事实源，Credential object 只保存 password（读取兼容旧的可选 username 字段）。PROPFIND 目录只加载 App/Account，Credential 只在用户操作或后台可用性检查时按需 GET；当前 URL 始终在本地用 `VaultTarget` 匹配，不发送到 WebDAV。
3. `VaultCrypto` 在 Service Worker 内把对象序列化为 `EncryptedVaultObject` 后才交给 Backend。Backend 只见 ciphertext；WebDAV ETag 被作为 opaque revision，PUT/DELETE 使用条件请求，409/412 返回 `VaultConflictError`。业务删除写入加密 tombstone：Account 删除先 tombstone Credential 再 tombstone Account；有活跃 Account 的 App 拒绝删除。WebDAV 多对象写不具备数据库事务保证，失败会明确暴露并保留可恢复状态。
4. `EncryptedVaultCache` 的 IndexedDB 记录按 `vaultId/objectId` 保存 ciphertext、local revision、remote ETag、`clean`/`dirty`/`conflict` 和更新时间。Core 的读写不等待 WebDAV；本地新增/修改/删除先完成并立即返回，`VaultSyncEngine` 再执行 `If-Match`/`If-None-Match` 上传和 remote-only/remote-changed 拉取。远端拉取先完整取得待下载对象，全部成功后才写入缓存；dirty 与远端同时变化时 fail closed 为 conflict，初次同步未完成时不把部分缓存作为可用目录。tombstone 仍保留在缓存和远端，不能 hard delete 代替业务删除。

### 密码学核心

1. `src/shared/api.ts` 将 `/app/app_config` 的密文交给 Service Worker 内的 `credential-core.ts`；loader 用 `chrome.runtime.getURL("credential-core.wasm")` 读取随扩展安装的资源并缓存实例。实例化失败只映射为通用解密/转换错误，不包含密文、明文或材料。
2. `c_v` 在 WASM 内完成解密、UTF-8、trim/whitespace 判断，只返回 `0=error / 1=false / 2=true`；`c_k` 在 WASM 内完成 ciphertext→AES→MD5→DES→hex，JS 只接收 Jupiter 请求必须的 transformed password。Reveal/Fill 才使用 `c_u` 获取明文。每次调用后 JS 释放输入/输出 WASM 分配，WASM 清零其输入和临时密码学缓冲。ABI registry 将 `c_a` 登记为 `Input`、`into_abi_output` 登记为 `Output`；`c_u`/`c_v`/`c_k` 只接受 `Input`，`c_f` 才能释放两类 allocation，并以 64 个 live allocation 上限 fail closed。
3. ABI 只暴露 `memory,c_a,c_f,c_u,c_v,c_k`，不使用 wasm-bindgen；Rust native tests 与 Node/WASM tests 共同锁定旧协议兼容性。JS string 不能可靠清零，因此代码只限制 reveal/fill 明文引用作用域。

### Jupiter 保活

用户主动启用后，Service Worker 要求稳定用户作用域，每 25 分钟重新获取对应 uNAS ciphertext 并向 Jupiter 提交登录 `POST`，把带用户作用域的会话数据放在 `chrome.storage.session`。新 token 同步到已打开的 Jupiter 页面时只静默更新其同源会话存储，不触发 `storage` 鉴权事件，也不执行页面刷新，避免被前端误判为“退出再登录”。每次 alarm 和标签页同步前都会核验当前 uNAS 用户；检测到切换时停止 alarm 并清除会话缓存。关闭保活也会清除 alarm 和会话缓存。保活不经过 `credentialForAccount` 或原始 password JS 变量，而是直接调用 ciphertext→transformed password 组合操作。外部请求超时为 12 秒。

### uNAS 一键登录

1. Popup 会话请求失败后显示“一键登录”；用户点击时发送 `startLegacyLogin`。
2. Service Worker 复用精确 `/login` 标签页或在后台打开新标签页，并把标签页 ID、阶段和两分钟过期时间写入 `chrome.storage.session`，不改变用户当前前台标签。
3. 登录状态写入后即以 `injectImmediately` 在精确 uNAS 登录页检查并点击唯一“钛动科技”按钮，不等待页面 `complete`；后台标签中页面渲染通过 `MutationObserver` 触发点击，不依赖会被节流的轮询。同标签页跳转至飞书后，同样尽早校验固定 Tec-IAM OAuth 参数、应用名和权限文案并点击唯一“授权”按钮。
4. 一键登录启动后，仍打开的 Popup/页面浮层显示登录中状态，并在其内存生命周期内每秒请求 `/session/current_user`；确认会话后立即刷新身份与当前页账号目录，并关闭本次由扩展创建的后台登录标签。若复用用户已有的精确登录标签，则仅清理跟踪状态而不关闭该标签。浮层关闭或两分钟窗口结束即停止检测。扩展不读取 OAuth code 或 Cookie。异常页面、账号选择、扫码、验证码和 CAPTCHA 留给用户处理。

## 存储边界

| 位置 | 允许内容 |
| --- | --- |
| Popup `localStorage` | 主题、按用户隔离的账号目录展示信息；不含 WebDAV 地址、密码、用户名、App Password 或 Authorization header |
| `chrome.storage.local` | Jupiter 保活配置与结果、手动网络版号覆盖、非认证 VaultProfile（名称、backend、HTTPS endpoint）、按 Vault 的同步 readiness、按 Vault 加密连接材料；不含认证材料、明文密码或 token |
| IndexedDB | 扩展安装级不可导出 AES-256-GCM 设备密钥；按 Vault 保存 opaque AES-GCM ciphertext objects、revision/ETag 与同步状态；不含 plaintext credential、Vault Key 或 WebDAV secret |
| `chrome.storage.session` | 按用户隔离的 Legacy 完整目录展示字段（15 分钟）、凭据可用性状态、Jupiter 会话、WebDAV 用户名/App Password 与当前运行缓存的 Vault Key；随浏览器会话清除，重启后从本地密文恢复 |
| `chrome.storage.session` 登录项 | 当前一键登录的标签页 ID、阶段和两分钟过期时间；不含 Cookie、授权码或用户资料 |
| blocker 状态 | 移除旧 enabled/whitelist；storage.local 仅保存编译代际、订阅更新时间、条数和固定错误摘要，Chrome DNR 保存规则 |
| 内存/消息 | Normal Fill 仅在 Service Worker→Content Script 的短生命周期消息中传递明文；WebDAV Reveal 额外在“全部应用”详情 Popup 内存保留最多 60 秒；不落盘 |

## 变更规则

- 消息字段变化同时更新 `types.ts`、发送端、接收端和测试。
- URL 或权限边界优先写成 `shared` 纯函数并单测。
- 新外部服务必须先定义 host permission、超时、错误语义、敏感数据生命周期和关闭方式。
- Popup 模块职责已拆分；新增功能应归入对应模块，保持入口只负责初始化与事件协调。

## 嵌入式源码入口

`src/legacy/index.ts` 是无启动副作用的宿主入口；只有显式安装才注册登录/Jupiter 事件。Vault Service 通过 CredentialSource registry 获取 Legacy 能力，独立后台在 composition root 注册。维护边界以 [ADR 0021](../../../docs/ADR/0021-unas-only-brand.md) 为准；原嵌入式入口设计仅作为历史参考。WebDAV 共享传输和 URL 规范化位于 `src/shared/webdav-client.ts`、`webdav-url.ts`，不依赖宿主路径。
