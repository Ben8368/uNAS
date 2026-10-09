# 自动更新过滤订阅

仓库只保存来源链接、转换器和独立的 26 条离线 baseline（其中两条合并覆盖 d3ward 的 131 个测试 host），不保存上游过滤列表正文或生成的订阅快照。baseline 不是完整订阅覆盖。后台在首次运行、启动时检查，并每小时获取最新版本；完整下载、转换及 Chrome 校验成功后原子替换 dynamic DNR，并提交同一 generation 的 cosmetic store。动态规则由浏览器持久保存，Worker 休眠、浏览器重启后仍然有效；失败保留上一版并自动重试。状态为 baseline-only、ready、stale 或 error。

| 原始来源 | 实际下载地址 | 用途 |
| --- | --- | --- |
| [EasyList](https://easylist.to/) | [官方 EasyList 订阅](https://easylist-downloads.adblockplus.org/easylist.txt) | 全球广告基础列表，补齐中文区域列表之外的广告脚本、横幅与广告网络 |
| [EasyPrivacy](https://easylist.to/) | [官方 EasyPrivacy 订阅](https://easylist-downloads.adblockplus.org/easyprivacy.txt) | 统计、行为追踪与追踪端点；不是对所有分析产品整站封禁 |
| [EasyList China](https://github.com/easylist/easylistchina/) | [官方 EasyList 下载地址](https://easylist-downloads.adblockplus.org/easylistchina.txt) | 中文网站过滤规则，跟随官方发布地址更新；项目主页不是下载正文 |
| [Anti-CV](https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv) | [官方 ABP filters 订阅](https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt) | 上游官方合并发布的反规避规则，订阅标头 Homepage 指向原始 GitLab 项目 |
| [d3Host](https://github.com/d3ward/toolz/blob/master/src/d3host.adblock) | 固定编译进离线 baseline 的 host 子集 | 覆盖 d3ward 归档测试页列出的 131 个广告、分析、错误监控、社交和 OEM host；仅转换为第三方网络 block，不复制其全第三方 catch-all 或 redirect 例外 |
| [Acceptable Ads](https://acceptableads.com/) | 未订阅 | 广告放行计划首页，不是过滤文本；不启用广告放行 |

仅由 Service Worker 向固定 HTTPS 订阅地址下载数据，省略 Cookie/凭据和 referrer，拒绝重定向、HTML、超过 5 MiB 的响应及无效列表，单请求 20 秒超时。不执行远程 JS/CSS/scriptlet。网络转换支持保留 `main_frame/sub_frame`、第三方、域名正/负条件、资源类型、大小写和 `@@` 例外；不支持的 redirect/header/sitekey/important/removeparam、regex、`||*` 与未知选项整条跳过，不通过删除未知选项扩大范围。cosmetic 仅支持安全静态 selector，以及按 host 合并后可取消同一 selector 或受限 scriptlet 的 `#@#` 例外；procedural/复杂伪类跳过。Anti-CV 仅允许本地实现的 `remove-attr`，未知名称、参数和作用域跳过。d3Host 的离线 host 规则使用固定的 `requestDomains` 分组，每组最多 100 个域名，并限定为第三方请求。

每代 dynamic 规则最多 30,000 条并预留其他 dynamic rules 已用额度，要求 Chrome 121+ 的 safe dynamic rule 额度；静态 baseline 单独受 100 条仓库上限约束。编译器仅将相同 action、priority、资源类型和 initiator 条件的纯 `||domain^` 规则合并为每批最多 500 个 `requestDomains`；路径、通配符、端口、大小写敏感和不同例外条件不合并。无按测试站加白/加黑；超限或 Chrome 校验失败时完整保留旧代。cosmetic store 限制 1 MB、2,000 个 site groups、全局 1,500 个 selector、每站 100 个 selector/10 个 scriptlet、selector 512 字符；CSS 生成限制 300 KB。规则排除 UniPass/Jupiter 和固定扩展 initiator，避免影响后台凭据、WebDAV 请求。

许可证与归属：EasyList、EasyPrivacy、EasyList China 由其贡献者维护，采用 [GPL-3.0-or-later 或 CC BY-SA 3.0](https://easylist.to/pages/licence.html)；Anti-CV 由 eyeo 和贡献者维护，见 [上游 LICENSE](https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv/-/blob/master/LICENSE)。d3Host 归 d3ward/toolz 维护，来源列表标注为 CC BY-NC-SA，项目已归档；本项目仅保留其 131 个 host 名称的兼容性映射，并保留来源链接，不引入列表中的 redirect 规则。其余 baseline 是维护者独立编写的小型降级规则。更新测试使用合成 fixture，不将上游全文写入源码或构建产物。真实订阅与 Chrome DNR/cosmetic 验收由 npm run smoke:chrome 执行，需要访问官方订阅站点；网络探针要求真实 `ERR_BLOCKED_BY_CLIENT`，不把 DNS/CORS 失败当成拦截。测试站类别与建议见 [测试说明](TESTING.md)。

Chrome smoke 使用 CDP 临时加载：验证真实下载/安装、静态 baseline、cosmetic fixture、临时重装在线恢复与 Worker 停止后拦截/缓存。正常安装扩展的离线浏览器重启不由临时加载测试代表；三测试站和代表性业务站人工矩阵见 [测试说明](TESTING.md) 与 TD-010。
