# 安全政策

uNAS 是承载新标签页、本地文件、媒体/PDF/ZIP 处理和浏览器权限的 Manifest V3 扩展。安全、隐私与商店合规高于视觉效果、格式覆盖和处理速度。

## 当前支持状态

当前阶段与已验证范围以 [CONTEXT.md](CONTEXT.md) 为准。uNAS 的 UniPass AdBlock/Vault/浮层属于真实扩展能力；其他仍为 mock 的工具不因此获得真实格式、性能或浏览器支持承诺。

## 信任边界

```text
Web page / user Link URL        不可信外部来源
Content Script                 低信任桥
Service Worker                 特权事件路由
New Tab / Workspace page       受信扩展 UI
Application ports/contracts    能力边界
Worker / engine adapter        不可信文件处理边界
User file / archive / media    不可信输入
```

- 所有跨上下文消息校验 schemaVersion、sender、origin、App、任务 owner、payload 大小和允许动作。
- Content Script 消息不能携带任意扩展路由、任意 URL 请求或文件系统命令。
- UI 不直接访问 engine、OPFS 根、文件句柄或扩展特权；能力通过受控 service/adapter。

## 本地优先与数据

- 默认不上传文件、文件名、内容摘要、浏览历史、Link App、任务历史或布局。
- Mock Demo 不读取真实用户文件；演示素材必须自有、生成或有清晰许可。
- `chrome.storage` 只保存设置、Link App、布局和小型摘要；大文件与媒体不进入该存储。
- IndexedDB/OPFS 的数据生命周期、配额、迁移、清理和卸载后果必须向用户说明。
- 输出写入用户明确选择的位置，或在 OPFS 暂存后显式导出；默认不覆盖原文件。当前 File Workspace 的直接子项编辑先要求 App 内确认，再由浏览器单独授予 `readwrite`；只允许不覆盖的新建和非递归删除。
- 上传、同步、遥测、错误上报、账号、云处理或 Native 能力需独立 ADR、数据流、保留策略和明确同意。

## Link App 与远程内容

- V1 Link App 只接受声明式名称、图标引用和 HTTPS URL，点击后在普通标签页打开。
- 禁止 `javascript:`、`data:`、`file:`、`chrome:`、`chrome-extension:` 和未知 scheme。
- 不把远程页面嵌入高权限扩展页面，不让 Link App 获取文件、任务、浏览历史或 `chrome.*` 能力。
- Manifest V3 的 JS/WASM 固定随扩展包分发；禁止远程模块、`eval`、下载后执行或隐藏功能。
- Web-accessible resources 保持最小，不暴露内部 bundle、source map、夹具或用户数据。

## 权限

- required permissions 只包含首发核心功能当下需要的最小集合。
- 当前 required permissions 为 `activeTab`, `scripting`, `clipboardWrite`, `storage`, `alarms`, `tabs`, `declarativeNetRequest`, `downloads`, `system.cpu`, `system.memory`。其中 `activeTab`/`scripting` 只在用户点击 action 后注入页面浮层或用户点击填充时注入一次性填充脚本；`storage` 保存设置、Link App、Vault profile/加密材料和规则状态；`alarms` 驱动规则/Vault/Jupiter 恢复；`tabs` 用于当前页复核和用户触发的页面操作；`clipboardWrite` 仅用于用户点击复制；`declarativeNetRequest` 执行 baseline/dynamic block 与站点暂停规则；`downloads` 仍仅用于用户明确发起的直链下载；`system.cpu`/`system.memory` 仅用于右侧运行状态读取系统 CPU 累计时间与物理内存容量，不读取文件、网络内容或用户数据。
- 固定 host permissions 仅包含 UniPass Portal、Feishu OAuth、Jupiter、EasyList 下载域名和 GitHub Raw 补充规则域；后者仅请求固定仓库 JSON，禁重定向、凭据和 referrer，详见 [ADR 0012](docs/ADR/0012-repository-filter-subscription.md)。`https://*/*` 是 optional host permission，只在用户连接 WebDAV 时请求对应单一 origin。页面 cosmetic content script 只处理规则 CSS/受限 `remove-attr`，不能读取凭据。
- optional permissions 也不得为未来预留；只在用户触发功能时解释并请求。
- `downloads` 随下载 App 核心能力声明；扩展只在用户提交 HTTPS 直链文件后使用，不读取本机下载目录或文件内容。m3u8/mpd 播放清单和网页链接不走该路径；可执行文件仍由 Chrome 的安全检查和用户确认控制。
- host permissions 默认不全域开放；网页资源导入优先使用 `activeTab` 或更窄的用户触发能力。
- downloads、clipboard、contextMenus、offscreen、content script 等逐项记录用途、触发点、拒绝行为和商店披露。
- 不获取或绕过在线 DRM、付费墙、登录、CORS、浏览器警告或站点条款。允许的本地音乐例外只处理用户明确选择且确认有权处理的 KGM/QMC/NCM 文件，不联网获取账号、密钥、封面或元数据，不读取任意路径，不上传或分发原始/解密内容。

### 本地加密音乐处理边界

- 输入必须由用户通过受控文件选择或拖入主动提供；FileRef 只保留不透明引用和授权状态，不能由 UI 传入任意本机路径。
- 解密、格式转换和输出验证只能在本地 Worker/adapter 中执行；禁止远程服务、远程代码、Native Helper、账号登录和在线密钥/元数据请求。
- 原文件只读；输出先进入受控暂存位置，独立验证音频签名、编码、内容和预期摘要后再由用户明确导出，不默认覆盖原文件。
- 测试样本必须是维护者明确有权处理的固定夹具；仓库只保存 manifest、来源、许可证、大小和 SHA-256，不保存真实用户媒体或解密音频。
- 本地容器解密不授予访问在线内容、破解账号授权或分发第三方内容的权利；产品集成仍受 Music Module Gate 约束。

