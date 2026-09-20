# ADR 0011: Local Authorized Music Container Processing

- 状态：已接受
- 日期：2026-09-20

## 背景

uNAS 已完成 KGM、QMC、NCM 的结构识别探针，但原有安全文案把本地容器解密与在线 DRM 绕过混为一谈，导致真实本地验证路径没有明确的产品边界。维护者要求继续实现本地 NCM 解密能力。

## 决策

- 允许 uNAS 处理用户主动选择、并由用户确认有权本地处理的已下载 KGM/QMC/NCM 文件；该能力仅限本地文件，不扩展到在线播放、流媒体、账号授权或站点服务。
- 解密、元数据处理和输出验证必须进入受控 Worker/adapter；UI 只通过 FileRef、Task 和 Capability contract 调用，不传递任意路径或密钥。
- 禁止网络获取账号、密钥、封面、元数据或远程代码；禁止 Native Helper、远程解密服务、自动扫描用户目录和内容上传。
- 原始文件只读；输出必须经过独立的音频签名/编码/内容验证，先暂存后由用户明确导出，不默认覆盖原文件。
- 真实测试只使用用户明确有权处理的固定夹具。仓库只保存来源、授权说明、manifest、输入/预期结果 SHA-256 和必要的结构元数据，不保存真实用户媒体、解密音频或账号材料。
- 每种格式仍需独立通过 Music Module Gate，完成 Worker、目标 Chrome、资源预算、取消、页面关闭、清理和输出证据后，才能进入 Tool App、文件关联或产品支持声明。

## 后果

- 本地 NCM/KGM/QMC 解密成为允许研究和实现的能力，不再因“所有 DRM 一概禁止”而被文档边界阻断。
- 在线 DRM/付费墙/站点授权绕过、账号或密钥获取、远程服务和内容再分发仍然明确不在范围内。
- 本 ADR 不代表任何格式已经实现或通过验收；SP-09 当前仍只完成 MD-01/MD-02，MD-03～MD-09 需要继续执行。

## 替代方案

- **继续只做结构探针：** 保留安全边界但无法满足本地解密验证目标，拒绝。
- **允许在线或账号路径：** 会扩大权限、隐私和滥用风险，拒绝。
- **运行上游 Go CLI 或复用未授权源码：** 不符合供应链和扩展架构边界，拒绝。

## 关联文档

- [Product](../PRODUCT.md)
- [Security](../../SECURITY.md)
- [Roadmap](../ROADMAP.md#music-module-gate)
- [SP-09](../../benchmarks/sp-09/README.md)
- [RISK-015](../RISK_REGISTER.md#risk-015p0music-encrypted-container-来源与浏览器边界尚未验证)
