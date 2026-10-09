# 广告拦截测试站说明

2026-09-16 实际读取下列页面与 d3ward FAQ。页面内容、第三方广告可用性和推荐可能变化；本页不是长期固定分数基准。

| 测试站 | 覆盖的广告/追踪 | 站内建议与限制 |
| --- | --- | --- |
| [AdBlock Tester](https://adblock-tester.com/) | 自定义/AdSense/Yandex 广告脚本；Google Analytics、Hotjar、Yandex.Metrica；Flash/GIF/静态横幅；Sentry/Bugsnag 错误监控 | 不要同时使用多个拦截器，复测需清缓存；广告供应商会阻断测试站，contextual 测试不可靠；横幅只测路径关键词/Flash，不能代表所有图片广告。网站推广 Total Adblock，属于商业推荐而非可直接移植的过滤规则。 |
| [Can You Block It eXtreme](https://canyoublockit.com/extreme-test/) | 横幅、原生广告、直接广告链接、插屏、pop-under、通知请求、页内推送、视频前贴片 | 不信任页面中的广告、不接受通知权限；有较简单测试入口，也可测试 Pi-hole。页面说明任意点击可能触发新广告标签；本次未点击广告、未授权通知。不能把示例截图当成真实加载广告。 |
| [d3ward](https://d3ward.com/adblock) | 静态/动态 cosmetic、广告脚本、广告域名、统计、错误监控、社交追踪、混合服务和 OEM 遥测 | FAQ 建议查看兼容性；连接失败被计为 blocked，DNS/网络故障可能影响分数；绿色分数已足够，不必追求 100%。提供 d3Host List，并推荐 DNS 过滤、uBlock filters、AdGuard Filters、Hagezi 等组合；d3Host 不覆盖 cosmetic/script-loading 全部测试。 |

## 本次增强的选择

- EasyList 全球基础规则 + EasyPrivacy 追踪规则，与 EasyList China/Anti-CV 一起从官方地址下载；编译器保守保留网络作用域，并把安全的通用/站点 selector 写入受限 cosmetic store。中文区域列表不是全球基础列表的替代品。
- d3ward 的 131 个 d3Host 域名已作为第三方、离线 baseline 兼容项编译；不封锁测试站本身，也不加入它的全第三方 catch-all 或 redirect 规则。测试列表含部分产品业务/API/管理域名，真实业务站仍需人工检查误拦截。
- 广告 content script 是独立入口，仅运行本地 CSS 和白名单 `remove-attr`；不读取正文、表单或凭据。procedural、复杂伪类和未知 scriptlet 跳过。临时暂停只由用户操作，且同时停用 DNR、cosmetic、scriptlet。

## 可复现验收

1. `npm test`：合成规则的作用域、例外、域名合并与 30,000 额度，cosmetic selector/站点例外/scriptlet 拒绝、下载失败/升级/原子替换回归。
2. `npm run smoke:chrome`：隔离 Chrome Profile 中加载构建，下载四源并安装真实 DNR；网络探针须得到 `net::ERR_BLOCKED_BY_CLIENT`，同时本地普通资源可访问，验证 Worker 停止后持续生效、baseline 和 cosmetic fixture。暂停/恢复的真实 DNR 语义也应在该 smoke 中记录。
3. 手动站点验收：仅安装当前 uNAS，等待订阅就绪，清缓存重载上述三站；分别记录网络脚本、图片/横幅、分析/追踪、cosmetic 残留、弹窗/页内推送和布局。不要点击广告、授权通知或下载。不要用其他浏览器或 DNS 环境中的分数归因 uNAS；站点连接失败与浏览器默认弹窗阻止不算扩展拦截。

完整三站在已安装 uNAS 的真实页面体验、主站正常业务误拦截、暂停/恢复和正常安装后离线重启仍需验收，见 TD-010。当前自动 smoke 不产生测试站分数，也不把合成 fixture 当成真实站点成绩。
