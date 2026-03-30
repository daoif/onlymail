# 当前状态（STATUS）

## 当前目标
- 系统级重构已完成（P0-P6），代码编译全部通过。当前把部署路径定成三条：本地部署、GitHub-only 部署、混合部署；`init` 只处理默认入口和基础设施，`rebuild` 只重建 D1 + 重新部署，不碰 Cloudflare 外部入口。

## 已完成
- ✅ P0: 平台抽象层 — `lib/cloudflare.ts` 拆分为 `providers/` 接口 + CF 实现
- ✅ P1: API 路由落定为 `/api/*`（JWT）+ `/call/*`（API Key）
- ✅ P2: 敏感信息 + CI/CD — `wrangler.toml.template` + 模板现场生成，移除整文件 Secret 依赖
- ✅ P3: SDK 重设计 — Node.js/Python 路径→`/call/*`，新增域名操作
- ✅ P4: 初始化优化 — `scripts/init.ts` 一键初始化脚本
- ✅ P5: 前端体验 — 骨架屏 + SWR 缓存，5 个视图全部改造
- ✅ P6: 文档更新 — README、DEPLOY、STATUS、OVERVIEW 同步

## 下一步（最多 3 条）
1. 做 D1 migration 机制，让 `init` 能保留数据升级 schema，让 `rebuild` 能删除 D1 后重建
2. 补测试和 CI 验证，把“能 build”推进到“核心链路可验证”
3. 整理开源仓库面：`LICENSE`、`CONTRIBUTING.md`、`SECURITY.md`、`CHANGELOG.md`

## 阻塞/风险
- Pages 预览域名和正式 `pages.dev` 域名依赖 `ALLOWED_ORIGINS` 默认值，CI 需要跟着 Pages 项目真实 `subdomain` 生成
- 自定义前端域名现在会写进运行时设置；`init` 不再从 Cloudflare 回读这部分状态，后续如果再做批量导入，需要保持“D1 为事实来源”这条边界
- `Upstream Sync` 只做 fast-forward，同步策略保守；如果用户默认分支带长期私有改动，仍然需要手动处理

## 最近变更
- 所有 Cloudflare API 调用通过 Provider 接口解耦
- API 路由固定为 `/api/*`（JWT）+ `/call/*`（API Key）
- `wrangler.toml` 不再提交 Git，本地和 CI/CD 都按模板现场生成
- `scripts/init.ts` 现在只准备基础设施：D1、Worker、Pages 默认入口和可选 GitHub 配置，不再直接操作 Email Routing
- 本地参数改成根目录 `.env.local` 单一来源；`init`、`render:wrangler`、`setup:github`、`sync:dev-vars` 都先读这个文件
- `init` 会把 `D1_DATABASE_ID`、`JWT_SECRET` 回写到 `.env.local`，再生成 `worker/wrangler.toml` 和 `worker/.dev.vars`
- 新增 `pnpm run rebuild`：删除并重建 D1，轮换 `JWT_SECRET`，再重跑 `init`；DNS、自定义域名、Email Routing 外部入口不在这条命令里处理
- 新增 `pnpm deploy:worker`、`pnpm deploy:frontend` 两个本地重部署入口，给本地调试和应急使用
- 前端管理面板固定请求 Worker 默认 `workers.dev`；`VITE_API_BASE_URL` 不再作为用户配置项暴露，Worker 自定义域名只保留为别名
- `DOCS/DEPLOY.md` 改成“每条部署路线先列准备清单，再进入步骤”，并把 Email Routing 口径统一成“只要走 Email Routing 自动化，`CF_EMAIL` + `CF_GLOBAL_API_KEY` 就是必填”
- Email Routing Provider 改成直接走 global auth；根域名 bootstrap、子域名创建删除在进入 Cloudflare 变更前就先校验 `CF_EMAIL` / `CF_GLOBAL_API_KEY`
- 文档里删掉了 `Zone → Email Routing Rules` 这条 Token 权限说明，并补充 `CF_ACCOUNT_ID` 获取位置
- 根域名 bootstrap、Worker 自定义域名、Pages 自定义域名现在都按域名自动解析 Zone；项目边界明确为单一 Cloudflare 账号
- `CF_DEFAULT_ZONE_ID` 已从 `.env.local`、`worker/.dev.vars`、`wrangler.toml` 模板、GitHub workflow 和前端手动输入里移除
- Worker CORS 改为：模板默认来源 + 数据库里的运行时追加来源；设置页新增/删除 Pages 自定义域名时会同步维护
- Pages 自定义域名绑定继续走：读取 Pages 项目真实 subdomain → 自动创建或更新 CNAME → 重试验证，并在设置页显示验证/证书状态
- 新增 `Bootstrap Cloudflare` workflow，用于完全不拉本地的首次部署
- 新增 `Upstream Sync` workflow，用于 fork 仓库按 fast-forward 自动接收上游更新
- SDK 分发路径定为“直接从 GitHub 仓库子目录安装”：Node.js 主推 `pnpm`，Python 主推 `pip`；当前不发 npm / PyPI
- 地址页新增“生成临时邮箱”区域：直接拉取可用子域名、创建地址、展示结果、复制地址并跳到邮件页


