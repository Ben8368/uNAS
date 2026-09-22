# uNAS 产品能力审计矩阵

> 审计日期：2026-09-20。源码基线：`c189b835726b5f9d10dee749faa5ce9562c16c35`，开局工作区干净。
> 本文是该基线的审计快照，不替代 [CONTEXT](../CONTEXT.md) 的当前状态、[Roadmap](ROADMAP.md) 的 Gate、[Development Blueprint](DEVELOPMENT_BLUEPRINT.md) 的执行计划及各 benchmark 的原始证据。下述最小交付项均为建议，尚未实施或批准进入相应 Gate。

> 后续实施注记：SP-04-A 的负向夹具/预检修复、SP-04-B 的预提交取消/暂存清理及 SP-04-C 的受控提交写入失败由 [SP-04](../benchmarks/sp-04/README.md) 记录。下文 ZIP 行已同步这些已验证限定事实；Archive 模块 Gate 仍未关闭。

## 1. 判定方法与结论总表

已读取 [AGENTS](../AGENTS.md)、[CONTEXT](../CONTEXT.md)、[LESSONS](../LESSONS.md)、[Architecture](ARCHITECTURE.md)、[Roadmap](ROADMAP.md)、[Security](../SECURITY.md)，并按路由检查产品、契约、治理、风险、相关 ADR、实际入口、adapter、Worker 和测试。以实际调用链判定能力；组件名称、类型定义、依赖存在或规划目录均不构成实现证据。

实现状态按本次要求使用四类：**已实现**＝存在真实执行路径，仅限所列操作；**部分实现**＝只有有限真实切片或入口不完整；**mock**＝模拟数据/状态，无真实输出；**未实现**＝未找到可执行链路。证据另按治理规则标明“已验证（限定环境）”“已实现未验证”或“计划/不支持”，二者不能互相替代。

| 能力 | 实现状态 | 可真实执行的最窄范围 | 不可据此声称 |
| --- | --- | --- | --- |
| 本地文件 | 部分实现 | 授权目录、逐层列出 metadata、恢复句柄、新建目录/固定内容 Markdown、删除文件/空目录 | 完整文件管理、拖入读取、编辑内容、移动/重命名、回收站、通用导出 |
| ZIP | 部分实现 | 已授权目录内的单 ZIP，经 Dedicated Worker 验证后解压到新同级目录 | 通用 ZIP、ZIP64、创建压缩包、密码包、完整取消/恢复保障 |
| 媒体播放 | 未实现 | 无真实播放器；媒体条目只有文件 metadata 或 mock 资产 | 双击播放、音视频解码、HLS/DASH 播放、codec 支持 |
| 视频转码 | mock；真实引擎未实现 | 残留 Transcode 组件和固定模拟任务，未注册当前 App 入口 | FFmpeg/WebCodecs 转码、remux、VMAF、硬件加速、真实输出 |
| 下载器 | 部分实现 | 符合 URL 后缀白名单的直链交给 Chrome；查询、取消、恢复小型记录 | 网页解析、yt-dlp、资源捕获、HLS/DASH 分片下载/合并、断点恢复承诺 |
| UniPass Vault | 部分实现 | 加密 Vault core/cache、连接管理、当前页新增账号、CSV 导入、目录与填充 | 完整可达的账号 CRUD 管理界面、浮层查看/复制密码、端到端冲突解决、跨重启永久锁定 |
| 广告拦截 | 已实现（受限规则子集） | 静态 baseline、动态订阅 DNR、cosmetic CSS/受限 remove-attr、临时站点暂停 | 全量 ABP/uBO 兼容、任意 scriptlet、全站零误拦截或拦截率保证 |
| WebDAV | 部分实现 | Vault 专用 HTTPS 对象后端与 ETag 同步 | 通用网盘挂载、文件管理器远程目录、任意文件上传下载、服务器全兼容 |

## 2. 实际运行面、权限与证据边界

- 产品只有一个 WXT MV3 扩展。实际代码集中在 `apps/extension`；Architecture 中顶层 `packages/`、`workers/` 是目标结构，当前未创建。真实 ZIP Worker 位于扩展内部。
- [App Registry](../apps/extension/src/appRegistry.tsx) 只注册添加 App、文件管理、下载、设置和日志；`stable`/`beta` 是注册标签，不是能力验收结论。没有 Media、Transcode、独立 Archive 或 Password Manager 的可启动 App。
- [bootstrap](../apps/extension/src/api/bootstrap.ts) 将通用 API 接到 `demoApi`。真实文件通过独立 File Workspace port，下载通过扩展消息 adapter，UniPass 通过独立 background services 接入；不能用全局 `isRealApiRuntime() === false` 推断所有功能都是 mock。
- [inlineWorkspace](../apps/extension/src/runtime/inlineWorkspace.ts) 使用 Web Lock/BroadcastChannel 确定 owner；真实目录写入只允许 owner，其他页只读投影。它的任务快照及 `beforeunload` 判断仍来自 mock；不是覆盖 ZIP/Vault/下载的统一真实 Task Core。
- [background entry](../apps/extension/entrypoints/background.ts) 安装 UniPass hooks 与唯一 [消息路由](../apps/extension/src/runtime/extensionAdapter.ts)。文件/ZIP 不在 Service Worker 中计算，Vault Crypto/同步及广告规则编译则实际在 Service Worker 内执行。无 offscreen、Native Helper、服务端转码或浏览器外常驻任务进程。

