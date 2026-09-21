# SP-09 Music encrypted-container 来源与浏览器可行性

## 本轮范围

本轮基于 `main` 最新计划完成 MD-01（来源与供应链锁定）和 MD-02（格式识别探针），并补做隔离的本地解密 smoke test、Worker/OPFS 浏览器验证和 Beta Tool App 接入。已注册 `music` Beta Tool App；没有修改文件管理右键菜单，没有引入第三方源码、WASM、KGG 数据库、Native Helper 或远程资源。

探针的 `已验证` 只表示“在固定输入上识别出结构并通过预算检查”。Beta App 的输出状态进一步区分为“音频签名级验证”：Worker 只检查解密输出的音频 magic/signature，不等同于完整音频解码验证。本节的浏览器结果表示独立 Worker 在 bundled Chromium 中完成了解密、签名检查、取消和 OPFS 清理；不外推为目标 Chrome Stable、FileRef/Task 完整契约或稳定 Music Module Gate 已通过。

## MD-01 来源与供应链

完整清单见 [SUPPLY_CHAIN.md](SUPPLY_CHAIN.md)。当前锁定的根来源为：

- 来源：`https://git.unlock-music.dev/um/cli`
- 版本：`unlock-music.dev/cli@v0.2.12`
- tag commit：`61fba401c7ba83e6a0e69a528460f08f0f707c`
- Module checksum：`h1:mB/qjsILXij9I6jd3EInlIHlFERNX6ePypJ6WyEvcjk=`
- 维护者归档：`C:\Users\ben.luo\Downloads\cli-v0.2.12.zip`；SHA-256 `0b3408b815b6c9272017f84b962e44a98f040e12e5580f0b281ec74f46a31430`；解包后与 Module Proxy 快照逐项一致。
- 根许可证：MIT；`LICENSE` SHA-256 `c9028d65d98058e7bb95dff0980e90e1185ded1ae90591032ecf513354ab77b0`
- 快照事实：82 个文件，802,812 bytes；仅同步到系统 Go module cache，未进入 uNAS Git、锁文件或扩展包。

`go.mod` 中 26 个声明依赖已逐项登记来源、版本、Module checksum、许可证文件和许可证哈希；25 个可取得许可证的模块已完成静态锁定。`unlock-music.dev/mmkv@v0.1.0` 的官方镜像 tag 已取得并固定到 commit `31549c6a948b24a29476b4b5c06838758dd2fd3b`，但 tag 树没有许可证文件或声明；Module Proxy 返回 404、原站 direct 请求返回 403。uNAS 不再把该上游模块作为产品依赖，详见 [ADR-0010](../../docs/ADR/0010-clean-room-mmkv-replacement.md)；这不等于上游代码获得了许可证。

资源结论：QMC 上游算法测试向量属于根项目 MIT 资源，只读引用、不复制；KGM v5 所需 KGG 数据库不在源码快照中，且已确认它是用户本机的加密 SQLite 密钥数据库，不是可随扩展分发的通用算法资源。本轮已启动其来源审计，但上游移植来源返回 HTTP 403，实际数据库 provenance、许可、schema 和包体边界仍未锁定；未发现并未引入本轮所需 WASM/codec/媒体资源。维护者提供的 `um-web.extension.v1.10.8` 仍只作静态参考，不作为源码、许可证或产品能力证据。

## MD-02 探针实现

实现：[scripts/sp09-probe.mjs](../../scripts/sp09-probe.mjs)；固定夹具定义：[fixtures/manifest.json](fixtures/manifest.json)。

对维护者明确授权的本地样本，可用 `node scripts/sp09-probe.mjs --input <path> --json` 做只读结构探测；命令只输出文件大小、输入 SHA-256、规范化识别结果和结果 SHA-256，不上传、改写或解密媒体，也不会自动把样本纳入仓库夹具。

- KGM：读取 16-byte KGM/VPR magic、版本、audio offset；分别识别 v3/v5；v5 明确记录外部 KGG 依赖；audio offset 和输入大小先过预算。
- NCM：读取 `CTENFDAM` magic 和 key/meta/cover 长度，逐段限制最大长度；不解密、不解析远程封面、不发网络请求。
- QMC：只接受 extension-independent 的 `QTag`、raw-key footer 或 `MusicEx` 结构；没有稳定容器标记的静态 QMC 不因扩展名而被接受。
- 未知/伪扩展名：进入 `unsupported`。

