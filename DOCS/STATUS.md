# 当前状态（STATUS）

## 当前目标
- 系统级重构已完成（P0-P6），代码编译全部通过。下一步做一次从 0 删除并重建 Cloudflare 配置的完整联调，覆盖 Worker、Pages、自定义域名和收件地址。

## 已完成
- ✅ P0: 平台抽象层 — `lib/cloudflare.ts` 拆分为 `providers/` 接口 + CF 实现
- ✅ P1: API 路由重构 — `/admin/*` → `/api/*`（JWT），新增 `/call/*`（API Key）
- ✅ P2: 敏感信息 + CI/CD — `wrangler.toml.template` + `BACKEND_TOML` Secret 注入
- ✅ P3: SDK 重设计 — Node.js/Python 路径→`/call/*`，新增域名操作
- ✅ P4: 初始化优化 — `scripts/init.ts` 一键初始化脚本
- ✅ P5: 前端体验 — 骨架屏 + SWR 缓存，5 个视图全部改造
- ✅ P6: 文档更新 — README、DEPLOY、STATUS、OVERVIEW 同步

## 下一步（最多 3 条）
1. 删除现有 Cloudflare 资源后，从 0 重跑 Worker、Pages 和自定义域名配置
2. 用真实根域名初始化 + 创建子域名地址，验证收件全链路
3. SDK（Node.js + Python）做一次真环境联调

## 阻塞/风险
- Email Routing catch-all 规则需手动在 CF 控制台配置，初始化脚本未覆盖此步骤
- `wrangler.toml` 从 `.template` 生成后需手动检查配置值是否正确

## 最近变更
- 所有 Cloudflare API 调用通过 Provider 接口解耦
- API 路由统一为 `/api/*`（JWT）+ `/call/*`（API Key），删除旧 `/admin/*` 路由
- `wrangler.toml` 不再提交 Git，CI/CD 通过 Secret 注入
- SDK 移除 DELETE 方法，新增域名操作（listDomains/getDomain/createSubdomain）
- 前端所有视图添加骨架屏和 SWR 缓存，消除裸 loading 和切页闪白
- 新增 `scripts/init.ts` 一键初始化脚本
- Pages 自定义域名绑定改为：读取 Pages 项目真实 subdomain → 自动创建或更新 CNAME → 重试验证，并在设置页显示验证/证书状态