权限以 [wxt.config.ts](../apps/extension/wxt.config.ts) 与 [adblock.content.ts](../apps/extension/entrypoints/adblock.content.ts) 为源码事实：

| 项目 | 声明与实际用途 |
| --- | --- |
| required permissions | `activeTab`、`scripting`、`clipboardWrite`、`storage`、`alarms`、`tabs`、`declarativeNetRequest`、`downloads`、`system.cpu`、`system.memory`、`system.storage`、`system.display` |
| 固定 host permissions | `portal.unipass.top`、`accounts.feishu.cn`、`jupiter.tec-do.com`、`easylist-downloads.adblockplus.org` 的 HTTPS 来源；分别涉及 Legacy/OAuth/Jupiter 和过滤订阅 |
| optional host permissions | 声明 `https://*/*`；WebDAV 用户动作请求单个 `${origin}/*`，不是只授权某个 DAV 路径；移除最后一个同源 profile 时尝试撤销 |
| 自动 content script | cosmetic 脚本匹配全部 HTTP/HTTPS，`allFrames: true`、`document_start`、`ISOLATED`。与 action 才注入的 Vault 浮层/填充脚本须分开说明 |
| CSP / 随包资源 | `script-src 'self' 'wasm-unsafe-eval'`；公开资源只有三个图标。`credential-core.wasm` 属 Legacy 凭据能力，不是视频 FFmpeg |
| 文件授权 | File System Access 目录手势授权，与 host/downloads 权限不同；句柄存 IndexedDB，不向网页或跨页投影传递 |

不能把 Architecture 的一般描述“不默认全站注入”套用到已融合的 cosmetic 脚本，也不能把早期 SP-01/SP-02 的“manifest 仅 storage”当成当前权限清单。相关融合决策见 [ADR 0009](ADR/0009-unipass-capability-integration.md)。

## 3. 本地文件矩阵

| 项目 | 审计事实 |
| --- | --- |
| 已实现 / mock / 缺口 | 真实：`showDirectoryPicker({mode:'read'})`、已授权目录导航、metadata 列表、目录句柄保存/恢复/忘记；明确开启写入后新建直接子目录、写入初始内容 `# 新文档\n` 的 Markdown、非递归删除。旧虚拟文件树及其他通用文件 API 仍为 mock。未找到真实内容编辑、批量复制/移动/重命名、拖入、回收站或通用 FileRef 导出链 |
| 执行位置 | Files UI → `fileWorkspacePort` → owner 扩展页的 real adapter → File System Access / IndexedDB。目录枚举和写入在 owner 页，不在 Service Worker 或 Dedicated Worker |
| 生命周期 | IndexedDB `unas-file-workspace-v1` 保存一个活动目录句柄；恢复先 query permission，重新进入 App 内只读。失权需要用户重选。客户端仅请求列表/快照，owner 丢失后拒绝操作，不重放写入；恢复句柄不等于恢复未完成文件任务 |
| 权限、数据流 | 默认只读；App 确认后再请求浏览器 `readwrite`。子路径必须命中已遍历 route map，不暴露本机绝对路径。列表调用 `getFile()` 获取 metadata，浏览不会读取内容字节；ZIP 是显式内容读取例外。文件留本机，跨页只传 metadata；删除直接生效，不进入回收站 |
| 限制与性能 | 单目录最多枚举 200 项后截断，再排序/筛选；不是全目录分页或全盘搜索。名称校验 120 字符。目录投影最多 16 个待响应请求，超时 5 秒，JSON 字符串长度上限 200,000（变量名为 bytes，实际不是 UTF-8 字节计数）。没有目录规模/延迟/内存基准或配额压力阈值 |
| 验证等级 | SP-02 已验证限定的授权/存储边界：Chrome for Testing 151.0.7922.34、Windows 的小字符串 IDB/OPFS 与 OPFS handle 替身；2026-09-09 维护者记录原生 picker、授权/恢复、冲突与非递归删除人工通过。不能外推到后加的 ZIP 或未实现操作 |
| 下一步最小交付 / 阻断 | 建议先补真实文件只读 intake/资源引用和一个可验证导出闭环，再接工具。缺 FileRef 接入、输出验证/提交、取消/清理、输入规模证据；Files + Image 阶段仍需 SP-03 / RISK-005 / G2-Core，不因目录已可用自动通过 |