资源预算固定为：单输入 128 MiB、NCM 单 section 16 MiB、QMC footer 64 KiB。探针对声明长度先拒绝，再进行后续切片；本轮没有把这些数字写成产品能力承诺。

## 固定夹具与 SHA-256

自生成结构夹具不含用户媒体、账号、密钥、网络 URL 或第三方资源；上游 QMC 夹具只读使用 `um/cli@v0.2.12` MIT `algo/qmc/testdata`。`expected result` 是 MD-02 规范化识别结果的 SHA-256；MD-02 不产生解密音频，因此上游向量的 `expected output` 只记录其合法固定 target 文件哈希，不宣称 uNAS 已生成该输出。

| 夹具 | 输入 bytes | 输入 SHA-256 | 预期结果 SHA-256 | 预期输出 SHA-256（仅上游 target） |
| --- | ---: | --- | --- | --- |
| `kgm-v3-header` | 64 | `06c5754daf3597bf742907c1c6bb7c567745cfafdd86165e54168dfda4b0b6fb` | `4ce83a2d46d3321ebca7b3cd44a03a9d79b364756f6d05e213a4f3ad18c8a97d` | — |
| `kgm-v5-header` | 128 | `281aaf0e9fe9caf9af9be73ad38ada3bd3b8e3619fff636919784cb18be0f68c` | `120339b26999fc1fb076e50ccb725c6b7f5bf0635ca987ef62cf8e5d6677cd71` | — |
| `kgm-audio-offset-budget` | 64 | `8466dccbec90451151de7f086b61997b27df308a2c8555fef4385f085e7abfea` | `9ae611dd4229ac2593e71f71d6093a5ba1f5e6cdd3359dc0aa433e812cd4a198` | — |
| `ncm-structural-header` | 54 | `8ad471012f6b8ef22f85e645b47885218b0712d41d135661bf502fec540d8118` | `71b883b7fbc66cc0b6a03cab5b2e4e830a4ff8aae5f3c29b9d1d908cd5b585af` | — |
| `ncm-section-budget` | 16,777,254 | `b1ba0ba364a74cf8444fe92f4abe8d1fac83e8fec6ce0c872c6063553a586cf7` | `d4a748b904950b921f7c538e970b5a1e2fa17b2ecd9b08dbce3772b17ae30edb` | — |
| `qmc-qtag-footer` | 45 | `0c2928d8ae5bbac078c5737513d24d5da8d931831bfb9979cf31d58d6802fa26` | `ffe12d112687c6b8f0f4798d2480d1f8f016ab42faacbd29a2ea8d8a1ce441e2` | — |
| `qmc-static-no-marker` | 42 | `cbc7dfed53e3d169671ed63fc6a80550277221f6909e1384ec8f286752458c87` | `0759a3bd85be3d61f9ad81e6c180d7fe798cd7af41b390932053d38ccc98c26a` | — |
| `unknown-pseudo-extension` | 25 | `58516352bf2cd7e43fde4ed4bfe0262da077f7409e0f057406bf9091ff17449e` | `0759a3bd85be3d61f9ad81e6c180d7fe798cd7af41b390932053d38ccc98c26a` | — |
| `qmc-upstream-mflac0-rc4` | 66,260 | `33a14cedf7286157074361234a29c6bc15ea63b9514bd7e5298c432623087fab` | `ffe12d112687c6b8f0f4798d2480d1f8f016ab42faacbd29a2ea8d8a1ce441e2` | `91a976207eb9f68be50e5c52e3c55e57ffc635b06084e1e612fbf9b7b8826c07` |
| `qmc-upstream-mflac-rc4` | 66,244 | `c0135268a22793d1c616abbcea65194fbf7388740db4022f1d797d73b7fd78bf` | `3625cd175bb0e7fa86093aa2e4a53ea53543c1a0077472661117a1f2abd8ec59` | `55d91ae43628163abc4c87d492130fae221e9b0463ffacf2b2c2f94c6a72293d` |
| `qmc-upstream-mflac-map` | 65,904 | `222a282430f4ace5a6ca59bf1395c73ab1e87a49d87309601f6444be4ecfe61b` | `3625cd175bb0e7fa86093aa2e4a53ea53543c1a0077472661117a1f2abd8ec59` | `c12855eefde592bfef686e6ae9604f4310078a1fdd60ab8dd31594fa514c8e06` |
| `qmc-upstream-mgg-map` | 65,904 | `ad7469a57fb8e3cb417465333262d8bd6437b263d17407302079aa068d363f76` | `3625cd175bb0e7fa86093aa2e4a53ea53543c1a0077472661117a1f2abd8ec59` | `6b0351525492ec4faf95412ebe5ae96362d01dd627bea618ce029a5ef9f1581a` |
| `qmc-upstream-qmc0-static` | 65,536 | `2314ffe88bf1a83000e78ab661bc9aa3bc0fb48e544d2efb9475871cbf681131` | `0759a3bd85be3d61f9ad81e6c180d7fe798cd7af41b390932053d38ccc98c26a` | `4b5b9c78ec2f88e7c4354a2cda412faa19f26869293249ab4a97e00f773337fb` |

