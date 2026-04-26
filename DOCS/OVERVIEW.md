# 全貌（OVERVIEW）

## 一句话

基于 Cloudflare Workers、D1、Email Routing、DNS API 和 Pages 构建的自部署邮箱系统，支持根域名直收和 managed subdomain 两种收件域模式，同时服务于管理面板和 SDK 外部调用。

## 模块边界

| 模块 | 职责 |
|------|------|
| `worker/src/providers/` | 平台抽象层（Provider 接口 + Cloudflare 实现），解耦 DNS / Email Routing 调用 |
| `worker/src/routes/` | 双路 API 路由：`/api/*`（管理员会话，完整权限）+ `/call/*`（API Key，受控子集） |
| `worker/src/services/` | 业务逻辑层，通过 Provider 接口调用平台操作 |
| `frontend/` | Vue 3 + Tailwind 管理面板，骨架屏 + SWR 缓存 |
| `sdk/nodejs/` | Node.js SDK，封装 `/call/*` API 和 `waitForMail` |
| `sdk/python/` | Python SDK，能力与 Node.js 对齐 |
| `scripts/` | 初始化脚本，一键完成首次部署 |
| `DOCS/RESEARCH/` | 平台能力和参考项目调研 |
| `DOCS/PLANS/` | 本项目的范围、路线图和实施方案 |
| `DOCS/DECISIONS/` | 已落定的关键取舍 |

## 关键数据流

1. 调用方或管理面板创建地址，地址元数据写入 D1
2. Cloudflare Email Routing 把邮件投递到 Worker 的 `email()` 入口
3. Worker 用 PostalMime 解析邮件，保存 `raw`、`text`、`html`、`subject`、`source`
4. 前端通过 `/api/*`（管理员会话）拉取列表、详情、域名和设置
5. SDK 通过 `/call/*`（API Key）执行创建和只读操作，无删除权限
6. DNS 和 Email Routing 操作通过 Provider 接口调用，用于根域名初始化、子域名创建和规则回收
7. Pages 自定义域名通过 Pages Domains API 绑定，CNAME 自动对齐到 Pages 真实 `subdomain`
8. `init` 只准备默认入口（`pages.dev` + `workers.dev`）；正式自定义域名在应用设置页处理
9. 管理面板固定请求 Worker 默认 `workers.dev`；Worker 自定义域名仅作为 SDK、手工访问和品牌化展示的别名
10. 平台状态以 D1 为唯一事实来源；Cloudflare 上存在但未写入 D1 的残留不会被自动接管
11. 部署有三条正式路径：本地部署、GitHub-only 部署、混合部署

## 当前落定的关键实现

- 管理员账号和 API Key 存储在 D1 `settings` 中；密码只存哈希，首次访问时初始化
- 邮件正文在收件时解析并落库；前端只做安全渲染
- 管理面板采用白色主色调，Tailwind 手写样式，骨架屏占位 + SWR 缓存
- 所有 Cloudflare API 调用通过 `providers/` 接口解耦，禁止 service 层直接调用
- 收件域名有两种正式模式：根域名 bootstrap 后可直接收 `abc@root`；也可在已初始化根域名下显式创建 managed subdomain 做隔离
- managed subdomain 创建 / 删除以 Cloudflare 当前真实状态对账：创建会补齐缺失资源，删除会精确回收当前仍存在的 MX / TXT / literal Email Routing 规则
- managed subdomain 分长期 / 临时两类；长期不参与自动轮换，临时按每个 root 的轮换总数独立回收
- `wrangler.toml` 不提交 Git；本地和 CI/CD 均按模板现场生成
- Worker CORS 运行时只读 D1 `settings.allowed_origins`，再固定补一个本地开发来源 `http://localhost:5173`
- SDK 只暴露 `/call/*` 受控子集（创建 + 只读），Key 泄露不会导致数据丢失
- GitHub Actions 不仅负责后续部署，也能完成首次 bootstrap；本地不再是唯一初始化入口

## 文档导航

详细方案和任务顺序：见 `SUMMARY.md`。
