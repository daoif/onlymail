# 0006: D1 migration 机制

## 状态
已实施

## 背景
项目原来只靠 `worker/db/schema.sql` 和 `CREATE TABLE IF NOT EXISTS` 初始化数据库。这个方式能处理首次建表，但不能安全覆盖版本升级中的新增列、索引调整和数据迁移。

## 决策
引入基于 SQL 文件的 D1 migration 机制：
- migration 文件放在 `worker/db/migrations/`
- 文件名按 `0001_xxx.sql` 递增
- 用 `schema_migrations` 记录已应用版本
- `init` 自动执行未应用 migration
- `rebuild` 删除 D1 后重新跑完整 migration
- `deploy:worker` 在部署 Worker 前先执行远程 migration

## 理由
1. **保留数据升级**：`init` 可以继续保持幂等，不需要为了升级 schema 删除 D1。
2. **部署链路闭环**：版本更新时，数据库升级不再依赖手工操作。
3. **实现简单**：现阶段用 SQL 文件就够，不需要先引入更重的迁移框架。

## 约束
1. migration 文件默认不写 `BEGIN/COMMIT`，由执行器统一包事务。
2. 新 migration 需要按“先兼容旧代码、再服务新代码”的思路写，避免部署窗口内前后版本互相打断。
3. `rebuild` 仍然只处理 D1 和平台内部状态，不碰 DNS、自定义域名和 Email Routing 外部入口。
