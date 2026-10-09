# ADR 0005: DNR Network Blocking with URL Subscriptions

- 状态：Accepted（2026-09-16 调整为运行时订阅；页面 cosmetic 边界见 ADR 0006）
- 日期：2026-09-16

## 背景

用户要求后台持续拦截且不可关闭，规则必须跟随原始链接更新，不把上游列表正文复制进源码。MV3 Worker 可休眠，DNR 引擎负责持续执行网络规则。

## 决策

仓库仅保留 EasyList/EasyPrivacy/EasyList China/Anti-CV 官方来源及文本 URL，全球基础广告与追踪列表补齐区域列表覆盖。首次运行、启动检查和每小时 alarm 由后台获取最新数据；严格限制响应大小、时间、格式和权限，不下载执行代码。所有来源完成转换后，通过 updateDynamicRules 原子替换上一代；失败保留有效缓存，首次未就绪明确返回 ready=false。Chrome 121+ dynamic safe rule 额度允许最多 30,000 条；相同条件的纯域名规则使用 requestDomains 分批合并以保留全部可转换覆盖，超限不裁剪。删除静态规则文件及 manifest 静态 ruleset；旧版全局关闭和网站白名单在升级时清理，关闭消息不再接受。

网络 block 与上游精确子资源 allow 例外受本地转换器限制；不启用 Acceptable Ads 广告放行，不执行远程 scriptlet/cosmetic。页面层仅由 ADR 0006 定义的独立本地编译模块处理。上游不支持语法整条跳过。后台凭据和 WebDAV 请求由固定扩展 initiator 排除保护。

## 后果

无需发布扩展即可跟随列表更新；DNR 缓存跨 Worker 休眠及浏览器重启持续工作。引入两个公开规则下载 origin、baseline 和非敏感更新状态，详见 SECURITY。首次安装离线时只有 baseline，等待首次成功更新；完整 Anti-CV 功能与站点覆盖仍见 TD-010。缺陷可通过上游更新或本地转换器修正处理。

关联：[SECURITY.md](../../SECURITY.md)、[ARCHITECTURE.md](../ARCHITECTURE.md)、[来源与下载地址](../../rules/SOURCES.md)。