源码：[File Workspace port](../apps/extension/src/api/fileWorkspace.ts)、[real adapter](../apps/extension/src/api/real/fileWorkspace.ts)、[LocalDirectoryPane](../apps/extension/src/apps/file-manager/LocalDirectoryPane.tsx)。证据：[SP-02](../benchmarks/sp-02/README.md)、[目录 E2E](../apps/extension/e2e/fileWorkspaceDirectory.spec.ts)、[存储 E2E](../apps/extension/e2e/fileWorkspaceStorage.spec.ts)。

## 4. ZIP 矩阵

| 项目 | 审计事实 |
| --- | --- |
| 已实现 / mock / 缺口 | 文件管理器有真实单 ZIP 解压。没有独立 Archive App、ZIP 创建、列表预览/选择性解压、覆盖冲突处理、分卷/密码输入；RAR/7z/TAR 和修复不支持。不能把 zip.js 自身功能当成产品功能 |
| 执行位置 | owner 页读取选定 ZIP → 随包 `archive-worker.js` → zip.js `ZipReader`；禁用 zip.js 内部 Worker。Worker 逐项发 Blob，owner ACK；全部校验后 owner 页创建同级目录并写入 |
| 生命周期 | prepare 期间取消会立即终止 Worker、断开回调并释放 owner 对暂存 Blob 的引用；Files 窗口卸载与 `pagehide` 请求同一取消。提交前清除 `activeExtraction`，提交阶段没有取消。没有 checkpoint、统一真实 Job 终态或恢复机制；浏览器标签/进程强制终止及提交期间关闭没有验收。App 按钮忙状态约束当前 UI，但 adapter 的单次锁只覆盖 prepare，不是完整提交互斥 |
| 权限、数据流与安全 | 需要已授权目录及写入模式；`.zip` 后缀加前四字节 magic 初筛，再严格解析、路径检查和 CRC。拒绝加密、软链接、穿越、绝对/反斜杠/保留名路径、重复名和文件祖先冲突。Blob 暂存在内存，未落 OPFS；通过全部检查才选择新目录，不主动覆盖。写入失败保留部分输出并报错；不是原子提交或完整回滚 |
| 限制与性能 | 输入 50 MiB、200 项、单文件展开 32 MiB、总展开 64 MiB、深度 12、路径段 120 字符、原始路径 2,048 字符；最多尝试 100 个输出目录名称。是代码拒绝阈值，不是测得的舒适性能。条目先 `getEntries()`，输出先生成 Blob 后核对大小；没有实测峰值内存、CPU/耗时 watchdog 或整体内存硬封顶证据 |
| 验证等级 | 已实现未验证（模块 Gate 未过）。SP-04-A 已在 bundled Chromium/Windows/解包 MV3 验证损坏/CRC、路径、标记和声明资源超限的提交前拒绝；SP-04-B 已验证预提交取消、Files 窗口关闭、Worker 终止及失败后合法 ZIP 恢复；SP-04-C 已验证提交阶段第二文件写入失败、部分输出提示及后续唯一目录恢复。完整扩展 E2E 49/49、0 skipped；`pnpm verify` 与相关组成门禁需以当前基线重新记录。仍缺 ZIP64、实际解码膨胀/峰值内存、原生目录写权限、浏览器标签/进程关闭、Worker 崩溃、配额失败、原子提交/回滚和目标 Chrome Stable 人工验收 |
| 下一步最小交付 / 阻断 | 优先独立设计实际浏览器标签/进程关闭探针或受控资源/配额压力证据；两者均须保留 RISK-007。不得因 SP-04-A/B/C 或 zip.js 功能扩大格式范围或宣称通用 ZIP 可用 |

源码：[文件提交入口](../apps/extension/src/api/real/fileWorkspace.ts)、[prepare adapter](../apps/extension/src/api/real/zipExtraction.ts)、[Worker](../apps/extension/src/workers/archiveExtraction.worker.ts)、[zipSafety](../apps/extension/src/archive/zipSafety.ts)。证据：[SP-04](../benchmarks/sp-04/README.md)、[ZIP E2E](../apps/extension/e2e/archiveExtraction.spec.ts)、[安全单测](../apps/extension/src/archive/zipSafety.test.ts)。

额外边界：入口现在按三种合法 ZIP magic 字节对匹配，仍不能单独证明 ZIP 可解析；Worker 严格解析仍是后续检查。路径预检已拒绝 NFC/大小写折叠别名和文件祖先冲突；跨文件系统的完整别名矩阵与外部并发创建同名目标仍无证据。以上是源码观察及待验证项，本轮未用用户目录复现。

## 5. 媒体播放矩阵