### UniPass Vault 与浮层边界

- Vault 使用 UniPass 现有 AES-256-GCM envelope、Vault Key、PBKDF2 本地解锁、加密 IndexedDB cache、dirty queue、ETag 冲突和 tombstone；明文密码只在后台短暂获取，并在填充/复制路径清理，不进入 uNAS Desktop store、BroadcastChannel、日志或持久化普通 JSON。
- `CredentialSource` 将 WebDAV Vault 与 `legacy-unipass` 分开；Legacy API/Jupiter/旧 AES 解密/WASM 只在 adapter 中注册。禁用 Legacy 不改变 WebDAV Vault、AdBlock、New Tab、Workspace 或浮层的核心构建路径。
- 工具栏 action 没有 `default_popup`；它只针对当前用户点击的 HTTPS tab 注入原 UniPass DOM/CSS 浮层，保持 closed Shadow DOM、外部点击/Escape 关闭和页面主题采样。密码库管理也只在这个用户主动打开的浮层中完成，不再维护独立 `passwords.html` 页面。
- 消息路由只为经过严格校验的 `getCosmeticRules` 请求开放非顶层 frame；其他 UniPass 消息仍要求顶层来源。`removeVault`、`saveWebDavVault`、`updateVaultCredential` 和 `fillFromPopup` 不能由广告 Content Script 调用。
- 原版浮层由 action 注入绑定 `sender.tabId`、`sender.documentId` 的 session capability token；只有持有该 token 的用户浮层可以完成 WebDAV Vault 管理读写，普通网页/广告 Content Script 没有该 token。`fillFromPopup` 仍只接受受信任扩展 UI，浮层填充继续走单独的用户触发路径。
- 两个扩展 ID 不共享本地 storage、IndexedDB 或设备密钥。迁移必须通过用户提供的 WebDAV 连接材料和 Vault Key；uNAS 验证前不删除旧扩展、旧本地数据或远端对象。当前 uNAS 尚未提交维护者签名 key，最终固定扩展 ID 是发布前阻断项。

## MV3 生命周期

- Service Worker 随时可能终止，不保存只存在内存的关键状态，不运行长计算。
- New Tab 可以多实例；真实任务由单一 Workspace owner 管理，消息需验证 owner/lease。
- 同页 App 通过逻辑 mock Workspace 共享任务状态：仅同源 BroadcastChannel、版本与方法/参数白名单、会话/请求匹配、消息大小与并发上限。Chrome 下载由扩展 adapter 调用浏览器本体管理；owner 失联后客户端停止操作，不自动重放写请求。
- Workspace 关闭、崩溃、浏览器退出或扩展更新不能标记假成功；恢复能力必须由实测决定。
- Offscreen Document 只用于官方允许且经探针证明必要的场景，不作为常驻应用逃生舱。

## 格式专项风险

- ZIP：当前受限解压路径仅接受已授权目录中的单个 `.zip`，先检查合法 ZIP magic 字节对，再在 Dedicated Worker 中以严格模式读取；拒绝路径穿越、绝对路径、反斜杠路径、Windows 保留名、软链接、加密条目、NFC/大小写折叠后的重复名及所有条目的文件祖先冲突、超过 200 项、单项 32 MiB、输入 50 MiB 或展开总量 64 MiB。CRC 校验和全部输出暂存完成后才创建新的同级目录；不覆盖既有项目。该实现仍需 SP-04 的完整负向夹具、目标 Chrome 人工、取消/页面关闭与资源测量证据，不能据此承诺通用 ZIP 支持。
- Media：限制输入、像素、时长、帧、并发与 Worker 内存；畸形容器和 WASM 崩溃可取消、可清理。
- PDF：限制页、对象、像素、字体和图片资源；JavaScript、附件、表单和外部引用不被静默执行。
- Image：限制解码后像素和动画帧，验证 EXIF、透明度和输出签名。
- 所有格式同时校验扩展名、MIME、magic/container 和资源预算。

## 输出与清理

- 计算结果先进入 prepared/staged 状态，验证后再 commit/export。
- commit 前取消应回滚；commit 中失败不能标记成功；commit 后取消需说明未生效。
- cleanup 幂等，只删除临时资源，不删除已提交用户文件。
- 所有终态释放 object URL、stream、reader/writer、handle、Worker、lease 和 OPFS 临时对象。

## 视觉与供应链

- 不复制或分发 Apple 字体、图标、壁纸、截图和未授权设计资产；Liquid Glass 只借鉴公开设计原则。
- 锁定依赖版本与完整性；WASM、codec、字体、图标、壁纸和夹具记录来源、许可证、版本与哈希。
- 新依赖说明用途、替代方案、包体、维护状态、CSP、远程资源和许可证。
- 许可证与再分发证据未完成前不得公开发布扩展或二进制资源。

## 不应提交

- `.env`、token、cookie、登录态、浏览器配置、私钥或账号信息。
- 客户文件、个人媒体/PDF、本机绝对路径、真实浏览历史或公司内网地址。
- 未授权图片、字体、音视频、图标、壁纸和 WASM 二进制。
- `node_modules`、构建产物、缓存、日志、崩溃转储和大体积基准输出。

安全边界变化必须同步本文件、相关 ADR 与 [RISK_REGISTER.md](docs/RISK_REGISTER.md)。
