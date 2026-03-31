# 当前状态

## 当前目标

系统级重构（P0–P6）已全部完成，基础设施、数据库迁移、测试、CI 和开源仓库基础面均已就位。当前阶段的重点是：

- 部署路径归纳为三条：本地部署、GitHub-only 部署、混合部署
- `init` 只处理默认入口和基础设施
- `rebuild` 只重建 D1 + 重新部署，不碰 Cloudflare 外部入口

## 已完成

- P0 — 平台抽象层：`lib/cloudflare.ts` 拆分为 `providers/` 接口 + CF 实现
- P1 — API 路由落定：`/api/*`（管理员会话）+ `/call/*`（API Key）
- P2 — 敏感信息 + CI/CD：`wrangler.toml.template` + 模板现场生成，移除整文件 Secret 依赖
- P3 — SDK 重设计：Node.js / Python 路径 → `/call/*`，新增域名操作
- P4 — 初始化优化：`scripts/init.ts` 一键初始化
- P5 — 前端体验：骨架屏 + SWR 缓存，5 个视图全部改造
- P6 — 文档更新：README、DEPLOY、STATUS、OVERVIEW 同步
- P7 — D1 migration：`worker/db/migrations/` + `schema_migrations` + 自动补齐
- P8 — 测试与 CI：脚本、Worker、前端关键链路测试接入 `pnpm test`，新增 GitHub Actions `CI`
- P9 — 开源仓库面：`LICENSE`、`CONTRIBUTING.md`、`SECURITY.md`、`CHANGELOG.md`、Issue / PR 模板齐备
- P10 — 发布与维护面：`DOCS/RELEASING.md`、版本策略、数据库变更要求和发布前检查齐备

## 下一步

1. 定首个公开版本号，整理对应 release note
2. 打正式 tag，按 `DOCS/RELEASING.md` 流程发首个 GitHub Release
3. 补第二批贴近业务的测试，覆盖域名生命周期、Email Routing 失败分支和 SDK 关键路径

## 阻塞 / 风险

- **CORS 验证** - Pages 默认来源和自定义前端域名统一走 D1 `settings.allowed_origins`；线上 smoke test 仍需确认 Pages 项目真实 `subdomain` 和 CORS 表现
- **测试覆盖** - 现有测试还没覆盖真实 Cloudflare API 交互；域名、Email Routing、自定义入口仍主要靠代码约束和本地单测
- **Upstream Sync** - 只做 fast-forward，策略保守；如果用户默认分支带长期私有改动，仍需手动处理
- **首个 Release** - `daoif/onlymail` 的正式 GitHub Release 还没发出去；更新提醒在首个 release 发布前会显示“还没有正式 release”

## 最近变更

