# 维护者职责

当前尚未指定具体账号；在 `CODEOWNERS` 建立前，以本文件定义责任域和升级条件。

## 责任域

| 领域 | 规划范围 | 合并前重点 |
| --- | --- | --- |
| Product / UX | Product、用户路径、单一用途、能力文案 | 范围真实、商店可解释、无夸大承诺 |
| Design System | token、Liquid Glass、响应式、动效、无障碍 | 原创、可读、可降级、资产有许可 |
| App Platform | manifest、Intent、窗口、Link App、文件关联 | schema、生命周期、权限和迁移 |
| Contracts / Core | schema、Job、planner、resource governor | 版本兼容、状态机、取消、幂等和测试 |
| File System | File/Handle、OPFS、导出、恢复 | 权限、配额、原子输出、临时数据清理 |
| Engines / Workers | Image/Media/Archive/PDF、adapter、WASM | 输入探测、资源预算、输出验证、取消 |
| Frontend | New Tab、Workspace、Desktop、Tool App、mock | 不直连引擎、mock 可识别、状态完整 |
| Extension Runtime | WXT、MV3、消息、权限、生命周期和商店包 | 最小权限、CSP、owner、无远程代码 |
| Security / Supply Chain | 数据流、依赖、WASM、素材、发布 | 许可证、哈希、隐私、升级和回滚 |
| Governance / Quality | AGENTS、Context、Roadmap、Risk、测试 | 事实源、证据状态、门禁和归档 |

## 必须升级评审

- Product V1 范围、目标浏览器或隐私承诺变化。
- App 类型、Link App 能力、New Tab/Workspace 所有权或 Liquid Glass 基础规则变化。
- `packages/contracts` 的破坏性变化、Job 终态或自动重试语义。
- 文件覆盖、目录写入、持久化、上传、遥测或工作区外访问。
- Extension host permissions、downloads、cookies、剪贴板、nativeMessaging 或远程资源。
- ffmpeg/native 命令、WASM core 组成、cross-origin isolation 或 CSP。
- 新增运行时依赖、codec、字体、素材、发布来源或许可证变化。
- Native Helper、桌面壳、服务端处理、账号或云同步。

## 合并原则

- 🔴 不得合并；🟡 必须进入 Risk 或 Tech Debt 的唯一位置。
- 客观验证和主观确认分开记录。
- 安全、架构和公开契约变化必须有 ADR。
- 未指定负责人时，Gate 评审由项目发起人承担；高风险领域宁可停在提议状态，不以“默认同意”推进。
