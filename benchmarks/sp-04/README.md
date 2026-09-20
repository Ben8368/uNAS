# SP-04：Archive ZIP

## 问题 / 阻断 Gate

验证解包 MV3 扩展能否在用户已授权的目录中安全解压单个 ZIP。该探针关联 RISK-007；记录受限实现、正向路径及 SP-04-A/B/C 的限定证据，不关闭 Archive 模块 Gate。

## 实现边界

- 输入：单个 `.zip`，先验证 ZIP magic；最大 50 MiB。
- Worker：打包的 `archive-worker.js` 使用 `@zip.js/zip.js 2.8.60` 严格读取，禁用其内部 Worker；最多 200 项、单项 32 MiB、展开总量 64 MiB、深度最多 12。
- 安全：ZIP magic 按合法字节对匹配；拒绝绝对/反斜杠/穿越/保留名路径、加密、软链接、NFC/大小写折叠后的重复条目和所有条目的文件祖先冲突；读取时校验 CRC。
- 输出：先把已验证 Blob 暂存于受限内存，再创建唯一同级目录提交；不覆盖已有项目。取消仅在提交前生效，会立即终止 prepare Worker 并清除 owner 对暂存 Blob 的引用。提交失败不标记成功并保留已写入的部分结果。

## 已验证证据

- 2026-09-10，Windows win32 10.0.26200 x64、Playwright bundled Chromium、解包 MV3：`pnpm build:extension` 后运行 `pnpm --dir apps/extension exec playwright test e2e/archiveExtraction.spec.ts` 通过。
- 夹具是内联、可复现的 Store/Deflate ZIP：`nested/hello.txt` 内容为 `uNAS ZIP extraction fixture`。测试将其写入隔离 OPFS handle，经过真实的扩展页 Dedicated Worker，确认 CRC 校验后的新目录 `fixture（解压）/nested/hello.txt` 内容精确一致；无页面错误、无 HTTP(S) 请求。
- 单元测试 `src/archive/zipSafety.test.ts` 覆盖相对路径、穿越/绝对/盘符/反斜杠/保留名/重复分隔符、加密、软链接、文件目录冲突和资源上限。

## 未覆盖

- ZIP64、真实解码膨胀/内存压力、原生 OS 目录与权限拒绝、Worker 崩溃、配额失败，以及目标 Chrome Stable 的人工验证和资源测量。SP-04-B 已覆盖预提交取消及 Files 窗口关闭，SP-04-C 已覆盖受控提交写入失败，不等同浏览器标签/进程被强制终止或提交阶段的页面关闭；小型声明超限夹具不等于压缩炸弹压力测试。
- 不支持 RAR、7z、TAR、分卷、密码输入或损坏包修复；不把本探针结论外推为通用 ZIP 支持。

## 当前结论

受限 ZIP 解压整体仍为**已实现未验证**；SP-04-A 的限定自动化拒绝路径、SP-04-B 的预提交取消路径和 SP-04-C 的提交写入失败路径均已验证，但 RISK-007 仍阻断 Archive 模块 Gate。后续证据和范围变化只更新本记录与 RISK-007。

## SP-04-A：真实 Worker 负向夹具

