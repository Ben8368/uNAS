# 2026-09-29 Files WebDAV 与缓存验收

## 范围与证据语义

维护者授权继续实现 WebDAV 文件模块、下载母版布局与存储申请；边界见 [ADR 0015](../../ADR/0015-file-manager-dav-cache.md)。设计基线 UI v1.8，适用 UI-03/04/05/06；复用 ResizableAppSidebar、app-nav/app-nav-item、mt-btn 与 window-* Token，默认导航为本地文件，五个位置固定列出。公共 Window 接收 Registry 注入的 headerStatus，文件写入模式只在本地位置显示，设置色域状态继续保留。

本轮无新增依赖、required/optional 安装权限、自动上传、真实 NAS 访问或 Git 提交/推送。Web Demo 通过真实能力 port 的扩展上下文检查拒绝文件读写；MockFileManagerPane 继续作为独立确定性演示。

## 环境与构建

- Windows `win32 10.0.26200 x64`，系统 Chrome `154.0.8037.58`，WXT `0.21.4`，扩展 manifest `0.4.0`。
- 隔离 Profile、headless、sRGB；browser-level `Extensions.loadUnpacked` 后断开安装会话。不是普通 Web 页面或日常 Profile 人工确认。
- Files chunk `FileManagerApp-D2Aamk8D.js`，SHA-256 `d1b0a255519f8cd3a6049153fdde37f3eeb6f60f256ad61ded9f1de258968d66`；包体 `1,152,974 B`、New Tab 初始静态 JS `247,632 B`。文件能力仍按需加载。

## 客观验证

| 命令 | 结果 |
| --- | --- |
| `pnpm verify` | 通过：治理、lint、Demo 边界、依赖清单、57 个测试文件（350 passed / 1 skipped）、typecheck、Vite/WXT 构建、包体检查 |
| 系统 Chrome 定向 E2E（完整命令如下） | 7 passed；所有观察到的 page errors 与未预期网络请求均为空 |
| `node scripts/governance-docs-check.mjs`、`git diff --check` | 通过 |

```powershell
$env:UNAS_E2E_BROWSER = 'chrome'
pnpm --dir apps/extension exec playwright test e2e/fileManagerLocations.spec.ts e2e/fileWorkspaceDirectory.spec.ts e2e/fileWorkspaceStorage.spec.ts e2e/appTheme.spec.ts e2e/colorGamut.spec.ts -g 'file locations|download directory|WebDAV file|File Manager requires|extension page persists|file-manager|Settings reports'
```

可复现入口：[Files locations](../../../apps/extension/e2e/fileManagerLocations.spec.ts)、[local directory](../../../apps/extension/e2e/fileWorkspaceDirectory.spec.ts)、[storage](../../../apps/extension/e2e/fileWorkspaceStorage.spec.ts)、[transport](../../../apps/extension/src/platform/webdav/client.test.ts)、[DAV service](../../../apps/extension/src/platform/webdav/real/davFiles.test.ts)、[cache lifecycle](../../../apps/extension/src/platform/storage/real/tempCache.test.ts)。测试附件生成在被 Git 忽略的 `apps/extension/test-results/extension-e2e/`，本记录不把该目录作为仓库证据链接。

## 覆盖与结果

- **WebDAV：** 真实扩展页面、实际 XML 解析和共享传输代码；主机权限与 HTTPS fetch 使用合成边界，未连接真实服务。覆盖勾选同意、权限拒绝（零请求）、外域/编码路径越界、失败 propstat、目录进入/返回、下载、MKCOL、所选文件上传、If-None-Match:*、强 ETag DELETE、412 冲突、取消和断开清除凭据；没有自动重试写入。
- **缓存：** 浏览器实际 OPFS、文件选择输入与 Blob 导出；载荷字节复读一致，窗口重开仍可读取，移入回收站/恢复/永久删除正确。单测补充含回收站的总预算、记录校验、锁拒绝、过期清理、孤儿与配额失败回滚、仅清理自身目录及批准/拒绝的持久存储状态。
- **存储申请：** 此 Chrome 隔离 Profile 的实际 persist() 未获批准、persisted() 返回 false。UI 显示拒绝原因，保留默认配额并继续读取/导出缓存；不能将“有申请入口”写成“已取得持久存储”，也不以类型绕过 Chrome 禁止 optional unlimitedStorage 的规定。
- **下载目录：** 原生选择器由 OPFS handle 代用，验证 read/id/startIn 参数、独立持久 grant、本地目录隔离、只读操作与忘记授权；代用句柄不等于操作系统原生下载目录手势通过。
- **UI：** 1440×900、1024×768、390×844 截图与主区不横溢断言；实际 tabs.setZoom(2) 验证缓存导出按钮可见、可聚焦；减少透明度/高对比下窗口 blur 关闭。源码复用下载的公共侧栏和控件；观察截图未发现本轮主要内容遮挡。人工视觉、真实触控、阈值两侧与最终对比度验收仍保留缺口。

## 审计与未覆盖

🚦 **总体评价：🟡 可通行；🔴 无。** 功能在约定的合成 WebDAV 与小型实际 OPFS 夹具范围通过，未声称通用 NAS/无限容量或最终 UI 基线验收。

真实 NAS 条件写入、认证/网络、编码路径与原生主机权限沿用 [RISK-016](../../RISK_REGISTER.md#risk-016p1共享-webdav-传输的真实服务兼容性待验收)。原生下载目录、关页/进程中断、重启/更新/卸载、配额/磁盘压力及本轮人工视觉/触控见 [RISK-017](../../RISK_REGISTER.md#risk-017p1files-私有缓存与浏览器下载记录待验收)。未运行这些专项：本轮没有授权测试 NAS 或磁盘压力/日常 Profile 人工环境。