## 实际执行结果

执行环境：Windows；Node `v24.13.0`；夹具来源目录为 `C:\Users\ben.luo\go\pkg\mod\unlock-music.dev\cli@v0.2.12`。命令：

```text
node scripts/sp09-probe.mjs --module-dir C:\Users\ben.luo\go\pkg\mod\unlock-music.dev\cli@v0.2.12 --json
```

结果：13/13 固定预期通过。

| 格式/分支 | 结果 | 证据边界 |
| --- | --- | --- |
| KGM v3 | 已验证（结构识别 + Node/Worker 单一本地样本解密） | bundled Chromium 中已验证 Worker、OPFS 暂存、下载和清理；目标 Chrome Stable、多样本兼容性仍未验证 |
| KGM v5 | 已验证（结构识别） | KGG 数据库缺失且未审计；当前不支持产品处理 |
| KGM 超预算 offset | 不支持 | 64-byte header 在声明 offset 超过 128 MiB 时拒绝 |
| NCM 容器结构 | 已验证（结构识别 + Node/Worker 单一本地样本解密） | 输出 MP3 已通过 `ffprobe`/`ffmpeg`；bundled Chromium 中已验证 Worker、OPFS 暂存、下载和清理；目标 Chrome Stable仍未验证 |
| NCM section 超预算 | 不支持 | 16 MiB section 上限先拒绝 |
| QMC QTag | 已验证（结构识别） | 未验证解密和音频输出；不代表所有 QTag 文件支持 |
| QMC raw-key footer | 已验证（结构识别 + 26 份本地 `.mgg` 解密 smoke test） | 26/26 输出为 OGG/Vorbis；其中一份已在 bundled Chromium 中验证 Worker、OPFS 暂存、下载和清理；目标 Chrome Stable、多样本浏览器兼容性仍未验证 |
| QMC static/no marker | 不支持 | 不依赖扩展名猜测；需要后续有界、可复核的识别路径 |
| 未知/伪扩展名 | 不支持 | 未识别 magic/container |

## 已验证、未验证与不支持汇总

**已验证：** MD-01 的根来源/tag/SHA/checksum、根 MIT 许可证、可取得依赖的静态许可证清单、QMC 上游夹具来源与哈希；MD-02 对 KGM v3/v5、NCM 结构、QMC QTag/raw-key footer 的固定输入识别和预算拒绝；6 个本地 KGM v3 样本（历史 1 个 + 本轮授权 5 个）经自有脚本解密并通过 FLAC magic、`ffprobe` 和完整 `ffmpeg` 解码；一个本地 NCM 样本经自有脚本解密后通过 MP3 magic、`ffprobe` 和完整 `ffmpeg` 解码；26 个本地 QMC `.mgg` 样本全部经自有脚本解密并通过 OGG/Vorbis `ffprobe` 和完整 `ffmpeg` 解码；本轮 5 个 KGM v3 样本均在 bundled Chromium 的 `music` Beta Tool App 中完成失败重试、取消、SHA-256 一致性和 OPFS 暂存清理验证。Worker 使用 1 MiB 分块、ACK 背压和 OPFS 暂存，输入/输出上限 128 MiB，单 section 上限 16 MiB，QMC footer 上限 64 KiB。

