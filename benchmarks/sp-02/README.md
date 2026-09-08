# SP-02：File Workspace

## 问题 / 阻断 Gate

验证目标 Chrome 解包 MV3 扩展页中的最小文件工作区边界：IndexedDB、OPFS、页面重开后的读取与显式清理，以及 Files UI 在用户手势下选择并只读列出单个目录。该探针收敛 RISK-004（G2-Core），不提供写入、导出或真实任务恢复。

## 当前环境与方法

- 构建：apps/extension/.output/chrome-mv3 的解包 MV3，manifest 仅声明 storage；探针不新增权限。
- 自动化：Playwright 加载解包扩展，在 newtab.html 的扩展安全上下文内运行原生存储 API；目录用例仅在隔离 profile 中注入 OPFS `FileSystemDirectoryHandle` 替身，因为 Playwright 无法自动操作原生 OS 目录对话框。
- 数据：存储用例使用固定 UTF-8 字符串 `uNAS SP-02 extension storage probe v1`；目录用例使用隔离 OPFS 下的 `read-only-proof.txt` 和 `nested`。均不是用户文件、格式夹具或真实任务输出。

## 覆盖与结果

- 2026-09-08 已验证：写入固定小 payload 至 IndexedDB 与 OPFS；关闭页面、重开同一扩展页后精确读取两份内容；记录 `navigator.storage.estimate()` 的实际 usage/quota；最后删除 probe IndexedDB 与 OPFS 目录并检查 OPFS 目录不可再取得。
- 已验证：Files 在启动点击或“更换目录”的用户手势中调用只读 `showDirectoryPicker({ mode: 'read' })`；持久化目录句柄后可在新扩展页恢复，取消更换保留已有授权，忘记授权仅删除保存句柄。目录浏览仅列出当前目录前 200 项及文件 metadata，不读文件内容、不递归扫描、不暴露物理路径。
- Chrome for Testing 151.0.7922.34、Windows win32 10.0.26200 x64、headless、1440×900 的解包 MV3 运行中，2 项 SP-02 E2E 通过；存储结果为 `indexedDb: true`、`opfs: true`、`usage: 9983`、`quota: 10737428223`、`errors: []`。目录用例使用隔离 OPFS handle 替身验证恢复、取消和忘记路径，不等同原生 OS picker 证据。
- 清理仅删除名为 `unas-sp02-storage-probe` 的临时 probe 数据；目录“忘记”仅删除保存授权；两者均不触及用户数据、Link App 配置或 mock 文件树。
- 测试命令：

    pnpm build:extension
    pnpm --dir apps/extension exec playwright test e2e/fileWorkspaceDirectory.spec.ts e2e/fileWorkspaceStorage.spec.ts

运行后的实际浏览器、OS、扩展 ID、存储估计与错误观察位于 apps/extension/test-results/extension-e2e/**/environment.json、storage-probe.json 和 runtime-observations.json，不提交 Git。

## 未覆盖

- File System Access picker 的用户手势、取消/拒绝、文件与目录句柄的 query/request permission、刷新/浏览器重启后的句柄恢复与撤销。
- 真实文件拖入、chunking、配额压力阈值、IndexedDB/OPFS 迁移、导出/download fallback、浏览器卸载及 site-data 清除后的后果。
- 真实 task 的 staged output、取消、owner 丢失、Worker 崩溃与 cleanup。

因此 SP-02 不能关闭 RISK-004。当前 Files 的目录授权与只读 metadata 浏览是已实现、经解包扩展 API 路径验证的最小能力；真实文件处理、写入、导出和任务仍不支持，其他 Files mock 流程不构成真实能力。后续必须以真实夹具、显式用户动作和实际错误路径补齐上述证据，才可扩展 File Workspace adapter。
