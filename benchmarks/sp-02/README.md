# SP-02：File Workspace

## 问题 / 阻断 Gate

验证目标 Chrome 解包 MV3 扩展页中的最小文件工作区边界：IndexedDB、OPFS、页面重开后的读取与显式清理，以及 Files UI 在用户手势下选择单个目录、列出当前目录 metadata，并在 App 内二次确认后请求最小的 `readwrite` 授权。该探针记录已关闭 RISK-004（原 G2-Core）的当前边界；不把真实文件处理、导出或真实任务恢复写成当前能力。

## 当前环境与方法

- 构建：apps/extension/.output/chrome-mv3 的解包 MV3，manifest 仅声明 storage；探针不新增权限。
- 自动化：Playwright 加载解包扩展，在 newtab.html 的扩展安全上下文内运行原生存储 API；目录用例仅在隔离 profile 中注入 OPFS `FileSystemDirectoryHandle` 替身，因为 Playwright 无法自动操作原生 OS 目录对话框。
- 数据：存储用例使用固定 UTF-8 字符串 `uNAS SP-02 extension storage probe v1`；目录用例使用隔离 OPFS 下的 `directory-proof.txt` 和 `nested`。均不是用户文件、格式夹具或真实任务输出。

## 覆盖与结果

- 2026-09-08 已验证：写入固定小 payload 至 IndexedDB 与 OPFS；关闭页面、重开同一扩展页后精确读取两份内容；记录 `navigator.storage.estimate()` 的实际 usage/quota；最后删除 probe IndexedDB 与 OPFS 目录并检查 OPFS 目录不可再取得。
- 已验证：Files 在启动点击或“更换目录”的用户手势中调用 `showDirectoryPicker({ mode: 'read' })`；持久化目录句柄后可在新扩展页恢复，取消更换保留已有授权，忘记授权仅删除保存句柄。窗口顶部“只读”先显示 App 内确认，再由确认按钮调用 `requestPermission({ mode: 'readwrite' })`；“可写入”可立即切回 App 内只读但不撤销浏览器授权，恢复和浏览从不请求写入。目录浏览仅列出当前目录前 200 项及文件 metadata，不读既有文件内容、不递归扫描、不暴露物理路径。有效写入模式仅可创建直接子文件夹、创建固定初始内容的 Markdown 文件，或删除文件/空文件夹；不覆盖同名项、不递归删除、不执行本地程序或脚本。
- Chrome for Testing 151.0.7922.34、Windows win32 10.0.26200 x64、headless、1440×900 的解包 MV3 运行中，2 项 SP-02 E2E 通过；存储结果为 `indexedDb: true`、`opfs: true`、`usage: 9983`、`quota: 10737428223`、`errors: []`。目录用例使用隔离 OPFS handle 替身验证恢复、取消和忘记路径，不等同原生 OS picker 证据。
- 清理仅删除名为 `unas-sp02-storage-probe` 的临时 probe 数据；目录“忘记”仅删除保存授权；两者均不触及用户数据、Link App 配置或 mock 文件树。
- 2026-09-09：维护者完成人工验收并确认无问题：原生目录选择器、取消/拒绝、更换目录、刷新/重启后的句柄恢复与撤销、只读/写入二次确认、同名冲突、非递归删除、IndexedDB/OPFS 清理以及当前范围内的恢复路径均符合预期。
- 测试命令：

    pnpm build:extension
    pnpm --dir apps/extension exec playwright test e2e/fileWorkspaceDirectory.spec.ts e2e/fileWorkspaceStorage.spec.ts

运行后的实际浏览器、OS、扩展 ID、存储估计与错误观察位于 apps/extension/test-results/extension-e2e/**/environment.json、storage-probe.json 和 runtime-observations.json，不提交 Git。

## 未覆盖

- 当前实现范围外的真实文件拖入、chunking、配额压力阈值、IndexedDB/OPFS 迁移、导出/download fallback、浏览器卸载及 site-data 清除后的后果。
- 当前实现范围外的真实 task staged output、取消、owner 丢失、Worker 崩溃与 cleanup；这些内容待真实任务和真实处理能力接入后再验收。

## 当前结论

RISK-004 已关闭，范围是当前已实现的 File Workspace 授权与存储边界：原生目录选择、只读起始状态、写入二次确认、权限拒绝/取消、更换目录、权限撤销、刷新/重启恢复、同名冲突、非递归删除、IndexedDB/OPFS 与清理路径。真实文件处理、导出和真实任务仍不支持，其他 Files mock 流程不构成真实能力；未来扩展 adapter 时仍须以真实夹具、显式用户动作和实际错误路径重新验收。