| 项目 | 审计事实 |
| --- | --- |
| 实现状态 | 未实现。产品源码检索未找到 `<video>`、`<audio>`、`HTMLVideo`、`MediaSource`、`canPlayType` 或播放器对象 URL 链；App Registry 没有播放器。mock 视频/音频资产和下载白名单不是播放能力 |
| 执行位置与生命周期 | 没有实际播放运行面、解码会话或播放恢复；无法声称在 New Tab、Workspace 或后台播放 |
| 权限与数据流 | 没有从授权 File/Blob 到播放器的接入；当前也没有远端媒体请求、清单解析、DRM 或音视频解码链。未来本地播放应通过受控文件 port，不能把路径字符串当文件访问授权 |
| 性能与资源 | 未验证任何容器/codec、seek、时长、分辨率、帧率、内存、首帧或后台行为；不存在当前可承诺的播放大小上限 |
| 下一步最小交付 / 阻断 | 建议先做一个合成本地文件的原生播放隔离探针，记录加载、seek、损坏输入、页面关闭和 object URL 释放。依赖真实只读 FileRef/Blob 接入及精确 Chrome 夹具证据；远程流媒体另受 RISK-013 限制 |

源码依据：[App Registry](../apps/extension/src/appRegistry.tsx)、[mock 资产](../apps/extension/src/api/demo/runtime.ts)、[Files real adapter](../apps/extension/src/api/real/fileWorkspace.ts)。规划与门禁：[Media 策略](ARCHITECTURE.md)、[SP-06](DEVELOPMENT_BLUEPRINT.md#sp-06-media-native)、[RISK-006/013](RISK_REGISTER.md)。

## 6. 视频转码矩阵

| 项目 | 审计事实 |
| --- | --- |
| 实现状态 | mock。`TranscodeApp` 有参数/批任务 UI，但未注册；`submitTranscodeJob` 只创建模拟 job，`probeTranscodeSource` 返回固定 H.264/AAC、1920×1080、86 秒 metadata。预设、命令预览、体积估算及 VMAF 选项不执行媒体处理 |
| 执行位置与生命周期 | 如调用该组件，走扩展页 mock API/逻辑 Workspace；模拟时钟推动状态，无真实文件输入输出、媒体 Worker、编码任务取消或恢复 |
| 权限与数据流 | 没有 FFmpeg/WebCodecs adapter、demux/mux、WASM media core 或网络转码服务。现有 `credential-core.wasm` 不属于媒体。mock 输出 token/路径不代表磁盘文件 |
| 性能与资源 | 没有编码吞吐、冷/热启动、峰值内存、线程数、并发、质量或最大文件证据；固定 CPU/GPU/网络仪表数据不可作为资源监测 |
| 下一步最小交付 / 阻断 | 按 SP-06 先验证一个短片段的最窄原生处理路径及输出播放性，再决定 SP-07 的 ffmpeg.wasm 兼容路径；需容器/codec 探针、时序/音画同步、Task/Worker/输出契约、资源预算与取消清理。RISK-006/013 和 Media Gate 未解除 |

源码：[TranscodeApp](../apps/extension/src/apps/TranscodeApp.tsx)、[demo API](../apps/extension/src/api/demo.ts)、[依赖清单](../apps/extension/package.json)。不得把仅声明的参数或库候选写成支持格式。

## 7. 下载器矩阵

| 项目 | 审计事实 |
| --- | --- |
| 已实现 / mock / 缺口 | 真实直链：白名单后缀的 HTTPS URL，及 `localhost`/`127.0.0.1`/`[::1]` 的 HTTP URL。网页链接仍生成 mock；`.m3u8`/`.mpd` 不进入真实直链路径。无捕获器、站点 extractor、yt-dlp、分片抓取/mux、真正的自定义输出目录或自动重试 |
| 执行位置 | 下载 UI → `browserDownloads` → Service Worker 消息路由 → Chrome downloads API；传输由浏览器本体负责，字节不进入 Workspace/ZIP Worker |
| 生命周期 | `downloads.download({conflictAction:'uniquify',saveAs:false})` 后保存 ID/URL/创建时间；重新打开 App 查询自有 ID 恢复列表，每 2 秒查询状态。关闭 App 不拥有/取消浏览器传输；浏览器退出、断网、扩展重载期间续传没有本仓库的专项证据 |
| 权限、数据流与安全 | required `downloads`，只允许当前扩展顶层 New Tab/Workspace 发起；查询/取消限已登记 ID。URL 会发送至目标服务器，并完整保存在 `storage.local` 和 UI 记录中，可能包含 query token；这不是“无网络”。忘记仅删 uNAS 记录，不删下载文件/Chrome 历史；Chrome 安全检查仍适用 |
| 限制与性能 | URL 最多 4,096 字符，最多保存 200 条，超出会丢弃旧登记。无显式传输文件大小/带宽/并发硬预算；串行提交不等于传输并发限制。通过后缀路由，不验证响应 MIME/magic、重定向结果或内容可播放性 |
| 验证等级 | 真实路径有自动化证据：E2E 本机 HTTP 服务返回 32 KiB 固定字节、命名 sample.mp4，观察完成及 App 重开后记录。它不是真实 MP4 夹具，也未校验落盘文件内容；不能证明 HTTPS 鉴权站点、codec、吞吐或大文件。当前单元测试通过；历史 E2E 本轮未重跑 |
| 下一步最小交付 / 阻断 | 建议补隔离直链下载的内容哈希、取消/中断与重启恢复证据，并明确记录 URL 的保留/脱敏边界。可独立于媒体引擎；网页/流媒体能力仍受 RISK-013 和 SP-06/SP-07 阻断 |

源码：[URL 与前端 adapter](../apps/extension/src/runtime/browserDownloads.ts)、[后台实现](../apps/extension/src/runtime/extensionAdapter.ts)、[任务恢复/轮询](../apps/extension/src/apps/downloader/useDownloaderTaskData.ts)、[UI](../apps/extension/src/apps/DownloaderApp.tsx)。证据：[单测](../apps/extension/src/runtime/browserDownloads.test.ts)、[直链 E2E](../apps/extension/e2e/extension.spec.ts)。

## 8. UniPass Vault 矩阵

| 项目 | 审计事实 |
| --- | --- |
| 已实现 / mock / 缺口 | 真 core：manifest/app/account/credential AES-GCM 对象、增删改、tombstone、加密本地 cache/dirty/conflict。当前可达浮层：新建/接入/重连/移除 Vault、目录/账号选择、当前页新增账号、手动 CSV 导入、账号复制与填充。完整管理 CRUD 代码有残留 `manage.ts`，但无对应 WXT 管理页入口；浮层显式禁止 reveal，因此不能宣称查看/复制密码已可用 |
| 执行位置 | action 点击后在当前 HTTPS 页注入 closed Shadow DOM UI；管理/查询/填充请求进入统一 Service Worker。Web Crypto、Vault Core、IDB 与 WebDAV 同步实际在后台；CSV `file.text()`/解析在浮层上下文，未移入 Worker |
| 生命周期 | 浮层关闭/Escape/外点/页面销毁时清理 UI 敏感字段；cache/profile 持久存在。Vault 每 5 分钟 alarm、后台安装初始化/浏览器启动、目录访问及写操作触发同步；不是常驻进程或可靠 5 分钟 SLA。每库同步与配置变更在当前 Service Worker 内串行，队列本身非持久事务 |
| 加密与持久化 | 对象为 AES-256-GCM，随机 12-byte nonce，AAD 绑定 id/kind/keyVersion；Vault Key 为 32-byte。profile/endpoint 明文在 storage.local；连接材料以设备密钥加密后存 local，设备 CryptoKey 在独立 IDB（不可导出），当前会话材料在 storage.session。PBKDF2-SHA-256 310,000 次、16-byte salt 的本地解锁路径为兼容实现，非当前连接必经步骤 |
| 锁定边界 | `lockVault` 删除 session map 中的材料，保留持久化 envelope；session map 存在时阻止自动恢复，缺失时从设备加密材料恢复。因此不能承诺每次浏览器重启都要求主密码。无 IndexedDB 环境还有把 raw 设备 key 的 Base64 放 storage.local 的 fallback；不能把整个源码描述成硬件/OS 密钥库保护 |
| 消息与明文 | Vault mutation 限受信扩展 UI 或 tabId/documentId/token 匹配的 action 浮层。填充另做账号所属 target、当前 active HTTPS 页、异步取凭据前后 URL/Legacy userScope 复核，并按注入 documentId 发消息。明文会短暂经过后台与填充脚本、最终写入目标网页表单；CSV 明文也会经过浮层和 runtime 消息。closed Shadow DOM 不是网页表单填入后的保密边界，清空 JS 字段不等于可证明的内存擦除 |
| 资源与性能 | 没有 Vault 数量、对象大小、账号总数、cache 总量、导入 CSV 大小/行数的明确预算；CSV 预览只显示 100 条，不是导入上限。cache/catalog 有全量读取/解密路径。兼容解锁连续失败 5 次后会话锁定。没有加解密/导入/查询耗时或峰值内存基准 |
| 验证等级 | 配置串行化、同步/cache、来源校验有合成 backend/storage 单元测试；配置测试 mock 了 VaultCore、加密和持久密钥，未找到真实 Core/crypto 往返的专项测试。历史浮层 E2E 用 HTTPS 拦截页、直接注入脚本/合成凭据验证 DOM 填充和关闭，绕过真实 action 手势与取密链。不能推导“真实 Vault → 用户 action → 匹配页面填充”的完整链已验收；RISK-014 仍开放 |
| 下一步最小交付 / 阻断 | 建议用合成 Vault/账号补真实 action 手势到受控 HTTPS 表单的完整填充及导航中止证据，再决定管理 CRUD 入口的收敛方式。依赖可运行的隔离目标 Chrome、手势/可选权限与远端冲突证据；公开发布另受资源许可和固定扩展 ID 阻断 |

源码：[Vault service](../apps/extension/src/unipass/background/vault/vault-service.ts)、[Core](../apps/extension/src/unipass/background/vault/vault-core.ts)、[对象加密](../apps/extension/src/unipass/shared/vault-crypto.ts)、[持久连接材料](../apps/extension/src/unipass/background/vault/persistent-secrets.ts)、[本地解锁](../apps/extension/src/unipass/background/vault/local-unlock.ts)、[浮层与填充](../apps/extension/src/unipass/background/page-overlay.ts)、[权限路由](../apps/extension/src/unipass/background/service-worker.ts)、[reveal 限制](../apps/extension/src/unipass/popup/credentials.ts)、[CSV 导入](../apps/extension/src/unipass/popup/import-passwords.ts)。

证据：[Vault 同步审查](archive/reviews/2026-09-20-vault-sync-review.md)、[配置测试](../apps/extension/src/unipass/background/vault/vault-configuration.test.ts)、[浮层 E2E](../apps/extension/e2e/unipass-integration.spec.ts)、[安全单测](../apps/extension/src/unipass/background/service-worker.security.test.ts)。移除 Vault 会删本地 profile/连接材料并尝试清理 cache、撤销未使用权限，不删除远端密码库；cache 清理失败是 best effort。Legacy adapter 目前在后台启动时默认注册；“可删除/可分离”不等于当前已禁用。它涉及 Portal/Feishu/Jupiter 与随包 WASM，不能把其登录态、远端 API 或保活数据流混入纯 WebDAV 离线声明。

## 9. 广告拦截矩阵

| 项目 | 审计事实 |
| --- | --- |
| 已实现 / 缺口 | 静态 baseline 随包启用；四个固定订阅 EasyList/EasyPrivacy/EasyList China/anti-cv 转换为动态 DNR，支持有限 block/allow/resource/domain 规则；cosmetic CSS 加固定 remove-attr 实现。regex、redirect、CSP、removeparam、procedural 等语法跳过，不是完整广告规则引擎 |
| 执行位置 | DNR 拦截由浏览器执行；Service Worker 拉取、解析/压缩、安装规则并保存状态；每个 HTTP/HTTPS frame 的 isolated content script 应用 CSS/MutationObserver。不是页面后台媒体任务 |
| 生命周期 | 后台初始化/启动/安装恢复，规则更新 alarm 每 60 分钟检查，fresh 期限 1 小时；状态 reconcile 每 1 分钟。站点暂停 10 分钟，最多 50 个。更新先取齐数据、stage cosmetic 再写 DNR，失败尝试保留/回滚旧代；跨 DNR/storage 的异常回滚不是数据库事务 |
| 权限与数据流 | DNR/storage/alarms；后台只向固定订阅域下载过滤文本，`credentials:omit`、`redirect:error`、`no-referrer`。cosmetic 请求由后台取 sender URL 的 hostname，不接受任意地址 fetch；允许严格 getCosmeticRules 子 frame 请求。远程规则是数据，remove-attr 是随包固定解释器，非远程脚本执行；Vault 管理 token 不由 cosmetic 请求授予 |
| 限制与性能 | 每订阅最大 5 MiB、20 秒超时；四源并发拉取后合并编译。动态规则代码预算 30,000；全局 selector 1,500、站点组 2,000、每站 selector 100/scriptlet 10，selector 512 字符；cosmetic store 1,000,000 bytes，style 名义预算 300,000，mutation 最多 4 次/秒。没有真实页面 CPU/内存/误拦截率/拦截率基准；数量上限不等于性能合格 |
| 验证等级 | 真实运行链存在，构建与整合测试有历史通过记录；未找到独立的 DNR 网络阻断/cosmetic 全链效果与重启/订阅回滚专项 benchmark。不能用 manifest 声明或整套 UI E2E 通过替代拦截效果验收 |
| 下一步最小交付 / 阻断 | 建议建立隔离固定规则的 HTTPS 合成页，验证命中/例外、frame、站点暂停恢复、订阅失败保留旧规则与 worker 重启；不依赖真实用户网页或 Vault。目标 Chrome、固定可再分发规则夹具与 RISK-009/014 的发布项仍需证据 |

源码：[静态规则](../apps/extension/public/rules/baseline.json)、[订阅及限额](../apps/extension/src/unipass/background/blocking/subscriptions.ts)、[更新器](../apps/extension/src/unipass/background/blocking/filter-updater.ts)、[转换器](../apps/extension/src/unipass/background/blocking/filter-converter.ts)、[cosmetic 编译器](../apps/extension/src/unipass/background/blocking/cosmetic-compiler.ts)、[content 生命周期](../apps/extension/src/unipass/content/blocking/cosmetic-content.ts)、[站点暂停](../apps/extension/src/unipass/background/blocking/site-pauses.ts)。

## 10. WebDAV 矩阵

| 项目 | 审计事实 |
| --- | --- |
| 已实现 / 缺口 | Vault 专用 backend：PROPFIND Depth 0/1、缺目录时 MKCOL、GET、带 If-Match/If-None-Match 的 PUT、带 If-Match 的 DELETE。对象限定 `objects/<id>.json`/manifest；密码删除主路径用加密 tombstone，不是远端物理删除。没有通用目录浏览挂载、MOVE/COPY、Range/分块传输或下载器 WebDAV 路由 |
| 执行位置与生命周期 | 用户浮层连接 → Service Worker Vault service → HTTPS DAV；同步每库排队、先上传 dirty，再列出和拉取变化对象。IDB 保存 dirty/conflict/revision，SW 重启可重新发起同步；请求/事务无通用取消、checkpoint 或后台完成 SLA |
| 授权与数据流 | endpoint 必须 HTTPS，拒绝 URL 内账号密码/query/hash；用户授权对应 origin。Basic 用户名/App Password 发送给该服务器；Vault 内容上传前加密，服务器仍可见对象 ID/kind/版本 envelope、大小及访问时序。GET/PROPFIND 返回内容全量读入内存，XML 列表解析后只用合法对象 ID 构造请求，不直接跟随 DAV href |
| 安全与同步语义 | 读写要求 ETag，PUT 409/412 转 conflict；下载暂存后按本地 revision 比较接收，保护并发本地修改。列表含对象但 GET 缺失会失败，保留旧缓存。冲突仅标记/显示，未找到选择本地/远端或合并的完整解决流程；远端缺项也标记冲突，不能宣称多端自动无损合并 |
| 限制与性能 | 共用 fetch 12 秒超时覆盖响应体读取；无响应体字节上限、列表项上限、缓存总量预算或同步整体超时。逐对象请求且 pull 暂存所有待下载对象，cache 使用 getAll，不能声称流式/低内存/大 Vault 支持。fetch 未显式禁止重定向，不能照搬广告订阅的 redirect:error 边界 |
| 验证等级 | 合成 backend/cache 单测覆盖丢失对象、部分计数、revision 冲突、并发编辑保护与重试；真实 WebDavBackend 加 mock fetch 的单测覆盖 GET/list 响应体超时、401、返回字节/ETag 保留。不是实际服务器 HTTP/认证/ETag 兼容性证据。真实服务的 401/403/405/409/412、权限手势、重定向、慢响应、多端冲突和中断恢复尚缺完整验收 |
| 下一步最小交付 / 阻断 | 建议实现可复现的合成 HTTPS DAV 服务器 fixture，驱动真实 WebDavBackend 验证 ETag/条件写/缺项与断网恢复，随后再设计对象/列表/导入预算。RISK-014 仍开放；通用 WebDAV 文件管理是新增范围，不能当作现有 backend 的界面包装直接交付 |

源码：[WebDavBackend](../apps/extension/src/unipass/background/vault/webdav-backend.ts)、[URL/target 边界](../apps/extension/src/unipass/shared/url.ts)、[fetch 超时](../apps/extension/src/unipass/shared/fetch.ts)、[同步引擎](../apps/extension/src/unipass/background/vault/sync-engine.ts)、[加密缓存](../apps/extension/src/unipass/background/vault/local-cache.ts)。测试：[同步测试](../apps/extension/src/unipass/background/vault/sync-engine.test.ts)、[fetch/Backend 测试](../apps/extension/src/unipass/shared/fetch.test.ts)。

特别说明：UI 的“测试 WebDAV 连接”会调用 `connect()`，必要时创建远端根目录及 objects 目录，并非纯只读探测。本轮没有调用该功能，没有连接真实 DAV，也未读取/修改任何密码库。

## 11. 客观证据、限制与审计观察

| 证据 | 可以证明 | 不可外推 |
| --- | --- | --- |
| 本轮 `pnpm test:demo` | 32 个测试文件、153 个测试通过（Vitest 报告 3.35 秒）；现有单元/组件/合成 service 测试在当前源码下通过 | 不是媒体处理耗时、真实 DAV 兼容或系统 Chrome 验收 |
| 本轮 `node scripts/governance-docs-check.mjs` | 文档结构、链接、入口预算等检查通过 | 不是能力/安全/性能证明 |
| 本轮 `git diff --check` 与范围核对 | 格式检查通过；仅新增本文 | 没有修改业务代码、用户数据或密码库，没有 Git 提交/推送/发布 |
| [SP-01](../benchmarks/sp-01/README.md) | 早期 MV3 壳层、mock owner、storage 与唤醒的限定自动化/人工证据 | 不覆盖后接入的真实 ZIP、Vault 同步或 Worker 任务恢复 |
| [SP-02](../benchmarks/sp-02/README.md) | 小 payload IDB/OPFS 持久化；当时存储 estimate 为 usage 9,983 B、quota 10,737,428,223 B | 不是文件支持上限、永久配额或当前用户剩余空间 |
| [SP-04](../benchmarks/sp-04/README.md) | 单条真实 ZIP Worker 正向路径 | 不关闭 RISK-007 |
| [2026-09-20 历史验证](archive/reviews/2026-09-20-theme-debt.md) | `pnpm verify`、bundled Chromium 151.0.7922.34/Windows 的 46/46 E2E；当时 MV3 包 946,391 B、初始静态 JS 261,012 B | 本轮未重跑 build/E2E；包体不等于运行内存/吞吐。系统 Chrome 153.0.8010.37 的 5 项定向用例等待 SW 超时，未验证 UI |

本轮不触发真实文件写操作、解压、下载、Vault 导入/同步、浏览器日常 profile 或外部账号请求。现有单元测试使用隔离 mock/合成存储；真实能力结论主要来自源码与已归档限定证据。没有为填满矩阵虚构帧率、耗时、内存、最大文件或兼容性。

需要在后续工作中保持可见的差异：

1. **通用真实任务治理尚未闭环。** ZIP 是 port/Worker 切片，下载归 Chrome，Vault 归 SW；不能套用设计中的统一 Task Core、staged commit、lease 和终态恢复来描述全部实现。
2. **校验强度因消息分支而异。** 下载有 URL/ID/sender 校验，cosmetic 有严格请求限制，Vault mutation 有来源 capability；`isUniPassMessage` 本身只检查对象与 type 白名单，没有通用 schemaVersion、payload 大小和所有字段 schema。不是 Security 中理想消息模型的全面实现证明。
3. **存在已实现但缺消费入口的代码。** 转码组件、旧管理页、密码 reveal/复制路径不能按“源码函数存在”计为当前用户可达能力；PBKDF2 兼容本地解锁也不能遮蔽设备密钥自动恢复路径。
4. **“本地优先”不等于全产品无网络。** 本地文件/ZIP 留本机；直链下载、广告订阅、授权后的加密 DAV 同步、Legacy/OAuth/Jupiter 有不同网络与身份边界。权限、数据流披露须按这些路径区分。
5. **资源常量不是性能证据。** ZIP 预算没有覆盖完整进程内存；Vault/DAV/CSV 尚缺输入和总量预算；mock 仪表盘中的 CPU/GPU/网速完全排除出性能结论。

以上为本次快照观察，不新增风险 ID、不关闭 Gate、不改写 Context 或技术债。风险权威位置仍为 [RISK_REGISTER](RISK_REGISTER.md)，实现妥协跟踪仍为 [TECH_DEBT](TECH_DEBT.md)。

## 12. 下一项可独立实施的工作包

**建议：SP-04-A — 受限 ZIP 的真实 Worker 负向夹具验证。** 这是 [既有 SP-04](DEVELOPMENT_BLUEPRINT.md#sp-04-archive-zip) 的候选子包；本次只提出建议，正式排期与执行拆分仍进入 Development Blueprint。

| 字段 | 建议范围 |
| --- | --- |
| 目标 | 证明不安全/损坏输入在真实 Dedicated Worker 路径中失败，并且失败前未创建目标输出；为现有解压切片补证据，不增加格式或功能承诺 |
| 输入与产出 | 使用程序生成的小型 ZIP/非 ZIP，固定内容、哈希、预期结果；扩展现有 archiveExtraction E2E 和必要安全测试，证据归入 SP-04。覆盖合法对照、伪后缀/非法头、CRC 损坏、穿越、加密/软链接标记、重复/祖先冲突、超条目/声明展开预算 |
| 执行边界 | 隔离临时浏览器 profile 与 OPFS 测试目录；只能操作自己生成的 fixture；不接触真实目录、密码库、网络服务或新增权限。炸弹测试用小型声明/边界夹具，设置测试超时，不构造无界资源耗尽 |
| 验收 | 失败输入无输出目录、无成功提示；合法对照内容精确一致；失败后可以再次执行合法 ZIP；记录浏览器/OS/输入哈希/命令/失败原因。现有 `pnpm verify` 与受影响 E2E 通过；原生目录/目标 Chrome 未跑项仍明确列出 |
| 依赖与阻断 | 已有 Worker/adapter/OPFS E2E 可复用，无 Image、Media、WebDAV 或真实账号依赖。系统 Chrome 启动入口尚有历史超时，可先取得 bundled Chromium 有限证据，但不得写成目标 Chrome Gate 通过；若暴露缺陷，先记录并另行授权修复，本轮审计不改业务代码 |
| 明确不包含 | ZIP 创建/ZIP64 支持、完整提交事务、性能定标、页面关闭恢复、通用 Task Core 重构或宣布 RISK-007 已关闭 |
