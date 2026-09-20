# SP-09 MD-01 来源与许可证清单

## 审计范围与复现

| 项目 | 固定事实 |
| --- | --- |
| 根来源 | `https://git.unlock-music.dev/um/cli` |
| 版本 / tag / commit | `v0.2.12` / `61fba401c7ba83e6a0e69a528460f08f0f707c` |
| Module checksum | `h1:mB/qjsILXij9I6jd3EInlIHlFERNX6ePypJ6WyEvcjk=` |
| GoMod checksum | `h1:hnzomc4tf79dRnktdpAhHTtlOdJSvagur62YMvAjrSo=` |
| 同步方式 | `go mod download -json unlock-music.dev/cli@v0.2.12`；Module Proxy zip 展开到系统 Go module cache |
| 维护者提供归档 | `C:\Users\ben.luo\Downloads\cli-v0.2.12.zip`；SHA-256 `0b3408b815b6c9272017f84b962e44a98f040e12e5580f0b281ec74f46a31430` |
| 源码快照 | 82 个文件，802,812 bytes；只读审计，未复制进 uNAS Git、依赖锁或扩展包 |
| 根 `LICENSE` | MIT；SHA-256 `c9028d65d98058e7bb95dff0980e90e1185ded1ae90591032ecf513354ab77b0` |
| 根审计输入 | `go.mod` SHA-256 `0efb6d8cc718c97ddd5d1e6cd66da28c1fdfaeeab48653c7fa69d8c9235462e8`；`go.sum` SHA-256 `d2ea3544613965b78cfb1ecc1f7517504e162e9016d31f344544381031cafc35` |

来源、版本、checksum 和 license 文件均以本地 Go module cache 的只读文件为证据。下表的 `License SHA-256` 是对应版本模块内许可证文件的哈希；没有把许可证文本或第三方源码复制进本仓库。

维护者提供的 `cli-v0.2.12.zip` 已在系统临时目录只读展开核对：文件数、总字节数、根 `LICENSE`/`go.mod`/`go.sum`/README 哈希及已登记 QMC/Ximalaya 资源哈希均与 Module Proxy 快照一致。归档根目录只有 `cli/`，不包含 `unlock-music.dev/mmkv` 源码、KGG 数据库或 WASM。

`mmkv` 来源复核：官方镜像 `https://github.com/unlock-music/go-mmkv` 的 `v0.1.0` tag 指向 `31549c6a948b24a29476b4b5c06838758dd2fd3b`，tag 树共 16 个源码/测试文件；没有 `LICENSE`、`COPYING` 或 `NOTICE`，全文检索也没有 SPDX、MIT、Apache 或 BSD 许可证声明。镜像可作为来源线索，但不能替代作者许可或再分发授权。

uNAS 的源码扫描未发现对 `unlock-music.dev/mmkv` 的实际引用；根据 [ADR-0010](../../docs/ADR/0010-clean-room-mmkv-replacement.md)，该上游模块退出 uNAS 产品依赖。若后续确需 MMKV 能力，只实现由 uNAS 自有代码维护的最小兼容层，并在代码进入仓库前单独确定许可证、来源和 clean-room 证据；不能给上游代码补发许可证。

## `go.mod` 声明的依赖