- 2026-09-20，bundled Chromium 151.0.7922.34，Windows win32 10.0.26200 x64，headless 1440×900，隔离临时 Profile 和固定 OPFS 子目录；不操作用户目录或密码库。
- [archiveFixtures.ts](../../apps/extension/e2e/archiveFixtures.ts) 确定性生成 18 个负例与一个合法 Deflate 对照；全部为自生成小型内容，fixture data 按 CC0-1.0 提供，无第三方素材。测试附件 `fixture-manifest` 保存各项大小、SHA-256、来源及期望；源码可重建，不提交二进制产物。
- [archiveNegative.spec.ts](../../apps/extension/e2e/archiveNegative.spec.ts) 经真实 Files UI/port/打包 Worker 验证：伪扩展名、非法 magic 对、截断目录、CRC 错误、穿越/绝对/反斜杠/保留名、加密标记、软链接标记、重复名、文件祖先/目录后代、大小写冲突及条目/总量/数量/深度预算。入口拒绝项不进入 Worker；合法 ZIP 结构负例由 Worker 处理。
- 每个失败都断言没有输出目录和成功提示；整组失败后合法对照仍可执行，最终文本内容精确一致，页面错误及非订阅远程请求为空。结束仅删除临时 Profile 中专用 OPFS 测试目录。
- 测试先复现 `parent` 文件加 `parent/child/` 显式目录漏检：旧版进入提交后留下部分目录。现在检查所有路径的文件祖先；同时拒绝 NFC/大小写折叠后的重复名、按合法 ZIP magic 字节对初筛。单测覆盖目录顺序反转与 Unicode 等价名称。
- 定向命令：`pnpm build:extension`；`pnpm --dir apps/extension exec playwright test e2e/archiveNegative.spec.ts e2e/archiveExtraction.spec.ts --reporter=list`。结果：2/2 通过（8.8 秒，仅整组测试时长，不是解压性能）。
- 完整回归：`pnpm verify` 通过（32 个测试文件、155 个测试；治理、lint、边界、依赖、类型、Web/MV3 构建和包体检查通过）；随后 `pnpm --dir apps/extension exec playwright test --reporter=list` 47/47 通过（2.0 分钟，0 skipped）。MV3 包体 949,935 B、初始静态 JS 261,010 B；不将包体或测试时长当成峰值内存/性能承诺。
- 这些夹具没有证明任意加密算法、跨文件系统所有别名、外部并发写入、强制终止或提交回滚能力。RISK-007 保持开放。

## SP-04-B：预提交取消与暂存清理

- 2026-09-20，bundled Chromium 151.0.7922.34，Windows win32 10.0.26200 x64，headless 1440×900，隔离临时 Profile 和固定 OPFS 子目录；仅使用 [archiveFixtures.ts](../../apps/extension/e2e/archiveFixtures.ts) 生成的合法 Deflate ZIP，不操作用户目录、密码库或网络服务。
- [zipExtraction.ts](../../apps/extension/src/api/real/zipExtraction.ts) 的 `cancel()` 会立即断开 Worker 回调、终止 Dedicated Worker，并清空 owner 对已暂存 Blob 的引用；此时尚未创建输出目录。Files 组件在自身卸载和 `pagehide` 时请求同一取消操作；提交开始后仍不允许取消。
- [zipExtraction.test.ts](../../apps/extension/src/api/real/zipExtraction.test.ts) 用不响应的合成 Worker 断言取消会拒绝结果、终止 Worker 且移除回调，不等待 ACK 或解码器合作响应。
- [archiveCancellation.spec.ts](../../apps/extension/e2e/archiveCancellation.spec.ts) 仅在测试页包装 `Worker` 并拦截 ACK，使真实打包 Worker 停在 prepare；用户界面“取消解压”后断言无新输出目录，恢复未包装 Worker 后同一合法 ZIP 成功。再次停在 prepare 后关闭 Files 窗口，断言同样没有第二个输出目录。测试结束只递归删除临时 Profile 中固定创建的 OPFS 子目录。
- 定向命令：`pnpm --dir apps/extension exec vitest run src/api/real/zipExtraction.test.ts src/archive/zipSafety.test.ts`（2 文件、11 测试通过）；`pnpm build:extension`；`pnpm --dir apps/extension exec playwright test e2e/archiveCancellation.spec.ts e2e/archiveNegative.spec.ts e2e/archiveExtraction.spec.ts --reporter=list`（3/3 通过，12.2 秒，仅测试时长）。
- 完整回归：完整扩展 E2E 按测试文件分组运行以保留终态输出，48/48 通过、0 skipped（bundled Chromium；不是目标 Chrome Stable 验收）。`pnpm verify` 已运行；此环境的命令桥在 Vite 输出时截断最终退出码，因而不把它标记为“通过”。其可见组成门禁已分别通过：治理、lint、边界、依赖、33 个单测文件/156 测试、类型检查、Web/MV3 构建与包体检查；`pnpm build:demo`、`pnpm build:extension`、`pnpm check:package` 随后又独立通过。
- 已关闭的限定证据缺口：预提交用户取消、Files 窗口关闭时的预提交取消、Worker/owner 暂存引用清理的单元级行为。未关闭：浏览器标签或进程强制终止、提交中的关闭/取消、Worker 崩溃、写入失败后部分输出、原生目录权限、ZIP64、真实炸弹压力和峰值内存。没有测量浏览器堆/进程峰值，因此不能把引用清理写成内存上限或性能结论；RISK-007 保持开放。

