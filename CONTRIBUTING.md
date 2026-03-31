# Contributing

## 开始之前

动手前请先过一遍以下文件，了解项目的整体约定和现状：

- `AGENTS.md` —— 项目级规范
- `DOCS/SUMMARY.md` —— 文档索引
- `DOCS/STATUS.md` —— 当前进度与风险
- 当前改动涉及的 `DOCS/PLANS/*` —— 对应方案

## 本地准备

1. 复制 `.env.local.example` 为 `.env.local`
2. 填好 4 个 Cloudflare 必填项：`CF_API_TOKEN`、`CF_ACCOUNT_ID`、`CF_EMAIL`、`CF_GLOBAL_API_KEY`
3. 安装依赖：`pnpm install`
4. 生成本地配置：`pnpm render:wrangler`、`pnpm sync:dev-vars`

> `D1_DATABASE_ID` 不需要手动填写。`init` / `rebuild` 会自动回写到 `.env.local`；混合部署时由 `pnpm setup:github` 同步到 GitHub。

## 常用命令

完整说明见 `AGENTS.md`，这里只列速查：

- `pnpm run init` —— 幂等初始化
- `pnpm run rebuild` —— 删除并重建 D1，再重跑 init
- `pnpm deploy:worker` —— 重部署 Worker
- `pnpm deploy:frontend` —— 重部署前端
- `pnpm setup:github` —— 同步 GitHub Secrets / Variables
- `pnpm test` —— 跑全部测试
- `pnpm build` —— 构建 Worker + 前端
- `pnpm check:scripts` —— 检查脚本层 TypeScript
- `pnpm --dir worker dev` —— 启动 Worker 本地开发
- `pnpm --dir frontend dev` —— 启动前端本地开发
- `pnpm migrate:d1 --local` —— 本地跑数据库 migration

## 提交前检查

提交前至少确保以下命令全部通过：

- `pnpm test`
- `pnpm build`
- `pnpm check:scripts`

如果改动涉及 Python SDK，还需要跑：

- `pnpm check:python`

## 数据库改动

数据库结构变更一律通过新增 migration 文件完成，不要直接修改 schema 文件：

- 目录：`worker/db/migrations/`
- 命名：`0002_xxx.sql`、`0003_xxx.sql`……
- 不要在 migration 里手写 `BEGIN` / `COMMIT`

如果改动会影响已有数据的语义，请先在 `DOCS/DECISIONS/` 写一份决策记录，说明取舍。

## 文档同步

以下情况需要同步更新对应文档：

| 变更类型 | 更新目标 |
|---------|---------|
| 模块边界变了 | `DOCS/OVERVIEW.md` |
| 当前状态变了 | `DOCS/STATUS.md` |
| 新增或移动文档 | `DOCS/SUMMARY.md` |
| 关键决策落地 | 新增 `DOCS/DECISIONS/*.md` |

## Pull Request

PR 描述至少包含以下信息：

- 改了什么
- 为什么要改
- 怎么验证
- 是否涉及迁移、兼容性或破坏性变更