| 模块 @ 版本 | 依赖层级 | SPDX / 许可证 | 来源与许可证文件 | Module checksum |
| --- | --- | --- | --- | --- |
| `github.com/fsnotify/fsnotify@v1.8.0` | direct | BSD-3-Clause | Go module；`LICENSE` `2dfbe6d2b5eb18b55148f3805d88648a09e0d17e38428123259afb08c8996e37` | `h1:dAwr6QBTBZIkG8roQaJjGof0pp0EeF+tNV7YBP3F/8M=` |
| `github.com/go-flac/flacpicture@v0.3.0` | direct | Apache-2.0 | Go module；`LICENSE` `1341ea9d201362e533c921a821344fe46d6d47740581d85152c7c9a5973d6d4d` | `h1:LkmTxzFLIynwfhHiZsX0s8xcr3/u33MzvV89u+zOT8I=` |
| `github.com/go-flac/flacvorbis@v0.2.0` | direct | Apache-2.0 | Go module；`LICENSE` `1341ea9d201362e533c921a821344fe46d6d47740581d85152c7c9a5973d6d4d` | `h1:KH0xjpkNTXFER4cszH4zeJxYcrHbUobz/RticWGOESs=` |
| `github.com/go-flac/go-flac@v1.0.0` | direct | Apache-2.0 | Go module；`LICENSE` `1341ea9d201362e533c921a821344fe46d6d47740581d85152c7c9a5973d6d4d` | `h1:6qI9XOVLcO50xpzm3nXvO31BgDgHhnr/p/rER/K/doY=` |
| `github.com/samber/lo@v1.47.0` | direct | MIT | Go module；`LICENSE` `423d2ff9f1c8dfa0c5220790a6feddc66ab9da1f88679193faaa98a568a11c8b` | `h1:z7RynLwP5nbyRscyvcD043DWYoOcYRv3mV8lBeqOCLc=` |
| `github.com/urfave/cli/v2@v2.27.5` | direct | MIT | Go module；`LICENSE` `3e64f5c2419b8150badd1c21a143806db894a51e0ec7ffd1560ddd6819f2aa37` | `h1:WoHEJLdsXr6dDWoJgMq/CboDmyY/8HMMH1fTECbih+w=` |
| `go.uber.org/zap@v1.27.0` | direct | MIT | Go module；`LICENSE` `7de716e70addb64f9305298ef32a9dd68e40d5b3095a5d868ba4461404dbfbcf` | `h1:aJMhYGrd5QSmlpLMr2MftRKl7t8J8PTZPA732ud/XR8=` |
| `golang.org/x/crypto@v0.29.0` | direct | BSD-3-Clause | Go module；`LICENSE` `911f8f5782931320f5b8d1160a76365b83aea6447ee6c04fa6d5591467db9dad` | `h1:L5SG1JTTXupVV3n6sUqMTeWbjAyfPwoda2DLX8J8FrQ=` |
| `golang.org/x/exp@v0.0.0-20250305212735-054e65f0b394` | direct | BSD-3-Clause | Go module；`LICENSE` `911f8f5782931320f5b8d1160a76365b83aea6447ee6c04fa6d5591467db9dad` | `h1:nDVHiLt8aIbd/VzvPWN6kSOPE7+F/fNFDSXLVYkE/Iw=` |
| `golang.org/x/text@v0.20.0` | direct | BSD-3-Clause | Go module；`LICENSE` `911f8f5782931320f5b8d1160a76365b83aea6447ee6c04fa6d5591467db9dad` | `h1:gK/Kv2otX8gz+wn7Rmb3vT96ZwuoxnQlY+HlJVj7Qug=` |
| `unlock-music.dev/mmkv@v0.1.0` | direct | 未确认 | 官方镜像 `https://github.com/unlock-music/go-mmkv` 的 `v0.1.0` tag 已核到 commit `31549c6a948b24a29476b4b5c06838758dd2fd3b`；tag 树无许可证文件或声明；Module Proxy 返回 404、原站 direct 请求返回 403 | `h1:hgUHo0gJVoiKZ6bOcFOw2LHFqNiefIe+jb5o0OyL720=` |
| `github.com/cpuguy83/go-md2man/v2@v2.0.5` | indirect | MIT | Go module；`LICENSE.md` `a55959c4e3e8917bfa857359bb641115336276a6cc97408fd8197e079fb18470` | `h1:ZtcqGrnekaHpVLArFSe4HK5DoKx1T0rq2DwVB0alcyc=` |
| `github.com/dustin/go-humanize@v1.0.1` | indirect | MIT | Go module；`LICENSE` `a973b4498c13eb74baa2a8e5c351426a6826f2fcdd909916dbe53ee2e755fd71` | `h1:GzkhY7T5VNhEkwH0PVJgjz+fX1rhBrR7pRT3mDkpeCY=` |
| `github.com/google/uuid@v1.6.0` | indirect | BSD-3-Clause | Go module；`LICENSE` `0a8d61ed3cbfd5312326e8126c31ce9c627a283adc99131b56896d29ada04b2d` | `h1:NIvaJDMOsjHA8n1jAhLSgzrAzy1Hgr+hNrb57e+94F0=` |
| `github.com/mattn/go-isatty@v0.0.20` | indirect | MIT | Go module；`LICENSE` `08eab1118c80885fa1fa6a6dd7303f65a379fcb3733e063d20d1bbc2c76e6fa1` | `h1:xfD0iDuEKnDkl03q4limB+vH+GxLEtL/jb4xVJSWWEY=` |
| `github.com/ncruces/go-strftime@v0.1.9` | indirect | MIT | Go module；`LICENSE` `38ae43959daf953a393a585b2988672cb65a5a541aca0d0be5e72595a0a16883` | `h1:bY0MQC28UADQmHmaF5dgpLmImcShSi2kHU9XLdhx/f4=` |
| `github.com/remyoudompheng/bigfft@v0.0.0-20230129092748-24d4a6f8daec` | indirect | BSD-3-Clause | Go module；`LICENSE` `dd26a7abddd02e2d0aba97805b31f248ef7835d9e10da289b22e3b8ab78b324d` | `h1:W09IVJc94icq4NjY3clb7Lk8O1qJ8BdBEF8z0ibU0rE=` |
| `github.com/russross/blackfriday/v2@v2.1.0` | indirect | BSD-2-Clause | Go module；`LICENSE.txt` `75e1ca97a84a9da6051dee0114333388216f2c4a5a028296b882ff3d57274735` | `h1:JIOH55/0cWyOuilr9/qlrm0BSXldqnqwMsf35Ld67mk=` |
| `github.com/xrash/smetrics@v0.0.0-20240521201337-686a1a2994c1` | indirect | MIT | Go module；`LICENSE` `1b0edc159f8b0395fc51dc72b95619404e494563b7df7d683d97e35e0a4a8650` | `h1:gEOO8jv9F4OT7lGCjxCBTO/36wtF6j2nSip77qHd4x4=` |
| `go.uber.org/multierr@v1.11.0` | indirect | MIT | Go module；`LICENSE.txt` `dcdabe03bef2382a130640d1c3a4cd5ec42aba1035095c38272fde694eb72405` | `h1:blXXJkSxSSfBVBlC76pxqeO+LN3aDfLQo+309xJstO0=` |
| `golang.org/x/sys@v0.31.0` | indirect | BSD-3-Clause | Go module；`LICENSE` `911f8f5782931320f5b8d1160a76365b83aea6447ee6c04fa6d5591467db9dad` | `h1:ioabZlmFYtWhL+TRYpcnNlLwhyxaM9kWTDEmfnprqik=` |
| `google.golang.org/protobuf@v1.35.2` | indirect | BSD-3-Clause | Go module；`LICENSE` `4835612df0098ca95f8e7d9e3bffcb02358d435dbb38057c844c99d7f725eb20` | `h1:8Ar7bF+apOIoThw1EdZl0p1oWvMqTHmpA2fRTyZO8io=` |
| `modernc.org/libc@v1.62.1` | indirect | BSD-3-Clause | Go module；`LICENSE` `95ff867eb55a56935fa7492406cfa953fb7c13ca73f4c0a86ae05756b4605600`；另含 `LICENSE-GO` | `h1:s0+fv5E3FymN8eJVmnk0llBe6rOxCu/DEU+XygRbS8s=` |
| `modernc.org/mathutil@v1.7.1` | indirect | BSD-3-Clause | Go module；`LICENSE` `bfa9bf72a72ca009fd62a8f84fca3dca67e51d93af96352723646599898b6cf5`；`mersenne/LICENSE` 独立 | `h1:GCZVGXdaN8gTqB1Mf/usp1Y/hSqgI2vAGGP4jZMCxOU=` |
| `modernc.org/memory@v1.9.1` | indirect | BSD-3-Clause | Go module；`LICENSE` `59895e669f48f168b6b858358f6005779cdf40a265f7828813061b56af67b496`；另含 `LICENSE-GO`/`LICENSE-MMAP-GO` | `h1:V/Z1solwAVmMW1yttq3nDdZPJqV1rM05Ccq6KMSZ34g=` |
| `modernc.org/sqlite@v1.37.0` | indirect | BSD-3-Clause | Go module；`LICENSE` `c6fe05491a60ae13bcd223088d2705e36dede24e5587226231d2459ada5c4822` | `h1:s1TMe7T3Q3ovQiK2Ouz4Jwh7dw4ZDqbebSDTlSJdfjI=` |

