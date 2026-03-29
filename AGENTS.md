## 项目约定（项目特有）

### 目录结构
- `DOCS/` 是唯一正式文档目录，不再使用小写 `docs/`。
- `DOCS/RESEARCH/` 只放外部平台或参考项目调研，不直接当成本项目方案。
- `DOCS/PLANS/` 只放本项目的范围、路线图和实施方案。
- `reference/` 只做参考，不在这个目录直接实现本项目代码。

### 常用命令
- `pnpm --dir worker dev`：启动 Worker 本地开发。
- `pnpm --dir frontend dev`：启动前端本地开发。
- `pnpm --dir worker build`：检查 Worker 构建。
- `pnpm --dir frontend build`：检查前端构建。

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
