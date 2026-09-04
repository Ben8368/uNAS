# Demo 素材与依赖审计

当前自有视觉素材的唯一清单为 [demo-assets.json](../assets/demo-assets.json)，依赖身份清单为 [dependency-inventory.json](../assets/dependency-inventory.json)。构建上限以 [demo-budgets.json](../scripts/demo-budgets.json) 为准。

- 图标与 favicon 是仓库内原创几何 SVG，可用 `node scripts/generate-demo-assets.mjs` 重建；背景是 `appearance.ts` 中的 CSS 渐变，无外部图像输入或字体文件。
- 每项素材登记源文件、字节数、SHA-256 与尺寸；没有把来源未知的旧 PNG/WebP 改写成“已授权”。旧资产已从工作树和构建输入移除，Git 历史仍保留其原始记录，不应重新打包。
- 仓库许可证仍需维护者决定。素材原创性与来源可追踪，不等于公开分发已批准；RISK-009 仍按其限定 Gate 处理。
- `node scripts/dependency-inventory.mjs` 读取当前安装的生产声明依赖图及直接构建/测试依赖的版本、声明许可证、许可证文件哈希与上游仓库。锁文件记录具体解析与完整性；该清单不声称已完成所有开发工具传递依赖的法务审查。
- `node scripts/demo-package-check.mjs` 校验原始素材哈希、未登记资源、扩展总包体、New Tab 静态初始 JS、WASM、桌面 bridge 和权限清单。构建上限是工程约束，不是设备性能、解码或兼容性承诺。

## 新增测试依赖

`@playwright/test` 用于真实加载本地 MV3 构建物、截图和跨标签生命周期回归，不进入扩展运行时。它弥补单测与 Vite 构建不能验证扩展运行面的缺口；不以现有用户浏览器配置进行自动化。

测试使用独立、临时配置目录以及工具自带 Chromium，关闭后清理浏览器上下文。不会向第三方上传文件、Cookie 或测试轨迹；截图和失败 trace 留在被 Git 忽略的 `test-results` / `playwright-report`。

按照 [Playwright 扩展测试说明](https://playwright.dev/docs/chrome-extensions) 使用随工具提供的 Chromium 加载扩展；该证据与用户安装的 Chrome 稳定版人工确认分开记录。