## `go.sum` 仅出现的测试/历史模块

这些模块不在当前 `go.mod` 的声明集合中；它们的 checksum 仍在上游 `go.sum`，因此单独登记，不把它们误报成当前运行时依赖：`github.com/davecgh/go-spew@v1.1.1`（ISC，`LICENSE` SHA-256 `1b93a317849ee09d3d7e4f1d20c2b78ddb230b4becb12d7c224c927b9d470251`）、`github.com/pmezard/go-difflib@v1.0.0`（BSD-3-Clause，`LICENSE` SHA-256 `2eb550be6801c1ea434feba53bf6d12e7c71c90253e0a9de4a4f46cf88b56477`）、`github.com/stretchr/testify@v1.9.0`（MIT，`LICENSE` SHA-256 `f8e536c1c7b695810427095dc85f5f80d44ff7c10535e8a9486cf393e2599189`）、`go.uber.org/goleak@v1.3.0`（MIT，`LICENSE` SHA-256 `cea390bdf643a06fbdd99fbab18c50e82c34e7bead0d55bf1168bd0d65b9fa32`）、`gopkg.in/yaml.v3@v3.0.1`（MIT/Apache-2.0，`LICENSE` SHA-256 `d18f6323b71b0b768bb5e9616e36da390fbd39369a81807cca352de4e4e6aa0b`，另有 `NOTICE`）。

