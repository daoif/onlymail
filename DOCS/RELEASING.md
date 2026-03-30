# 发布与维护

## 版本策略

项目按语义化版本推进：

- `MAJOR`：破坏性变更、迁移成本明显变化
- `MINOR`：向后兼容的新功能
- `PATCH`：向后兼容的问题修复和文档修正

## 发布前检查

每次发布前至少做这些：

1. 跑完 `pnpm test`
2. 跑完 `pnpm build`
3. 跑完 `pnpm check:scripts`
4. 如果改了 Python SDK，再跑 `pnpm check:python`
5. 检查 `CHANGELOG.md`
6. 检查有没有新增 migration
7. 检查 `DOCS/STATUS.md` 是否还是现场事实

## 数据库变更要求

只要版本里有数据库结构改动：

1. 新增 migration 文件
2. 写清楚是否兼容旧数据
3. 如果需要人工介入，写进 `CHANGELOG.md`
4. 如果是破坏性迁移，升 `MAJOR`

## 破坏性变更记录

以下情况都按破坏性变更处理：

- 公开 API 路径或返回结构改动
- SDK 方法签名改动
- 配置项删除或重命名
- 需要用户手工处理数据或重新部署

这类变更必须同时更新：

- `CHANGELOG.md`
- `DOCS/STATUS.md`
- 对应的 `DOCS/DECISIONS/*.md` 或 `DOCS/PLANS/*.md`

## SDK 版本关系

当前主仓库和 SDK 版本先保持同节奏发布：

- Node.js SDK
- Python SDK
- 主项目

后面如果 SDK 发布节奏独立，再单独拆版本规则。