**未验证：** 上游 `unlock-music.dev/mmkv` 许可证与再分发授权（已退出 uNAS 产品依赖）；uNAS 自有 MMKV 兼容层；完整 Go module graph；KGM v5 KGG 实际数据库 provenance/许可证/schema/打包；可纳入仓库再分发的真实音频夹具；目标 Chrome Stable 的本功能复验；音乐 App 的完整 FileRef/Task/owner lease 接入；页面关闭后的音乐专项 E2E；峰值 JS/Worker/Chrome 进程内存实测和跨版本兼容性；NCM/QMC 私有夹具仍未配置，因此对应下载/失败/重试和 SHA-256 浏览器 E2E 尚未取得真实媒体证据。KGM v3 本轮只证明这 5 个用户授权样本，不扩大为所有 KGM v3 文件兼容性。

**不支持：** 文件管理关联、右键菜单、在线封面/元数据/密钥/账号、Native Helper、在线 DRM/付费墙/站点授权绕过、KGM v5 实际解密、QMC `cex\0`/外部 MMKV 分支，以及没有 extension-independent marker 的 QMC static 分支。Beta App 只暴露已验证的 KGM v3、NCM 和 QMC raw-key-footer 路径。

## 后续阻断项

上游 `mmkv` 许可证阻断已通过“退出上游依赖、改走自有 clean-room 实现”降级，但自有兼容层尚未实现和单独审查；KGM v5 KGG 实际资源审计仍阻断供应链锁定。KGM v3、NCM 和 QMC raw-key-footer 已完成隔离脚本、Worker、OPFS 暂存、取消/显式清理和 bundled Chromium Beta App 验收；本轮 5 个 KGM v3 授权样本新增了浏览器下载失败/重试、取消、SHA-256 一致性和清理证据。下载无完成回执时结果保留并允许重试；NCM/QMC 仍缺私有浏览器夹具。音乐专用 FileRef/Task/owner lease、目标 Chrome Stable、峰值内存实测和可再分发真实音频夹具仍未完成。`VipSongsDownload` 只读盘点得到 26 个 `.mgg`，均为 raw-key-footer；未发现 KGM/VPR。RISK-015 保持开放，Music Module Gate 仍未整体通过。

## Worker、浏览器与产品集成验证

实现入口：

- `apps/extension/src/workers/musicDecrypt.worker.ts`：独立 Worker，按 1 MiB 读取和发送，主线程 ACK 后继续，支持取消和结构化失败。
- `apps/extension/src/api/real/musicDecryption.ts`：能力探测、OPFS staged output、顺序写入、取消超时兜底和幂等清理。
- `apps/extension/src/apps/real/MusicApp.tsx`：`executionSource: real` 的 Beta Tool App；只接受用户通过文件选择器选取的本地文件，不读任意路径、不覆盖原文件、不联网。

固定资源预算：输入/输出各 128 MiB、单 section 16 MiB、QMC footer 64 KiB、Worker 分块 1 MiB。输出先写入 OPFS `unas-music-*.stage`，Worker 只做音频签名级检查并记录输出 SHA-256；取消/失败由用户流程清理，下载触发后因页面无法确认浏览器完成状态而保留暂存项，用户可重试下载或显式清理。

变更前基线命令与结果（保留用于对照；不代表本轮输出可靠性回归已取得私有媒体证据）：

```text
pnpm --dir apps/extension exec playwright test e2e/musicDecrypt.spec.ts
2 passed
pnpm test:e2e
51 passed
```

三项浏览器样本分别覆盖本地 KGM v3、NCM 和 QMC raw-key-footer `.mgg`；每项都在真实打包的 MV3 bundled Chromium 中完成解密、下载和 OPFS 清理断言，另有取消测试。该证据不代表目标 Chrome Stable 已复验，也不代表 KGM v5、QMC MMKV/`cex\0` 或静态无 marker 分支可用。

### 本轮输出可靠性回归（基于 `f19f983`）

```text
pnpm verify
通过：治理检查、lint、Demo 边界、依赖一致性、159 passed + 1 skipped（共 160）单测、类型检查、Demo 构建、MV3 构建和包检查。

pnpm --dir apps/extension exec playwright test e2e/musicDecrypt.spec.ts
结果：3 skipped；未配置 UNAS_MUSIC_KGM_FIXTURE、UNAS_MUSIC_NCM_FIXTURE、UNAS_MUSIC_QMC_FIXTURE 私有夹具。

pnpm test:e2e
结果：49 passed、3 skipped；跳过项为上述音乐专项 E2E，未计入通过数。
```

