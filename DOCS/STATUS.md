# 当前状态（STATUS）

## 当前目标
- 系统级重构已完成（P0-P6），代码编译全部通过。当前把部署路径定成三条：本地部署、GitHub-only 部署、混合部署；`init` 只准备基础设施默认入口，自定义域名留在应用内流程。

## 已完成
- ✅ P0: 平台抽象层 — `lib/cloudflare.ts` 拆分为 `providers/` 接口 + CF 实现
- ✅ P1: API 路由落定为 `/api/*`（JWT）+ `/call/*`（API Key）
- ✅ P2: 敏感信息 + CI/CD — `wrangler.toml.template` + 模板现场生成，移除整文件 Secret 依赖
- ✅ P3: SDK 重设计 — Node.js/Python 路径→`/call/*`，新增域名操作
- ✅ P4: 初始化优化 — `scripts/init.ts` 一键初始化脚本
- ✅ P5: 前端体验 — 骨架屏 + SWR 缓存，5 个视图全部改造
- ✅ P6: 文档更新 — README、DEPLOY、STATUS、OVERVIEW 同步

## 下一步（最多 3 条）
1. 用一个干净仓库验证 `Bootstrap Cloudflare` workflow，确认完全不拉本地也能首次部署
2. 用 fork 仓库验证 `Upstream Sync`，确认 fast-forward 更新能带动自动部署
3. 用真实根域名初始化 + 创建子域名地址，验证收件全链路

## 阻塞/风险
- Pages 预览域名和正式 `pages.dev` 域名依赖 `ALLOWED_ORIGINS` 默认值，CI 需要跟着 Pages 项目真实 `subdomain` 生成
- 自定义前端域名现在会写进运行时设置；后续如果再做批量导入，需要保持这条同步逻辑
- `Upstream Sync` 只做 fast-forward，同步策略保守；如果用户默认分支带长期私有改动，仍然需要手动处理

## 最近变更
- 所有 Cloudflare API 调用通过 Provider 接口解耦
- API 路由固定为 `/api/*`（JWT）+ `/call/*`（API Key）
- `wrangler.toml` 不再提交 Git，本地和 CI/CD 都按模板现场生成
- `scripts/init.ts` 现在只准备基础设施：D1、Worker、Pages 默认入口、可选 Email Routing 和可选 GitHub 配置
- Worker CORS 改为：模板默认来源 + 数据库里的运行时追加来源；设置页新增/删除 Pages 自定义域名时会同步维护
- Pages 自定义域名绑定继续走：读取 Pages 项目真实 subdomain → 自动创建或更新 CNAME → 重试验证，并在设置页显示验证/证书状态
- 新增 `Bootstrap Cloudflare` workflow，用于完全不拉本地的首次部署
- 新增 `Upstream Sync` workflow，用于 fork 仓库按 fast-forward 自动接收上游更新


