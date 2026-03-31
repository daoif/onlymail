## 项目约定（项目特有）

### 目录结构
- `DOCS/` 是唯一正式文档目录，不再使用小写 `docs/`。
- `DOCS/RESEARCH/` 只放外部平台或参考项目调研，不直接当成本项目方案。
- `DOCS/PLANS/` 只放本项目的范围、路线图和实施方案。
- `reference/` 只做参考，不在这个目录直接实现本项目代码。

### 文档入口
- 总入口先看 `DOCS/SUMMARY.md`。
- 想快速跑通一条完整路径，先看 `DOCS/RUNBOOK.md`。
- 想看部署方式、本地/GitHub/混合部署差异，先看 `DOCS/DEPLOY.md`。
- 想看自动更新、版本提醒和 Upstream Sync，先看 `DOCS/UPDATE.md`。
- 想准备发版，先看 `DOCS/RELEASING.md`。
- 想知道当前现场事实和剩余待办，先看 `DOCS/STATUS.md`。

### 常用命令
- `pnpm run init`：幂等初始化，保留现有 D1，补齐基础设施并重新部署 Worker / Frontend。
- `pnpm run rebuild`：删除并重建 D1，再重跑 `init`。
- `pnpm deploy:worker`：重部署 Worker，并在部署前补齐远程 D1 migration 和默认 Pages 来源。
- `pnpm deploy:frontend`：重部署前端，始终按 Worker 默认 `workers.dev` 入口重新构建。
- `pnpm setup:github`：把当前 `origin` 仓库需要的 GitHub Secrets / Variables 写进去。
- `pnpm --dir worker dev`：启动 Worker 本地开发。
- `pnpm --dir frontend dev`：启动前端本地开发。
- `pnpm test`：跑脚本、Worker、前端测试。
- `pnpm check:scripts`：检查脚本层 TypeScript。
- `pnpm --dir worker build`：检查 Worker 构建。
- `pnpm --dir frontend build`：检查前端构建。

### 部署状态约定
- 手动配置只保留 4 个 Cloudflare 凭据：`CF_API_TOKEN`、`CF_ACCOUNT_ID`、`CF_EMAIL`、`CF_GLOBAL_API_KEY`。
- 自动维护只保留 1 个内部状态：`D1_DATABASE_ID`。
- Worker 名固定为 `onlymail-worker`，Pages 项目名固定为 `onlymail-frontend`，不再作为用户配置项暴露。
- `ALLOWED_ORIGINS` 不再走 env / GitHub Variables 链；Worker CORS 运行时只认 D1 `settings.allowed_origins`，再固定补一个本地开发来源 `http://localhost:5173`。

### 风险清单
- 需要在线轮换的运行时配置，不要设计成只能通过环境变量更新。
- Cloudflare 域名、DNS、Email Routing 相关结论，先落到 `DOCS/RESEARCH/`，再进入 `DOCS/PLANS/`。
- 任何对外接口变更，都要同步更新 `DOCS/PLANS/` 和 `DOCS/STATUS.md`。

### 平台抽象约束
- **禁止在 service 层直接调用 Cloudflare API**。所有平台特定操作必须通过 `worker/src/providers/` 下的 Provider 接口调用。
- 当前只实现 CF Provider（`providers/cloudflare/`），后续可增加其他 Provider 实现。
- 详见 `DOCS/PLANS/engineering-sdk.md` 第四章。

### 前端体验约束
- **禁止裸 loading**：页面不得出现完全空白等待数据的状态，必须有骨架屏占位。
- **切页不闪**：页面切换必须复用缓存（SWR）或骨架过渡，不能闪白。
- **渐进加载**：数据到达后渐进渲染，不要一次性替换整个页面。
- 详见 `DOCS/PLANS/engineering-sdk.md` 第五章。