音乐专项 E2E 已准备覆盖下载提交失败、用户取消、重复下载、OPFS 暂存保留/显式清理和下载文件 SHA-256 与 staged 输出一致性；在上述三个私有夹具变量配置前，这些场景保持未验证，不得写成通过。

目标 Chrome 尝试：

```text
$env:UNAS_E2E_BROWSER = 'chrome'
pnpm --dir apps/extension exec playwright test e2e/musicDecrypt.spec.ts
```

结果：无头和 headed 两种模式均在 `fixtures.ts` 等待 `serviceworker` 超时，两个用例都未进入 Workspace 或音乐解密逻辑；因此目标 Chrome 证据仍为**阻断/未验证**，不是解密失败结论。需在能加载解包 MV3 Service Worker 的目标 Chrome 环境中重新复验。

### 2026-09-21 授权 KGM v3 批次回归

本轮使用用户明确提供的 5 个本地 `.kgma` 文件，仅通过环境变量传入现有 E2E，不复制到仓库、不改写输入。每个样本均完成：

- Node 解密输出 `fLaC`，并通过 `ffprobe` 与 `ffmpeg -v error -f null -` 完整解码；
- bundled Chromium 音乐 App 的下载提交失败后重试，暂存输出 SHA-256 与下载文件一致；
- 用户取消并清理 OPFS 暂存。

批次结果：`5/5` 解密与独立音频完整性验收通过；音乐专项 E2E 对每个样本 `2 passed、1 skipped`，合计 `10 passed、5 skipped`。跳过项是同一测试文件中要求同时提供 NCM/QMC 夹具的三格式下载用例，不代表 KGM 失败。

本轮 KGM v3 输入/输出摘要：

| 样本序号 | 输入 bytes | 输入 SHA-256 | 输出 bytes | 输出 SHA-256 | 音频参数 |
| ---: | ---: | --- | ---: | --- | --- |
| 1 | 76,398,032 | `f77b4fcba5f5e08c8fcccf8071fb89ae0813f3cb1b6495156711c7d2a8d84dc5` | 76,397,008 | `5c239ebc9e6bb85aed042203eb3f1feef543d96b5602e6f5c23940dce1e2b881` | FLAC / 96 kHz / 2 ch / 253.735188 s |
| 2 | 27,225,708 | `da46a80ef52cf721a7e983e1e05241649e9817c516312aaba27a4eb525b54077` | 27,224,684 | `d63160215290f998212247f2cbce3c3101e333376d9b6d3e89d798494a0b8e94` | FLAC / 44.1 kHz / 2 ch / 229.333333 s |
| 3 | 94,516,538 | `012575bc29e00190bf221af5471169ca94398451f97b9dd96faa8612ab0a98be` | 94,515,514 | `e85574c5a76dd886bdf2bc169c066668f3e401d04ec527c88e2b88ad0e9c1b7d` | FLAC / 96 kHz / 2 ch / 217.720792 s |
| 4 | 104,403,251 | `03b5446d05f54a23fb6db2628965a2213a5d175027cf1a0b743731073353d6a1` | 104,402,227 | `1f16f684313eece64828831cc6f4e740c8813890b35f0ec99813814dbdbdefeb` | FLAC / 96 kHz / 2 ch / 234.951063 s |
| 5 | 126,094,908 | `1321153c2aebf178d2e7334d21b028f1d5e50783b804f137cdec46a075aba4b7` | 126,093,884 | `eda1b33e28fae5440b0616bbf7cc5f0afa7835a420058fac299ce488e6782fe1` | FLAC / 96 kHz / 2 ch / 279.029188 s |

证据边界：这是授权本地样本 + bundled Chromium 的 KGM v3 证据，不是目标 Chrome Stable、全部 KGM v3 版本兼容性、页面关闭恢复、owner lease、峰值内存或稳定产品集成证据。

## KGM v3 本地解密 smoke test

脚本：[scripts/sp09-kgm-v3-decrypt.mjs](../../scripts/sp09-kgm-v3-decrypt.mjs)。脚本只读取用户指定的本地输入，输出到系统临时目录，不覆盖原文件、不上传、不把媒体带入 Git。

