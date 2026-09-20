# SP-09 Music encrypted-container 来源与浏览器可行性

## 本轮范围

本轮基于 `main` 最新计划，仅执行 MD-01（来源与供应链锁定）和 MD-02（格式识别探针）。没有注册正式 Tool App，没有修改文件管理右键菜单，没有引入第三方源码、WASM、KGG 数据库、Native Helper 或远程资源。

探针的 `已验证` 只表示“在固定输入上识别出结构并通过预算检查”，不表示已验证解密、音频输出、Worker 生命周期、目标 Chrome 或产品支持。

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
| KGM v3 | 已验证（结构识别） | 未验证解密、输出、Worker/Chrome；当前不支持产品处理 |
| KGM v5 | 已验证（结构识别） | KGG 数据库缺失且未审计；当前不支持产品处理 |
| KGM 超预算 offset | 不支持 | 64-byte header 在声明 offset 超过 128 MiB 时拒绝 |
| NCM 容器结构 | 已验证（结构识别） | 未验证 AES、metadata、音频输出、取消/清理；当前不支持产品处理 |
| NCM section 超预算 | 不支持 | 16 MiB section 上限先拒绝 |
| QMC QTag | 已验证（结构识别） | 未验证解密和音频输出；不代表所有 QTag 文件支持 |
| QMC raw-key footer | 已验证（结构识别） | 仅覆盖上游四个算法向量的 footer 结构；不代表产品支持 |
| QMC static/no marker | 不支持 | 不依赖扩展名猜测；需要后续有界、可复核的识别路径 |
| 未知/伪扩展名 | 不支持 | 未识别 magic/container |

## 已验证、未验证与不支持汇总

**已验证：** MD-01 的根来源/tag/SHA/checksum、根 MIT 许可证、可取得依赖的静态许可证清单、QMC 上游夹具来源与哈希；MD-02 对 KGM v3/v5、NCM 结构、QMC QTag/raw-key footer 的固定输入识别和预算拒绝。

**未验证：** 上游 `unlock-music.dev/mmkv` 许可证与再分发授权（已退出 uNAS 产品依赖）；uNAS 自有 MMKV 兼容层；完整 Go module graph；KGM v5 KGG 实际数据库 provenance/许可证/schema/打包；合法授权的真实 KGM/NCM 正向音频夹具；Worker/WASM/CSP/内存/取消/页面关闭/清理；目标 Chrome；输出音频 hash。

**不支持：** 正式 Tool App、文件管理关联、右键菜单、真实解密、在线封面/元数据/密钥/账号、Native Helper、DRM 绕过，以及没有 extension-independent marker 的 QMC static 分支。

## 后续阻断项

上游 `mmkv` 许可证阻断已通过“退出上游依赖、改走自有 clean-room 实现”降级，但自有兼容层尚未实现和单独审查；KGM v5 KGG 实际资源审计仍阻断供应链锁定，本轮只完成依赖路径与包体边界的静态审计启动。没有合法数据库样本，不能完成实际资源审计；真实 KGM/NCM 授权夹具缺失也阻断对应正向输出验证。RISK-015 保持开放。MD-03～MD-09 未启动，Music Module Gate 不变。
