# 技术债

技术债是已经进入实现、当前有意保留且未来需要偿还的妥协。尚未实现或尚未验证的外部假设属于 [RISK_REGISTER.md](RISK_REGISTER.md)。

## 分级

- **P0**：数据安全、正确性或当前候选版本阻断。
- **P1**：明显影响可靠性、性能或维护性，应在近期迭代偿还。
- **P2**：长期结构优化。

## 活跃技术债

TD-001 的拆分、验证范围与关闭记录见 [2026-09 归档](archive/tech-debt/2026-09.md)。

### TD-002：全局兼容样式的局部化迁移

- **优先级 / 位置 / 来源 / 目标阶段：** P1；`apps/extension/src/styles/accessibility.css`、各 App 私有样式；uNAS Glass 工作包 A；UI-Glass-D。
- **当前妥协与原因：** 2026-09-20 已完成代码迁移：删除全局浅色补丁和 App 私有 `--mt-*` 定义，Settings 独立样式，下载器/日志/PSD/Transcode 使用共享 Token，密码浮窗通过展示层适配消费同一主题源；目标 Chrome 人工走查尚缺，保留本项待验收，不继续扩大代码改版。
- **影响与最坏结果：** 自动化未覆盖的工具栏真实手势、200% 浏览器缩放、触控或存量未注册工具仍可能出现视觉差异；不能由构建通过推定验收。
- **剩余偿还方案：** 在维护者实际加载扩展的 Chrome Profile 按 UI-Glass-E 完成截图对照和人工确认；系统 Chrome 153 的本轮自动化未等到 Service Worker，需先恢复该测试入口或直接人工加载。细节见[本轮证据](archive/reviews/2026-09-20-theme-debt.md)。
- **验证方式：** 保留 `themeOwnership.test.ts` 防止别名/全局补丁回流，`appTheme.spec.ts` 检查深浅主题、键盘焦点与窄屏降级；`pnpm verify`、`pnpm test:e2e` 及 Quality 第 5 节人工证据全部满足后归档。

### TD-003：Legacy 密码能力尚未完成应用级解耦

- **优先级 / 位置 / 来源 / 目标阶段：** P1；密码模块 background、popup、shared/api 与 WXT 构建；2026-09-23 撤除前审查；Legacy Retirement。
- **当前妥协与原因：** CredentialSource registry 隔离了 Vault core 的旧 API/WASM 依赖，但 service-worker 仍静态导入并安装 Legacy source、登录与 Jupiter 生命周期；credential-access 直接调用旧 catalog，page-overlay 和 user-scope-guard 仍接旧会话；popup/settings/catalog 仍提供兼容入口。原有空 registry 测试不证明完整扩展能删除 Legacy。
- **影响与最坏结果：** 只删 legacy-credential-source 或停止注册，会留下网络/保活/权限/WASM 和 UI 死入口；直接删 shared/api 会使填充/登录路由断裂。本轮保留运行行为，不删存量数据。
- **偿还方案：** 先把旧登录、目录、availability、scope、填充分支和 lifecycle 收拢到单独 composition adapter；随后切换 WebDAV-only 目录/会话和浮窗，拒绝已退役消息；最后移除旧 API/WASM、运行配置、专属 host/cookies 权限及包体白名单。不能误删广告模块规则源或 WebDAV 加密兼容 key。
- **验证方式：** 禁用 adapter 后构建整包并检查导入图/manifest/网络，再覆盖 Desktop 与浮窗的目录、创建/连接/重连、锁定、填充和取消；真实 WebDAV 多端冲突与目标 Chrome 工具栏手势通过后，才删除兼容文件并归档。

不得用空的“以后优化”占位；产生真实妥协时按下列字段登记：

```text
TD-XXX：标题
优先级 / 位置 / 来源 / 目标阶段
当前妥协与原因
影响与最坏结果
偿还方案
验证方式
```

## 生命周期

1. 红绿灯审查中的跨任务 🟡 或明确延期的实现妥协进入本文件。
2. P0 若影响阶段推进，在 Context 只保留 ID 与一句摘要。
3. 修复必须有回归证据；完成后移入 `docs/archive/tech-debt/YYYY-MM.md`。
4. 单纯的功能计划、依赖选型和浏览器未知不得伪装成技术债。
