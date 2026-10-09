# ADR 0021: uNAS 单一品牌与独立维护

- 状态：已接受
- 日期：2026-10-09

## 背景

维护者明确要求本仓库与此前的独立密码扩展项目完全剥离，后续不再关联，对外只保留 uNAS。此前 ADR 0019 的下游镜像与单向导出不再符合维护意图。

## 决策

- 本仓库只维护和对外发布 uNAS。不存在上游、下游镜像、回同步、独立版本跟随或跨仓库发布约定；移除导出脚本、同步草稿及包内独立 CI/release 工作流。不得自动恢复这些关系。
- 密码兼容代码改为内部包 `packages/password-compat`（`@unas/password-compat`）；宿主只经 `@unas/password-compat/legacy` 消费。Rust/WASM、安全测试、依赖审计继续由根 CI 验证，独立构建仅作内部 smoke/hardened 测试壳，不是第二个产品。
- 用户可见标题、提示、无障碍标签和 manifest 使用 uNAS 或功能名。测试壳移除原商店公钥/固定身份，不查询外部商店、不要求下一补丁版本。既有企业服务请求版号只是协议兼容常量，不代表发布版本跟随。
- 已持久化 storage/IndexedDB 键、Vault ID、envelope/加密上下文、企业服务域名及 WASM 协议保留原值，避免品牌清理破坏已有密码库或登录。它们不是对外品牌，也不构成仓库维护关系。历史 ADR、验收记录及资源出处保留真实来源，不篡改既有证据或许可证。
- 不修改独立仓库、账号级 secrets、Git 历史或远程发布；现存外部自动化若有，须由维护者另行停用。本仓库无其他 Git remote。

## 后果

内部包目录与命令变更，重新运行 `pnpm install --frozen-lockfile` 更新本地 workspace 链接；已有 uNAS 用户数据无需迁移。保留 npm lock 只为包级依赖审计，根 pnpm lock 仍为安装事实源。真实企业登录、WebDAV、目标 Chrome 人工验收和 Linux WASM 复现仍按既有风险门禁执行，不由品牌重命名证明。

## 替代方案

- 仅替换标题、保留镜像导出：拒绝，未解除维护关联。
- 无差别替换所有旧标识：拒绝，会破坏密码库持久化和外部协议。
- 删除密码兼容能力：不在本轮品牌与仓库剥离范围，仍按 TD-003 独立规划。

## 关联文档

替代 [ADR 0019](0019-unipass-monorepo-package.md)；修订旧品牌整合相关条款，其他安全边界仍有效。参见 [Architecture](../ARCHITECTURE.md)、[Security](../../SECURITY.md)、[Tech Debt](../TECH_DEBT.md)。
