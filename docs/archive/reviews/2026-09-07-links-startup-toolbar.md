# Link App、启动错误与工具栏入口验收

日期：2026-09-07。范围：Phase 1 mock Demo，不接入真实文件、引擎或后端。

## 改动

- Link App 写入复用读取校验：整体字符预算、数量、schema、重复 ID 和名称均在覆盖存储前验证，拒绝时保留旧配置。
- 编辑提交读取最新配置，检测记录已删除或已修改，失败保留草稿；合并未冲突的其他记录。本轮不把 localStorage 读改写宣称为跨进程事务。
- 启动器只捕获主模块加载/初始化失败，不再用全局运行期错误覆盖已挂载的 React 根；Web 错误消息使用 textContent。
- Manifest 声明 action，无 popup；后台 action 事件每次新开并激活固定的 newtab.html，保留原标签页，不新增权限。
- 保留工作区原有的启动外观改动，并纳入全部回归。

## 客观验证

环境：Windows win32 10.0.26200 x64，Playwright Chromium 151.0.7922.34，headless 解包 MV3；默认视口 1440×900，布局矩阵另含 Regular/Compact 等场景。

| 命令 | 结果 |
| --- | --- |
| `pnpm verify` | 91 项单测、类型、双构建、治理、依赖、边界和包体检查通过 |
| `pnpm test:e2e` | 最终 23/23 通过 |
| `pnpm --dir apps/extension run test:e2e:web` | 3/3 通过 |
| `pnpm --dir apps/extension exec playwright test e2e/toolbarAction.spec.ts --repeat-each=5` | 5/5 通过 |
| `git diff --check` | 通过 |

新增用例覆盖超预算写入保留旧值、非法 schema/重复身份、编辑删除/修改冲突、最新记录合并、运行期错误保留草稿、主模块加载失败提示、重复 action 打开新标签页及原页不被导航。

工具栏 E2E 使用浏览器级 CDP `Extensions.triggerAction` 与 tab target；临时测试 profile 使用 `--enable-unsafe-extension-debugging`，该参数不进入产品构建。早期测试曾因会话/target 选择和监听尚未注册失败；最终等待监听就绪、聚焦目标 tab 后通过全套及重复专项。

可重现测试源码位于 `apps/extension/e2e/`、`apps/extension/e2e-web/` 和 `apps/extension/src/runtime/*.test.ts`。本地生成环境记录、截图和失败 trace 位于 `apps/extension/test-results/`，未提交生成产物。宽屏截图已检查，未以截图替代人工交互验收。

## 未覆盖

未执行安装版 Chrome 工具栏人工点击、真实 200% 浏览器缩放、辅助技术和性能基准；不代表 G1 批准。既有门禁与风险仍以 RISK_REGISTER 为准。未提交、推送或发布。