## 算法资源与构建物边界

| 资源 | 来源 / 许可证 | 审计结果 |
| --- | --- | --- |
| `algo/qmc/testdata/*` 的 23 个 `.bin` | 随 `um/cli@v0.2.12` 源码发布，根 MIT；每个文件哈希见下节 | 仅作为只读 QMC 算法固定夹具；不复制进 uNAS |
| `algo/ximalaya/x2m_scramble_table.bin`、`x3m_scramble_table.bin` | 同上，根 MIT | 不是本轮 KGM/QMC/NCM 夹具；不进入 uNAS |
| KGM v5 KGG 数据库 | `um/cli` 源码不随包提供 | **未发现、未锁定、未打包**；因此 KGM v5 只能保留结构识别，不能声明处理支持 |
| WASM / codec / 字体 / 图片 | 本版本源码快照未发现 KGM/QMC/NCM WASM 或可再分发媒体资源 | **未引入** |
| `um-web.extension.v1.10.8` | 维护者提供的外部构建物 | 仅静态参考；未加载、未执行、未进入 Git，不能作为许可证或能力证据 |

## KGM v5 KGG 审计启动（MD-01）

本轮已对 `um/cli@v0.2.12` 中 KGM v5 的 KGG 依赖做静态追踪：

- `cmd/um/main.go` 将 `--kgg-db` 定义为 `win32 kugou v11` 的本地数据库路径；未提供时默认读取 `%APPDATA%\Kugou8\KGMusicV3.db`。源码包和维护者 ZIP 均不包含该数据库；本机用户目录也未发现可审计的 `KGMusicV3.db`/KGG 候选文件。
- `algo/kgm/kgm_v5.go` 要求非空 `audio_hash` 与 KGG 路径，调用 `pc_kugou_db.CachedDumpEKey`，再按 `audio_hash` 查找 `EncryptionKey`；缺少数据库或条目时直接失败。
- `algo/kgm/pc_kugou_db/cipher.go` 明确注明实现移植自 `https://git.unlock-music.dev/um/lib_um_crypto_rust/src/tag/v0.1.10/um_crypto/kgm/src/pc_db_decrypt`。当前该上游地址的 Git 请求返回 HTTP 403，尚未取得可复核的 tag tree、许可证文件或提交快照，因此移植实现的独立来源/许可证仍未锁定。
- 已确认的包体边界：KGG 是用户本机的加密 SQLite 数据库，不是可随扩展分发的通用算法资源。实现按 `0x400` 页处理、校验 `SQLite format 3\x00`，使用内嵌 master key 解出数据库后读取 `ShareFileItems.EncryptionKeyId/EncryptionKey`；本轮没有复制、打包或读取任何真实数据库。

审计结论：KGM v5 的结构识别可以验证，但 KGG 实际样本的来源、所有权/授权、许可证、schema 版本和更新边界均未完成锁定；不得把 KGG 作为产品资源，也不得在 UI 中接受任意路径或自动搜集该数据库。后续若继续，必须由用户明确授权提供本地样本，并仅保留样本哈希、schema/字段证据，不进入 Git 或扩展包。

