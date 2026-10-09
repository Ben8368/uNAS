# Legacy 登录与商店版号适配验证

- 日期：2026-10-09；基线：`f419a58af310d508cc116ab12e3cae81c9485954`（`git pull --ff-only` 同步 `origin/main`）。
- 环境：Windows `10.0.26200 x64`、Node `24.13.0`、pnpm `11.25.0`、WXT `0.21.4`；扩展 manifest 保持 `0.4.0`。
- 范围：Legacy 登录辅助、网络请求版本基线及对应资源哈希；未提交、推送或发布。

## 实站观察与改动

- [UniPass 登录入口](https://portal.unipass.top/login) 的“钛动科技”按钮仍跳转至既有 Feishu OAuth client 与 Tec-IAM redirect；这些校验值无需调整。
- Feishu 新增“请重新授权”界面，将“此前已授予的权限”默认折叠；展开后可见“获取用户身份标识”。原脚本依赖可见文字，因此在折叠状态无法继续。
- 用户复测后确认首次适配仍失败：实站提示块与权限列表均使用 `scopeBlock-*`，共有两个可见块；首次适配要求只有一个块，提前退出。最初夹具漏掉提示块的同名 class，7 项通过结果没有覆盖真实结构。已补入双块结构，先复现“授权未点击”失败，再修正为只排除文字完全匹配的已知提示块。
- 新分支先展开已授予权限，再核对唯一身份权限；额外权限或未知结构不自动授权。Observer 在展开前注册，同时观察可见性及 disabled 属性变化，保留 12 秒超时和清理。
- 实站仅检查导航、页面与权限文字，未点击授权、获取 OAuth code 或读取企业凭据；用户标签页恢复至原登录入口。
- [Chrome 应用商店](https://chromewebstore.google.com/detail/unipass/gjphikebcceegfolnbfncepfmjnhdkam) 显示 `5.3.6`，上次更新为 2026-09-28；将原 `5.3.5` 基线更新为该版本，并同步 `runtime-config.json` 的 SHA-256。用户已有手动版号覆盖仍优先于内置基线。
- 未增加依赖、host permissions、数据上传或凭据存储路径。按 [Chrome scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting) 核对 Promise 注入与既有权限边界，检索日期为本记录日期。

## 客观验证

| 命令 | 结果 |
| --- | --- |
| `pnpm verify` | 通过：治理、lint、边界、依赖清单、65 个测试文件（391 passed / 1 skipped）、类型检查、Demo/MV3 构建及包检查 |
| `pnpm --dir apps/extension exec playwright test e2e/legacy-login.spec.ts --output=test-results/legacy-login-green --reporter=list` | Chromium `151.0.7922.34`：8 passed（含修正后的真实双块结构） |
| 下列 PowerShell 命令 | 系统 Chrome `154.0.8037.98`：8 passed |

```powershell
$env:UNAS_E2E_BROWSER = 'chrome'
pnpm --dir apps/extension exec playwright test e2e/legacy-login.spec.ts --output=test-results/legacy-login-chrome --reporter=list
```

- E2E 使用隔离 Profile、headless、sRGB、1440×900，加载真实解包 MV3。系统 Chrome 使用 `Extensions.loadUnpacked`，加载后断开额外 CDP 会话。
- [合成回归](../../../apps/extension/e2e/legacy-login.spec.ts) 经真实消息路由覆盖旧界面、双块折叠权限、延迟展开/按钮启用、额外权限、独立新增权限区、未知结构、错误 client 与错误 redirect；正向只点击一次，负向等待超过 observer 超时仍不授权；同时覆盖版号设置、标签复用与临时状态清理。
- 初次 E2E 的扩展新建标签首个导航未被 Playwright route 拦截；改为先打开合成登录页再由辅助脚本复用，最终两组通过结果均使用此隔离路径，不以初次失败作为产品结论。
- 新增版号一致性测试，防止商店常量与打包请求头默认配置发生漂移。最终包检查：`total=1203395 B`、`initial static JS=248041 B`、`public=133948 B`。
- 生成截图、环境和运行观察保存在忽略目录 `apps/extension/test-results/legacy-login-red/`、`apps/extension/test-results/legacy-login-green/` 与 `apps/extension/test-results/legacy-login-chrome/`；后两组可按上述命令重建，不含真实企业账号材料。

## 证据边界

完整企业账号登录、会话回传、扩展新建登录标签路径及常用 Profile 人工验收未运行；本轮结果仅证明合成页面上的辅助流程。保留 [RISK-014](../../RISK_REGISTER.md#risk-014p0密码管家融合的真实凭据路径与发布身份尚未全部验收)，不据此关闭公开发布 Gate。
