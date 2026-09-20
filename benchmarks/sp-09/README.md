# SP-09 Music encrypted-container 来源与浏览器可行性

## 状态

计划；本记录只登记来源同步和静态审计事实，不证明 uNAS 已支持任何解密格式。

## 来源与复现

- 候选源码：`https://git.unlock-music.dev/um/cli`
- 版本：Go module `unlock-music.dev/cli@v0.2.12`
- 来源提交：`61fba401c7ba83e6a0e69a528460f08f0f707c`
- Module checksum：`h1:mB/qjsILXij9I6jd3EInlIHlFERNX6ePypJ6WyEvcjk=`
- 根许可证：MIT，版权行是 `Copyright (c) 2020-2021 Unlock Music`
- 同步方法：`go mod download -json unlock-music.dev/cli@v0.2.12`，再将 Module Proxy zip 展开到系统临时目录；直接 Git/归档请求受站点 Cloudflare 403 阻断，本轮没有绕过验证。
- 临时源码快照：82 个文件，约 802,812 bytes；不进入 uNAS Git、依赖锁文件或扩展包。
- 主线对照：`go mod download -json unlock-music.dev/cli@main` 当前由 Module Proxy 解析为伪版本 `v0.2.13-0.20250509022122-0a94383ba337`，checksum 为 `h1:XUW+zyNOsR0G0qnq3RNB5yB+kDa69N8sstNVXnJtGHg=`；网页当前 `main` 页面显示的提交为 `589e573b...`，两者不一致，因此不把 Module Proxy 的 `@main` 快照当作当前主线事实。

## 本地构建物静态观察

维护者提供的 `um-web.extension.v1.10.8` 位于本机 Downloads 临时参考路径，未复制到仓库、未加载扩展、未执行其中脚本。构建物共 23 个文件，约 3,338,460 bytes，未发现 source map。

| 文件 | SHA-256 | 观察 |
| --- | --- | --- |
| `manifest.json` | `5D5129ADCBEC2BCF46EB60486D53663CD5C25D7006A2EFDBB14029BD5A739518` | MV3；`storage`；`wasm-unsafe-eval`；popup/options 页面 |
| `js/app.e0ad8f6c.js` | `BBE7E0BC7D2C5E695930541BE1E33C7BD5C3026C57FB44933F869EA097F1123D` | UI 调度、文件选择和 Worker pool 调用 |
| `js/0.fab5c26d.worker.js` | `16D41BB45858FA693F5084E7DD17797D0A4F0E4BC489D68B979D760575BE121E` | NCM JS 路径、QMC/KGM WASM 调用与 Worker runtime |

观察到的实现线索：NCM 有直接的浏览器字节处理路径；QMC/KGM 会在 `WebAssembly` 可用时调用 WASM；输出会创建 Blob 并解析音频元数据；目录写入通过用户手势触发的 `showDirectoryPicker`。这些只能作为历史构建物的技术线索，不能替代 uNAS 的能力探针。

## 当前审计结论

- **NCM：** 候选 TypeScript/Worker 路线；远程封面或元数据请求必须从 uNAS 路径排除。
- **QMC：** 变体多，且 Go 实现含 MMKV/文件路径分支；先做变体矩阵和浏览器密钥路径验证。
- **KGM：** v3 与 v5 需分开验收；v5 依赖 KGG 数据库和 `audio_hash`，资源 provenance 与浏览器打包边界尚未关闭。
- **供应链：** 根项目是 MIT，不等于所有 Go 依赖、WASM、数据库、夹具和构建物都已完成再分发审查。
- **产品边界：** 仅考虑用户明确有权处理的本地文件；不接入在线链接、账号、密钥获取、远程服务、Native Helper 或 DRM 绕过。

## 下一步证据

详见 [SP-09 计划](../../docs/DEVELOPMENT_BLUEPRINT.md#sp-09-music-encrypted-container-来源与浏览器可行性) 与 [Music Module Gate](../../docs/ROADMAP.md#music-module-gate)。关闭前需要依赖许可证清单、授权夹具 manifest/SHA-256、目标 Chrome Worker/WASM/CSP/内存/取消/清理证据和不支持表。