上游 QMC 资源逐项哈希：`mflac0_rc4_raw` `6c18349b03605d9160e828a0ac066b22a812d8ea3b2bfcc8237db5629b12c980`、`mflac0_rc4_suffix` `22aa3fc6c23e45dc4792e9ecf9227e79c1ea332d083f62d45e21bf8ff2f29593`、`mflac0_rc4_target` `91a976207eb9f68be50e5c52e3c55e57ffc635b06084e1e612fbf9b7b8826c07`；`mflac_rc4_raw` `70c47fc9f5c90ee47bc36724a7d04b93d18ff59bb2af264e86c3225e8aeb7e4e`、`mflac_rc4_suffix` `d0fe4c044885fb43a06d5ef91577f7e2ad96a1748cfec1f0a8720d438b9efbaf`、`mflac_rc4_target` `55d91ae43628163abc4c87d492130fae221e9b0463ffacf2b2c2f94c6a72293d`；`mflac_map_raw` `259fb72431bdca9c515251b196759cc0394a213c4567e74deaff85c77b1a0462`、`mflac_map_suffix` `31e90d37430eb835680423a05837a11ba582430f2dcae413efbf9efc122a3696`、`mflac_map_target` `c12855eefde592bfef686e6ae9604f4310078a1fdd60ab8dd31594fa514c8e06`；`mgg_map_raw` `27e1dc812b379a77f5007f033d4635f88fec6bea06eaf14cf6d31659e90e820f`、`mgg_map_suffix` `b7081377c658c89ba6c2815e22304008b061344c050878937f53f495b09feb30`、`mgg_map_target` `6b0351525492ec4faf95412ebe5ae96362d01dd627bea618ce029a5ef9f1581a`；`qmc0_static_raw` `2314ffe88bf1a83000e78ab661bc9aa3bc0fb48e544d2efb9475871cbf681131`、空 suffix 的 SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`、`qmc0_static_target` `4b5b9c78ec2f88e7c4354a2cda412faa19f26869293249ab4a97e00f773337fb`。

同一组中用于密钥派生的文件也已固定：`mflac0_rc4_key_raw` `c3cb13581741702960c216f26b03fffb1cd002f733937681efc48576d0edeb17`、`mflac0_rc4_key` `6b33752908c0e4f5b499c4b521ae3e1b85eb5320788704e335ec0cadbca5a852`；`mflac_rc4_key_raw` `efabb9ce8cacab67bbe425d575776791ff7061166397ca74cd540eb883e11f52`、`mflac_rc4_key` `76684dd85ddb3e1991deae734bcad819b794d9862b8316ae6acd527a77c53003`；`mflac_map_key_raw` `562432aaded465d13db2ff6bcdbb2ac4c91842daafb329967e5125dcfabf69a1`、`mflac_map_key` `9e6c9310741ec3c90d233aa0cdd39158c76057e5ad204e4cb6868d586da32d66`；`mgg_map_key_raw` `eb15ae2f5096fae3cc05c60932360af847b320c45585c9eea34b9bbdf6d70385`、`mgg_map_key` `f2d330151c3dfb694ef9182d179a26e205f94627a181f6d1e061b42cde3d0e1c`。同快照的非本轮资源 `algo/ximalaya/x2m_scramble_table.bin` SHA-256 为 `f47bc3ea94f109650f9753329b4faa62b77eab1d37df738413c819b344838605`，`x3m_scramble_table.bin` SHA-256 为 `5cd0abe24ad9b04b31262f552605b62c78549f8c4aef3bf54e6c780d7e3de39e`；两者不进入本轮夹具或产品包。

## MD-01 结论

- **已验证：** 根项目 `v0.2.12` 的来源、tag/SHA、Module checksum、MIT 根许可证；维护者 ZIP 与 Module Proxy 快照一致；`go.mod` 声明的 25 个可取得许可证的模块；上游 QMC 测试资源的来源与哈希；本轮未把任何第三方源码、WASM、数据库或构建物带入 uNAS。
- **未验证：** 上游 `unlock-music.dev/mmkv@v0.1.0` 的许可证/再分发授权（该依赖已退出 uNAS 产品路线）；完整 Go module graph；KGM v5 KGG 实际数据库的 provenance/许可证/schema/包体边界；uNAS 自有 MMKV 兼容层（尚未实现）。
- **不支持：** 任何真实格式解密、音频输出、在线元数据/封面、MMKV 文件路径读取、Native Helper 或 DRM 绕过。