| 项目 | 结果 |
| --- | --- |
| 输入 | 用户本地 KGM v3 样本（不记录文件名或本机路径） |
| 输入 bytes / SHA-256 | `23,776,931` / `fa6adc4594c994b61933dcb57179c363f007cafa79729f8ee4f207262e99fd8c` |
| header | `audioOffset=1024`，`cryptoVersion=3`，`cryptoSlot=1` |
| 输出 bytes / SHA-256 | `23,775,907` / `2a27f0a9d9480bc5643b6453591138c285f86a37a118cdd6163dab7ac31e8f53` |
| 输出验证 | `fLaC` magic；`ffprobe` 识别 FLAC、44.1 kHz、2 channels、222.351406 s；`ffmpeg -v error -f null` 完整解码通过 |
| 结论 | **已验证：单一本地样本的 KGM v3 解密输出可被独立 FLAC 工具读取；不等于 Worker/Chrome/产品支持** |

## NCM 本地解密 smoke test

脚本：[scripts/sp09-ncm-decrypt.mjs](../../scripts/sp09-ncm-decrypt.mjs)。脚本实现 NCM 音频 key、metadata、音频区段的本地解码；不访问 metadata 中的远程封面 URL，不覆盖原文件，输出只写系统临时目录。

| 项目 | 结果 |
| --- | --- |
| 输入 | 用户本地 NCM v1 样本（未复制进仓库） |
| 输入 bytes / SHA-256 | `8,858,233` / `a22f710a16177e6b366ea08809cbcce20cecf575818789753fc840ed19f1bcf3` |
| NCM 解析 | `audioOffset=142472`，`metadataType=music`，metadata format=`mp3` |
| 输出 bytes / SHA-256 | `8,715,761` / `9b3a588ebfb42029c606a94b0dbba95c76e3562b1634b02bb06ac95f99b91638` |
| 输出验证 | `ID3` magic；`ffprobe` 识别 MP3、44.1 kHz、2 channels、320 kbps、217.800000 s；`ffmpeg -v error -f null` 完整解码通过 |
| 结论 | **已验证：单一本地样本的 NCM 解密输出可被独立 MP3 工具读取；不等于 Worker/Chrome/产品支持** |

复现命令：

```text
node scripts/sp09-ncm-decrypt.mjs --input <local-ncm-file> --output-dir <temp-output-dir> --json
```

## QMC `.mgg` 本地解密 smoke test

脚本：[scripts/sp09-qmc-decrypt.mjs](../../scripts/sp09-qmc-decrypt.mjs)。本轮针对用户本地 `VipSongsDownload` 目录中已识别为 QMC raw-key-footer 的 `.mgg` 文件，落地了 raw-key footer、V1/V2 key derive、Map cipher 和 RC4 cipher；不读取外部 MMKV、不联网、不覆盖原文件，输出只写系统临时目录。

批次结果：26/26 成功解密；25 个使用 RC4，1 个使用 Map；26/26 输出识别为 OGG/Vorbis，26/26 通过 `ffprobe`，26/26 通过 `ffmpeg -v error -f null` 完整解码。以下记录全部输入和输出 SHA-256；文件名仅作本地样本映射，不代表仓库夹具或再分发授权。

