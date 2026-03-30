# CFTE 参考项目调研

## 这份文档的边界
- 这里记录的是参考项目 `reference/cloudflare_temp_email` 的实现思路。
- 这里不定义本项目方案；本项目怎么做，统一看 `../PLANS/`。
- Cloudflare 平台本身的 Email Routing 能力，统一看 `cf-email-routing-research.md`。

## 参考项目概况
- 后端运行在 Cloudflare Workers，框架是 Hono。
- 邮件接收走 Cloudflare Email Routing，入口是 Worker 的 `email()`。
- 邮件解析使用 PostalMime。
- 数据库存储是 D1，基础表包括 `raw_mails`、`address`、`settings`。
- 定时清理通过 `scheduled()` 和 Cron Trigger 完成。
- 前端是 Vue 3，但用了 Naive UI 和大量我们不需要的功能。

## 直接看源码得到的可用点
- `worker/src/email/index.ts` 已经证明 Worker 直接接邮件并写 D1 这条路是通的。
- `worker/src/common.ts` 里的 `newAddress()`、`handleListQuery()`、`cleanup()` 说明地址创建、分页和清理可以拆成独立服务函数。
- `worker/src/common.ts` 已经在用 PostalMime 解析 MIME，说明我们不需要把邮件解析放到浏览器里。
- `worker/src/common.ts` 用了 `waitUntil` 更新地址时间，说明收件后异步更新 `updated_at` 是合适的做法。
- D1 migration 基线里保留了 `settings` 表，这一点对我们很重要，因为可轮换的 API Key 需要持久化配置，不适合只放环境变量。
- `worker/wrangler.toml.template` 说明这个类型的项目本来就依赖 D1、Cron 和一组环境变量绑定。

## 可以直接借鉴的部分
- Hono 路由结构。
- Worker `email()` 收件入口。
- PostalMime 解析方式。
- D1 的分页查询和清理框架。
- `scheduled()` 做定时清理的组织方式。

## 不要直接照搬的部分
- 多用户体系、角色、OAuth、Passkey。
- Telegram、Webhook、AI 提取、发件功能。
- Naive UI 管理面板。
- 依赖邮箱 JWT 的整套鉴权模型。

## 对本项目的直接结论
- 本项目继续用 Hono + D1 + PostalMime 这条后端组合，不需要再找别的核心栈。
- `settings` 表应该保留，而且要承担 API Key 预览值、哈希值和轮换时间的存储。
- 邮件在收件时就该解析出 `subject`、`source`、`text`、`html`，否则管理面板的详情页和列表页都会被迫重复解析 `raw`。
- 管理面板和自动化 API 应该共用业务服务层，但不要共用同一套鉴权入口。

## 参考项目和本项目的差异
- 参考项目面向公开临时邮箱服务，本项目只做单用户个人系统。
- 参考项目把很多功能堆在一个大系统里，本项目目标是把路径缩短，保留收件、查询、域名管理、后台设置和 SDK。
- 参考项目里的 Email Routing 使用方式，只能说明“它怎么接入 Cloudflare”；Cloudflare API 能不能自动化，要看另一份平台调研。
