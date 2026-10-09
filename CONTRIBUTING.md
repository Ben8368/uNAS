# 贡献指南

uNAS 的阶段、已验证范围和近期优先级以 [CONTEXT.md](CONTEXT.md) 为准。贡献的首要目标是减少不确定性，而不是扩大功能列表。

## 开始前

1. 阅读 [AGENTS.md](AGENTS.md)、[CONTEXT.md](CONTEXT.md) 和任务命中的专题文档。
2. 确认任务属于当前 Roadmap 阶段，并满足对应入口门禁。
3. 涉及长期边界、权限、数据流、公开契约或新运行时依赖时，先新增或更新 ADR。

## 分支与提交

- 从 `main` 创建短生命周期分支，例如 `docs/refine-v1-scope`、`spike/ffmpeg-wasm-baseline`。
- commit message 标题和正文使用中文；Conventional Commit 类型前缀保留英文，例如 `docs: 建立能力矩阵模板`。
- 一个提交只表达一个主题；不要把契约、引擎、UI 和文档堆成无法审查的巨型提交。
- AI 工具参与实质改动并提交时，按 [docs/AI_RULES.md](docs/AI_RULES.md) 追加对应 `Co-authored-by` trailer；主作者保持维护者身份。
- AI trailer 记录工具来源而非具体模型；历史模型级署名不回改，后续按工具级映射统一。
- 不得提交 `.env`、账号凭据、客户文件、浏览器数据、未授权素材、WASM 临时构建物或性能测试原始大文件。

## 当前允许的改动

- Phase 0：文档、治理检查、ADR、风险和技术探针设计。
- Gate G0 通过后：Phase 1 的 Frontend Demo、mock scenario 和不含真实 engine 的扩展壳。
- Gate G1 通过后：Phase 2 的隔离能力探针和固定测试夹具。
- 正式产品脚手架与功能实现必须按 [ROADMAP.md](docs/ROADMAP.md) 的阶段门禁推进。

## 验证

文档改动至少运行：

```powershell
node scripts/governance-docs-check.mjs
```

引入产品源码后统一运行 `pnpm verify`。测试、类型检查、构建或能力探针未运行时，必须明确写“未运行”及原因，不得写成通过。

## PR 必备信息

- 改动目的与所处阶段。
- 主要文件和事实源变化。
- 验证命令、结果和未覆盖项。
- 是否改变产品范围、共享契约、权限、文件处理、安全或供应链边界。
- 是否需要 ADR、风险、技术债或 Context 更新。

责任域和必须升级评审的改动见 [docs/MAINTAINERS.md](docs/MAINTAINERS.md)。
