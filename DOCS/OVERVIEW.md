# 全貌（OVERVIEW）

## 一句话
- 这是一个给注册机和人工管理同时用的个人邮箱系统，基于 Cloudflare Workers、D1、Email Routing、DNS API 和 Pages。

## 模块边界
- `worker/src/providers/`：平台抽象层（Provider 接口 + Cloudflare 实现），解耦 DNS/Email Routing 调用。
- `worker/src/routes/`：双路 API 路由 — `/api/*`（JWT 前端完整权限）+ `/call/*`（API Key SDK 受控子集）。
- `worker/src/services/`：业务逻辑层，通过 Provider 接口调用平台操作。
- `frontend/`：Vue 3 + Tailwind 管理面板，骨架屏加载 + SWR 缓存策略。
- `sdk/nodejs/`：Node.js SDK，封装 `/call/*` API 和 `waitForMail`。
- `sdk/python/`：Python SDK，封装与 Node.js 对齐的能力。
- `scripts/`：初始化脚本，一键完成首次部署配置。
- `DOCS/RESEARCH/`：平台能力和参考项目调研。
- `DOCS/PLANS/`：本项目的范围、路线图和实施方案。
- `DOCS/DECISIONS/`：已经落定的关键取舍。

## 关键数据流/依赖
- 调用方或管理面板先创建地址，地址元数据写入 D1。
- Cloudflare Email Routing 把邮件投递到 Worker 的 `email()` 入口。
- Worker 用 PostalMime 解析邮件，保存 `raw`、`text`、`html`、`subject`、`source`。
- 前端通过 `/api/*`（JWT）拉取列表、详情、域名和设置。
- SDK 通过 `/call/*`（API Key）执行只读+创建操作，无删除权限。
- Cloudflare DNS API 和 Email Routing API 通过 Provider 接口调用，用于根域名初始化、子域名创建和规则回收。
- Pages 自定义域名通过 Pages Domains API 绑定，再把 CNAME 自动对齐到 Pages 项目的真实 `subdomain`，随后重试验证。

## 当前落定的关键实现
- 管理员账号和 API Key 都放进 D1 `settings`；管理员密码只存哈希，首次访问时初始化。
- 邮件正文收件时解析并落库；前端只做安全渲染。
- 管理面板采用白色主色调，使用 Tailwind 手写样式，骨架屏占位 + SWR 缓存。
- 所有 Cloudflare API 调用通过 `providers/` 接口解耦，禁止 service 层直接调用。
- `wrangler.toml` 不提交 Git，CI/CD 通过 `BACKEND_TOML` Secret 注入。
- SDK 只暴露 `/call/*` 受控子集（创建+只读），Key 泄露不会导致数据丢失。

## 文档导航
- 详细方案和任务顺序：见 `SUMMARY.md`。

