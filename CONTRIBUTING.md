# Contributing

## 先看什么

开始前先读这些文件：

- `AGENTS.md`
- `DOCS/SUMMARY.md`
- `DOCS/STATUS.md`
- 当前要改动对应的 `DOCS/PLANS/*`

## 本地准备

1. 复制 `.env.local.example` 为 `.env.local`
2. 填好 4 个 Cloudflare 必填项
3. 安装依赖：`pnpm install`
4. 生成本地配置：`pnpm render:wrangler`、`pnpm sync:dev-vars`

## 常用命令

- `pnpm test`
- `pnpm build`
- `pnpm check:scripts`
- `pnpm --dir worker dev`
- `pnpm --dir frontend dev`
- `pnpm migrate:d1 --local`

## 提交前要求

提交前至少跑这些：

- `pnpm test`
- `pnpm build`
- `pnpm check:scripts`

如果改了 Python SDK，再补：

- `pnpm check:python`

## 数据库改动

数据库结构改动不要再改单个 schema 文件，直接按顺序新增 migration：

- 目录：`worker/db/migrations/`
- 命名：`0002_xxx.sql`、`0003_xxx.sql`
- 不要在 migration 里手写 `BEGIN/COMMIT`

如果改动会影响旧数据语义，先把取舍写进 `DOCS/DECISIONS/`。

## 文档同步

以下情况要同步更新文档：

- 模块边界变了：更新 `DOCS/OVERVIEW.md`
- 当前状态变了：更新 `DOCS/STATUS.md`
- 新增或移动文档：更新 `DOCS/SUMMARY.md`
- 关键选择落定：新增 `DOCS/DECISIONS/*.md`

## Pull Request

PR 描述至少要写清楚：

- 改了什么
- 为什么要改
- 怎么验证
- 有没有迁移、兼容性或破坏性影响