## SP-04-C：提交阶段受控写入失败与部分输出

- 2026-09-20，bundled Chromium 151.0.7922.34，Windows win32 10.0.26200 x64，headless 1440×900，隔离临时 Profile 和固定 OPFS 子目录；仅使用 [archiveFixtures.ts](../../apps/extension/e2e/archiveFixtures.ts) 生成的双文件合法 Deflate ZIP，不操作用户目录、密码库或网络服务。
- [archiveWriteFailure.spec.ts](../../apps/extension/e2e/archiveWriteFailure.spec.ts) 只在测试页面临时替换 `FileSystemFileHandle.prototype.createWritable`，让第二个输出文件返回受控 `NotAllowedError`；没有增加产品运行时开关或权限。测试断言 UI 进入失败态，错误包含已写入文件数且不显示成功，输出目录保留首个已写入文件。
- 测试随后恢复原生写入方法，在同一隔离目录再次解压同一 ZIP；新目录使用唯一后缀并完整写入两个文件，证明提交失败后 owner/Worker 不被卡死，失败不伪装为成功。
- 定向命令：`pnpm build:extension`；`pnpm --dir apps/extension exec playwright test e2e/archiveWriteFailure.spec.ts --reporter=list`（1/1 通过，3.2 秒，仅测试时长）。完整 MV3 回归随后 49/49 通过、0 skipped（2.0 分钟；bundled Chromium，不是目标 Chrome Stable 验收）。
- 该证据证明当前契约允许提交失败保留部分输出并提供可解释错误，不证明原子提交、自动回滚、原生目录权限失败、配额失败或页面/进程终止恢复；RISK-007 保持开放。

## 当前尚缺：目标 Chrome 与资源证据

以下缺口仍属于 Archive 模块 Gate 的未验证证据，不改变 SP-04-A/B/C 已记录的限定结论：

- **目标 Chrome：** 尚未在维护者基线 Chrome Stable 152.0.7977.82 / Windows win32 10.0.26200 x64 的解包 MV3 扩展中，人工复走 A/B/C 的真实目录授权、预提交取消、Files 窗口关闭、受控提交失败和后续重试路径；CI #35 的 Browser regression 使用 Playwright bundled Chromium，不能替代该证据。
- **资源测量：** 尚未在目标 Chrome 中记录输入读取、Worker、暂存 Blob、输出写入和清理的峰值 JS/Worker/Chrome 进程内存、OPFS 配额占用及可复现的资源采样方法。
- **压力夹具：** 尚未用 ZIP64、真实高压缩比/展开膨胀和接近当前 50 MiB 输入、32 MiB 单项、64 MiB 总展开、200 项、深度 12 上限的夹具完成资源曲线；小型声明超限负例只证明拒绝，不证明压力下的内存或性能边界。
- **资源失败态：** 尚未在目标 Chrome 记录配额耗尽、原生目录权限拒绝、Worker 崩溃或强制终止后的资源清理与终态；这些不应由现有取消或受控写入失败证据推断。