- 所有 Cloudflare API 调用通过 Provider 接口解耦
- API 路由固定为 `/api/*`（管理员会话）+ `/call/*`（API Key）
- `wrangler.toml` 不再提交 Git，本地和 CI/CD 都按模板现场生成
- `scripts/init.ts` 现在只准备基础设施：D1、Worker、Pages 默认入口和可选 GitHub 配置，不再直接操作 Email Routing
- 本地参数改成根目录 `.env.local` 单一来源；`init`、`render:wrangler`、`setup:github`、`sync:dev-vars` 都先读这个文件
- `init` 会把 `D1_DATABASE_ID` 回写到 `.env.local`，再生成 `worker/wrangler.toml` 和 `worker/.dev.vars`
- `ALLOWED_ORIGINS` 已从本地 env、GitHub Variables、`wrangler.toml` 和 workflow 输入中移除；Worker 运行时只从 D1 `settings.allowed_origins` 读取默认 Pages 来源、自定义前端域名和开发白名单
- Worker 名和 Pages 项目名已固定为 `onlymail-worker`、`onlymail-frontend`，不再暴露成用户配置项，也不再通过 GitHub Variables 传递
- 新增 `pnpm run rebuild`：删除并重建 D1，再重跑 `init`；DNS、自定义域名、Email Routing 外部入口不在这条命令里处理
- 新增 `pnpm deploy:worker`、`pnpm deploy:frontend` 两个本地重部署入口，给本地调试和应急使用
- 新增 `worker/db/migrations/` 和 `schema_migrations`；`init`、`deploy:worker`、`pnpm migrate:d1` 现在都按 migration 机制补齐数据库结构
- 前端管理面板固定请求 Worker 默认 `workers.dev`；`VITE_API_BASE_URL` 不再作为用户配置项暴露，Worker 自定义域名只保留为别名
- `DOCS/DEPLOY.md` 改成“每条部署路线先列准备清单，再进入步骤”，并把 Email Routing 口径统一成“只要走 Email Routing 自动化，`CF_EMAIL` + `CF_GLOBAL_API_KEY` 就是必填”
- Email Routing Provider 改成直接走 global auth；根域名 bootstrap、子域名创建删除在进入 Cloudflare 变更前就先校验 `CF_EMAIL` / `CF_GLOBAL_API_KEY`
- 文档里删掉了 `Zone → Email Routing Rules` 这条 Token 权限说明，并补充 `CF_ACCOUNT_ID` 获取位置
- 根域名 bootstrap、Worker 自定义域名、Pages 自定义域名现在都按域名自动解析 Zone；项目边界明确为单一 Cloudflare 账号
- `CF_DEFAULT_ZONE_ID` 已从 `.env.local`、`worker/.dev.vars`、`wrangler.toml` 模板、GitHub workflow 和前端手动输入里移除
- Worker CORS 改为：默认 `pages.dev` 来源、自定义前端域名和开发白名单统一进 D1；设置页新增/删除 Pages 自定义域名时会同步维护
- Pages 自定义域名绑定继续走：读取 Pages 项目真实 subdomain → 自动创建或更新 CNAME → 重试验证，并在设置页显示验证/证书状态
- 新增 `Bootstrap Cloudflare` workflow，用于完全不拉本地的首次部署
- 新增 `Upstream Sync` workflow，用于 fork 仓库按 fast-forward 自动接收上游更新
- 新增 `CI` workflow，PR 和默认分支 push 会自动执行测试、构建、脚本检查和 Python SDK 检查
- GitHub-only / 混合部署的状态延续已对齐本地：`Bootstrap Cloudflare` 现在会复用 GitHub 里的 `D1_DATABASE_ID`，并要求 GitHub 配置写回成功后才算完成
- `Deploy Worker` / `Deploy Frontend` 现在按默认分支和真实依赖触发；改到共享部署脚本、migration、模板或根依赖时也会自动跑
- `Upstream Sync` 在 fast-forward 后会显式补触发 `CI` 和相关 deploy workflow，不再停在“代码同步了但后续检查和部署没跑”
- 新增前端、Worker、脚本层测试入口，根目录 `pnpm test` 现在会统一跑完
- SDK 分发路径定为“直接从 GitHub 仓库子目录安装”：Node.js 主推 `pnpm`，Python 主推 `pip`；当前不发 npm / PyPI
- Node.js / Python SDK 已分别完成真实安装与真实 API 调用验证；当前线上可正常列域名、创建地址并读取空邮件列表
- 地址页新增“生成临时邮箱”区域：直接拉取可用子域名、创建地址、展示结果、复制地址并跳到邮件页
- 开源仓库基础面已补齐：`LICENSE`、`CONTRIBUTING.md`、`SECURITY.md`、`CHANGELOG.md`、Issue / PR 模板、`DOCS/RELEASING.md`
- 新增正式 release 更新提醒：Worker 每 24 小时检查一次 `daoif/onlymail` 的 GitHub Release；没接 GitHub 自动同步的实例会在后台顶部显示更新横幅，设置页也能手动检查和关闭提醒
