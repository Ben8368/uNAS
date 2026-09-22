# uNAS 补充拦截订阅

此目录只维护原有 EasyList、EasyPrivacy、EasyList China、Anti-CV 订阅之外的站点补充规则，不镜像或替换第三方订阅。当前覆盖 B 站页面推广位，不拦截视频内植入，不承诺阻止素材下载。

- 唯一规则源：[unas.json](unas.json)。构建直接嵌入同一文件作为离线兜底。
- 发布目标：`https://raw.githubusercontent.com/Ben8368/uNAS/main/filters/unas.json`。必须经维护者审核并合入远端 `main` 后才可在线获取；本地修改不会自动发布。
- 更新：扩展启动及现有每小时 alarm 检查，独立于第三方订阅。失败保留上次有效缓存，无缓存使用随包快照；错误进入广告拦截状态。已安装扩展的“广告拦截”App 可由用户点击“检查更新”立即重试本仓库源；该受信任页面动作不等待小时节流，也不触发第三方订阅更新。
- 安全约束与版本撤回语义见 [ADR 0012](../docs/ADR/0012-repository-filter-subscription.md)。

## 维护规则

1. `version` 是协议版本，当前为 `1`；每次修改规则都必须增加正整数 `revision`，相同 revision 内容变化和降级会被拒绝。
2. `sites[].host` 精确匹配，不自动覆盖子域。最多 100 个站点，每站最多 50 条，总数最多 500 条，文件最多 100,000 bytes，单条最多 512 字符。
3. `selectors` 只接受 class/ID 目标、最多四级空格后代链，以及末尾单层原生 `:has()`；其内部仅允许 class/ID 链或带 HTTP(S)/协议相对 URL 前缀的 `a[href^="..."]`。不接受任意伪类、脚本、CSS 声明或网络阻断规则。
4. 确认广告容器及普通内容负向样本；不要按标题、网格位置或通用封面类拦截。播放器、表单、输入和按钮保护继续生效。
5. 撤回误伤规则时，删除规则并提高 revision；允许 `sites: []` 清空本补充源。新版本替换旧补充集，不与旧内置集永久叠加；不删除第三方规则。
6. 运行 `pnpm verify` 和 `pnpm --dir apps/extension exec playwright test bilibili-adblock.spec.ts`，另做目标 Chrome 实站验收。只有规则数据能热更新，新语法仍需发布扩展代码。

## B 站依据

2026-09-21 依据用户标注及在线 DOM 只读检查：视频页 `.ad-report.strip-ad`、`.video-card-ad-small`、`.ad-report.ad-floor-exp` 各命中一个推广容器；首页 8 个推广卡片含 `cm.bilibili.com` 链接，普通 CMOS 视频未命中。首页推广卡在 `.feed-card` 外层包装内时，补充规则同时隐藏该网格项，避免留下空白列。第 3 类含站内活动推广。未保存追踪参数、登录态或页面素材；固定合成结构见 [E2E](../apps/extension/e2e/bilibili-adblock.spec.ts)。这只是当日 DOM 依据，不是目标 Chrome 实站拦截完成证据。

2026-09-22 排版修复依据：公开首页样式 `https://s1.hdslb.com/bfs/static/shanks/laputa-home/assets/index-dbcc077a.css` 对 `.recommended-container_floor-aside .container` 的子项用 `nth-of-type` 分配 0/40/24（窄屏 22）px 顶部间距；隐藏广告后序号不变、网格补位，导致同排错位。随包 `bilibili-layout.ts` 在相应卡片过滤生效且网格含推广链接时清除卡片顶部偏移（包含普通视频、直播/番剧的 `.floor-single-card`、裸视频骨架及加载锚点），保留原网格 gap 与轮播跨度；暂停/撤回过滤同步移除。此修复不改变远程规则语法，需要重新加载扩展。回归入口为 `apps/extension/e2e/bilibili-layout.spec.ts`，混合卡片夹具验证封面顶部坐标并复现旧补丁漏掉直播/番剧的 40px 偏移；登录态实站仍待确认。
