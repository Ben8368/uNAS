# ADR 0025: 用户提供 QMC ekey 清单作为受控本地输入

- 状态：已接受
- 日期：2026-10-20

## 背景

上游 `um/cli` 在 v0.2.20 中支持 QMC `musicex`（`cex\0`）和无 footer 的 legacy QMC 文件，但密钥来自 QQ 音乐本机 MMKV、Android `player_process_db` 或 Windows `qmpc-mmkv-cli`。uNAS 是 Manifest V3 扩展，不能自动读取这些本机路径，也不能引入 Native Helper；[ADR 0010](0010-clean-room-mmkv-replacement.md) 只允许自有 clean-room MMKV 实现，当前尚无实现和可再分发夹具。维护者选择在受控边界内扩展能力：允许用户主动提供已经由自己导出的 ekey 清单。

## 决策

1. 允许用户通过受控文件选择器主动选择一个本地 ekey 清单文件。UI 只传递不透明的 `File` 引用，不解析、不读取、不向 Worker 传递密钥字符串或本机路径。
2. 清单仅支持本地文本格式：JSON 对象 `{ "文件名": "ekey" }`，或“文件名 / ekey”交替行（兼容用户自行导出的 `qmpc-mmkv-cli -f plaintext` 输出）。清单在 Worker 内解析，限制 1 MiB、10,000 项、名称和 ekey 各 4,096 字符，拒绝控制字符、空值和冲突重复项。
3. 清单只用于两类路径：QMC `musicex` 按 `MediaFileName` 查找；无 footer 的 legacy QMC 按用户选择的文件名查找。raw-key/QTag 的内嵌 key 优先。查找先做 NFC 精确匹配，再做唯一的 basename 匹配；歧义或缺失直接结构化失败，不猜测。
4. ekey 只在 Worker 内存中短暂存在，不写入 OPFS、storage、IndexedDB、日志、错误消息、跨上下文消息或遥测；任务结束或取消后随作用域释放。UI 只显示清单文件名、大小和 key 来源。
5. 继续禁止自动发现、扫描或读取 MMKV/SQLite/KGG 文件，禁止调用 Windows 原生 CLI 或 Native Helper，禁止联网获取账号、密钥、封面或元数据。
6. 直接解析 MMKV/SQLite/KGG 需要新的 ADR、自有 clean-room 实现和独立审查；本条 ADR 不授权这些能力。
7. 对 [ADR 0011](0011-local-authorized-music-processing.md) 的“UI 不传递任意密钥”补充解释：用户主动选择的清单文件属于受控输入引用，不是 UI 传入的密钥或路径；密钥解析必须留在 Worker。

## 后果

- QMC `cex\0`/musicex 和 legacy keyed 文件可以本地处理，但前提是用户提供匹配的 ekey 清单；没有清单时保持清晰的“不支持/缺少 key”失败。
- 扩展不新增权限，不读取任意路径，不联网；用户清单不会被持久化或上传。
- 直接 MMKV/SQLite 读取、KGM v5 KGG、Windows 原生工具和目标 Chrome 验收仍不支持或未验证，[RISK-015](../RISK_REGISTER.md) 保持开放。
- 测试使用 uNAS 自行生成的合成 QMC 向量，不复制上游夹具、真实用户媒体或真实 ekey。

## 替代方案

- **自动读取本机 MMKV/SQLite/KGG：** 超出扩展的路径与权限边界，且缺少 clean-room 实现和可再分发夹具，拒绝。
- **运行 `qmpc-mmkv-cli` 或引入 Native Helper：** 违反 ADR 0011 和扩展安全边界，拒绝。
- **在 UI 直接输入密钥字符串：** 密钥会进入 UI realm、日志和错误路径，难以约束；改为 Worker 解析用户选择的文件，拒绝。

## 关联文档

- [ADR 0010](0010-clean-room-mmkv-replacement.md)
- [ADR 0011](0011-local-authorized-music-processing.md)
- [SECURITY.md](../../SECURITY.md)
- [RISK-015](../RISK_REGISTER.md)
- [SP-09](../../benchmarks/sp-09/README.md)
