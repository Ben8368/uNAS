# 安全政策

uNAS 是承载新标签页、本地文件、媒体/PDF/ZIP 处理和浏览器权限的 Manifest V3 扩展。安全、隐私与商店合规高于视觉效果、格式覆盖和处理速度。

## 当前支持状态

当前阶段与已验证范围以 [CONTEXT.md](CONTEXT.md) 为准。Frontend Demo 只验证模拟交互；库名、格式列表和视觉方案均不代表真实文件或引擎能力。

## 信任边界

```text
Web page / user Link URL        不可信外部来源
Content Script                 低信任桥
Service Worker                 特权事件路由
New Tab / Workspace page       受信扩展 UI
Application ports/contracts    能力边界
Worker / engine adapter        不可信文件处理边界
User file / archive / media    不可信输入
```

- 所有跨上下文消息校验 schemaVersion、sender、origin、App、任务 owner、payload 大小和允许动作。
- Content Script 消息不能携带任意扩展路由、任意 URL 请求或文件系统命令。
- UI 不直接访问 engine、OPFS 根、文件句柄或扩展特权；能力通过受控 service/adapter。

## 本地优先与数据

- 默认不上传文件、文件名、内容摘要、浏览历史、Link App、任务历史或布局。
- Mock Demo 不读取真实用户文件；演示素材必须自有、生成或有清晰许可。
- `chrome.storage` 只保存设置、Link App、布局和小型摘要；大文件与媒体不进入该存储。
- IndexedDB/OPFS 的数据生命周期、配额、迁移、清理和卸载后果必须向用户说明。
- 输出写入用户明确选择的位置，或在 OPFS 暂存后显式导出；默认不覆盖原文件。
- 上传、同步、遥测、错误上报、账号、云处理或 Native 能力需独立 ADR、数据流、保留策略和明确同意。

## Link App 与远程内容

- V1 Link App 只接受声明式名称、图标引用和 HTTPS URL，点击后在普通标签页打开。
- 禁止 `javascript:`、`data:`、`file:`、`chrome:`、`chrome-extension:` 和未知 scheme。
- 不把远程页面嵌入高权限扩展页面，不让 Link App 获取文件、任务、浏览历史或 `chrome.*` 能力。
- Manifest V3 的 JS/WASM 固定随扩展包分发；禁止远程模块、`eval`、下载后执行或隐藏功能。
- Web-accessible resources 保持最小，不暴露内部 bundle、source map、夹具或用户数据。

## 权限

- required permissions 只包含首发核心功能当下需要的最小集合。
- optional permissions 也不得为未来预留；只在用户触发功能时解释并请求。
- host permissions 默认不全域开放；网页资源导入优先使用 `activeTab` 或更窄的用户触发能力。
- downloads、clipboard、contextMenus、offscreen、content script 等逐项记录用途、触发点、拒绝行为和商店披露。
- 不绕过 DRM、付费墙、登录、CORS、浏览器警告或站点条款。

## MV3 生命周期

- Service Worker 随时可能终止，不保存只存在内存的关键状态，不运行长计算。
- New Tab 可以多实例；真实任务由单一 Workspace owner 管理，消息需验证 owner/lease。
- Phase 1 同页 App 通过逻辑 mock Workspace 共享状态：仅同源 BroadcastChannel、版本与方法/参数白名单、会话/请求匹配、消息大小与并发上限。owner 失联后客户端停止操作，不自动重放写请求；不新增权限或后台常驻能力，见 ADR 0007。
- Workspace 关闭、崩溃、浏览器退出或扩展更新不能标记假成功；恢复能力必须由实测决定。
- Offscreen Document 只用于官方允许且经探针证明必要的场景，不作为常驻应用逃生舱。

## 格式专项风险

- ZIP：拒绝路径穿越、绝对路径、软链接逃逸、异常文件数和展开体积失控；加密状态显式。
- Media：限制输入、像素、时长、帧、并发与 Worker 内存；畸形容器和 WASM 崩溃可取消、可清理。
- PDF：限制页、对象、像素、字体和图片资源；JavaScript、附件、表单和外部引用不被静默执行。
- Image：限制解码后像素和动画帧，验证 EXIF、透明度和输出签名。
- 所有格式同时校验扩展名、MIME、magic/container 和资源预算。

## 输出与清理

- 计算结果先进入 prepared/staged 状态，验证后再 commit/export。
- commit 前取消应回滚；commit 中失败不能标记成功；commit 后取消需说明未生效。
- cleanup 幂等，只删除临时资源，不删除已提交用户文件。
- 所有终态释放 object URL、stream、reader/writer、handle、Worker、lease 和 OPFS 临时对象。

## 视觉与供应链

- 不复制或分发 Apple 字体、图标、壁纸、截图和未授权设计资产；Liquid Glass 只借鉴公开设计原则。
- 锁定依赖版本与完整性；WASM、codec、字体、图标、壁纸和夹具记录来源、许可证、版本与哈希。
- 新依赖说明用途、替代方案、包体、维护状态、CSP、远程资源和许可证。
- 许可证与再分发证据未完成前不得公开发布扩展或二进制资源。

## 不应提交

- `.env`、token、cookie、登录态、浏览器配置、私钥或账号信息。
- 客户文件、个人媒体/PDF、本机绝对路径、真实浏览历史或公司内网地址。
- 未授权图片、字体、音视频、图标、壁纸和 WASM 二进制。
- `node_modules`、构建产物、缓存、日志、崩溃转储和大体积基准输出。

安全边界变化必须同步本文件、相关 ADR 与 [RISK_REGISTER.md](docs/RISK_REGISTER.md)。