| 本地样本 | 输入 bytes | 输入 SHA-256 | cipher | 输出 bytes | 输出 SHA-256 |
| --- | ---: | --- | --- | ---: | --- |
| `5ive _ Queen - We Will Rock You (Radio Edit).mgg` | 2,183,640 | `9cc0bfaafbff93b522e8eff2133c33411889e50c9349b8f5e7f610ff453e094c` | RC4 | 2,182,627 | `e0c296f08a6668a6829eb0b11ad22a2c04d3bc102f46248b064495076b156d39` |
| `ARI HICKS - Kiss Me, Kill Me.mgg` | 2,230,511 | `21322b1d3f6f32b56e46c7d9efffc88fcbb94797b75c1ff11fe8317c784a7c3e` | RC4 | 2,229,498 | `57a5dccc3e8366e56a6f08a09fffaf0cb07945bb5af5e4e8cc13b53a0fb60be4` |
| `Bemax - Gambare Gambare Senpai.mgg` | 1,521,068 | `fc03c9bc02b5e0cf23c7af9430323b440e2286fad10e8c44e1ceb09d20035078` | RC4 | 1,520,055 | `3651a9a431b2d30aff0fc97474d6ec7f9e96c03c8dee13a196227cb3440826e1` |
| `D1ofaquavibe - Monkeybiz.mgg` | 2,982,448 | `3a0c5085466b5d5e44f8658a09e2fbe23ccba466103a2f089a054d0c3432c56d` | RC4 | 2,981,435 | `8596c7735fc44782f0f8db275185dab7b7faf703da5fda5909187a2209e67dcd` |
| `DIOR _ Samo _ Chicagoo - Положение (Chicagoo Remix).mgg` | 1,821,836 | `87d6c3b5c71acad0a5be0f66bac423c0085f5eac0fd48226011b29c8469f7366` | RC4 | 1,820,823 | `54da4d7bed45b0e6399f8b4f11176dc797d449982ddc6cc6a689f565dc7efc10` |
| `Dxrk ダーク - RAVE.mgg` | 2,120,973 | `1cf38161f098f5e675ceade4142328e720af752af56d9d638beab08ae1c0d24d` | RC4 | 2,119,960 | `66628a9db895a20f8e81d7a6df6721af2798f832187e2aa7b30904df1d0a47b5` |
| `Eternxlkz - Montagem Nada Tropica.mgg` | 1,386,973 | `832813d6be2fe0bf57e9d904412a3e5525eb60c6784e85e6f6c5a864f0b82a9b` | RC4 | 1,385,960 | `664e5aad399851db5e918a3ee40a841f73ca563e0076f278b79f15ae4273bfda` |
| `F_O_O_L - Criminals.mgg` | 3,095,152 | `1f2671ee135be84dd3b5341ae0a30c51c7d9fafcc87afe12d9436e1ac04b02bd` | RC4 | 3,094,139 | `19c04098c3a145b21f6e37e206d35c65958108531e7f29aabf1b79273911382e` |
| `Fatrik _ L1NO - 窒 Suffocating.mgg` | 1,587,972 | `6221917964c45241fa14bc171b15964ec42716e4dd7053ee3ae30f79af749535` | RC4 | 1,586,959 | `f609ee28e3498f68e4554b504e65a90a49c9b626f37c2c33c9d3280f5ad40720` |
| `Flipped - Dark Blue.mgg` | 2,288,967 | `a1c3843cf830f16ec2a4667ba6a10ff26872f7cf0dc16190042696718a59d2f9` | RC4 | 2,287,954 | `e96b64129f15a3d792b72f45001c50ed51cf7bd78ba3d363fd6298b18c843779` |
| `GkTz1k - 出征.mgg` | 660,822 | `9c249237d0a770daf65ad56ac333b3e309497b10d3bfe2a78868aefe5034ebb8` | RC4 | 659,809 | `a67ead6ea6ab72462b8d70145ad8a618384b7003f014c1ceb74a1a219de3d62c` |
| `Glichery - Heavenly Key (Explicit).mgg` | 1,509,108 | `e0bb6ab1cccc68710dc1ea1d45665df83f02ae8ae704eb7fe8b747d9a7646a89` | RC4 | 1,508,095 | `a5315d3667f8dfc546b99ab47ab1c9f65648d6236b74d9efb7bf5ce2a00172d0` |
| `Kenny Loggins - Danger Zone (From _Top Gun_ Original Soundtrack).mgg` | 2,482,411 | `a3bb389c50b9074325142d084b01d9490b03f825b383d70642bed09835ec0d17` | Map | 2,481,858 | `dd09dba4808cade935969c33bf42608876be88cef4e839bf788c3f955109c8a6` |
| `Lunak - UwU Funk.mgg` | 1,593,419 | `47707f1f1b9f61623d01e7e87eff69147796aecb9d3c4a2cd5cdb1690a57492e` | RC4 | 1,592,406 | `e92bbd679478ef0d13b84ad43137b950c8d0825ea4f162eaebe5c7b76ef8b845` |
| `Michael Calfan _ INNA - Call Me Now.mgg` | 1,746,891 | `efa860022aeca40e5e60de8aa42198c7111d8467c241133ba15d846092c68a8d` | RC4 | 1,745,878 | `3de1ddf55829b67daea491a7440bc7ca66c703d78eeb87188d77ffd0433ef299` |
| `Mike Posner - Cooler Than Me (Single Mix).mgg` | 2,506,824 | `4945d670e418a4db7405dc407b86e38cefd4bd83652d818b9d9425cf96d3501c` | RC4 | 2,505,811 | `1aa4bf1f1d1fffa285faf1365d2740fd50130863d5b98de86d836af4909f6b1a` |
| `Moondeity _ Eduard Vodovozik - NEON BLADE (Explicit).mgg` | 3,083,633 | `4f993895545327b0f896e56236597b0ad2665d752d2984baf4a91acbec86a5f2` | RC4 | 3,082,620 | `78a43dd4b1060a9e79a2d6c2a813f98d638690e64c21a1426bc6a5ac71f6fbd8` |
| `MXZI - Corazón Fugaz.mgg` | 1,114,639 | `a38f9e9b9f799bf7a9d5ed255eb36de41da05e15bf100eb6cfafaafcba1dfb38` | RC4 | 1,113,626 | `447277751f980bcd393038e6f39ec4f9c13429aaf7fbb433e53c8b0fae9e5802` |
| `Oliver Koletzki _ HVOB - Bones.mgg` | 3,528,916 | `945111ad082322334df71012db43473ea3e61e87df958eb556cd29aa79fddae0` | RC4 | 3,527,903 | `4ab0a47e04318ff54e12145ae1bed36e407a954752d5309ab74400dec70b99a1` |
| `Queen - We Will Rock You (Remastered 2011).mgg` | 1,443,000 | `da64f0495246be90898ab0eed1463c73b2c1c4dd774dd45042a4096d9763dfa5` | RC4 | 1,441,987 | `f8670ea1b4e990e221a1c13fc83eed1d9b44860760a23b93e4ade73163ada26a` |
| `Sea of Thieves - Bosun Bill.mgg` | 1,590,749 | `5f64bf7d989892ee8c7a3258aa9335f2709acf93a3720254a2af93f17949a139` | RC4 | 1,589,736 | `dee14091c3158d738132824e243c3526663cb319561a94a9bc5013b6ed71798c` |
| `Selena Gomez - Hands To Myself.mgg` | 2,452,485 | `20fbf453e0ec596b983d6ad0b11931ad61c95e2fcae5f03d1068d2476e3826dd` | RC4 | 2,451,472 | `67e66b04ebc0f58eeb7ac631e2013113f6111ca7dca2401136c58ad55dd12344` |
| `The Tech Thieves - Fake.mgg` | 1,658,196 | `393235d36cf092642656a390161a85ef429d3c46b188833f752a3d1b91e4fae8` | RC4 | 1,657,183 | `39236b6707d2f0d90f25b360116c2bf50013943071980d24e0155910bf3473ff` |
| `TheFatRat - Unity.mgg` | 2,764,451 | `60b2f31f7676670865b172f5c2c5bf282101db21056d19cce1c335930ec72575` | RC4 | 2,763,438 | `7ff3bb54b31193b8ffe53fc5e76690b29d023f2f9b4ef1886b76842ef2a2b2cf` |
| `Tove Lo - Talking Body.mgg` | 2,798,060 | `3fc0bd088e251dbbad93f9a17d085e0315ff974329d857dd29445c3acb4a6911` | RC4 | 2,797,047 | `dff5d14e500904e02777fb1986f3e1cbaa5105e9a3fb71c533bf9e979866fd9f` |
| `Wham! - Last Christmas (Single Version).mgg` | 2,785,758 | `d45d936df91a4e90506abff83a0987f5fb3a573a97b1b0b6cb2cfdb1f56d3c1a` | RC4 | 2,784,745 | `e466d3fbff106202442bcbf7eff56efd0874a643a8181a90738d89759fd531d7` |

复现命令：

```text
node scripts/sp09-qmc-decrypt.mjs --input <local-mgg-file> --output-dir <temp-output-dir> --json
```

QMC 本地 batch 结论只覆盖本批 raw-key-footer `.mgg`；`cex\0`/外部 MMKV、无 marker 的 static 分支、其他后缀和 KGM v5 KGG 仍不宣称支持。
