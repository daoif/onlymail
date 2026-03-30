# 开源化待办

这份清单只做一件事：把项目从“主体功能已经完成”推进到“高质量开源项目”。

## 当前主线

按优先级往下做：

1. D1 migration 机制
2. 测试和 CI 验证
3. 开源仓库面整理
4. 发布与维护面整理

## 1. D1 migration 机制

目标：
- 保留现有数据的前提下安全升级数据库
- 让 `init` 变成“保留 D1 + 自动补 migration”
- 让 `rebuild` 变成“删除 D1 + 重建 + 自动补 migration”

待办：
- 增加 migration 目录和命名规则
- 增加 `schema_migrations` 版本记录表
- 把当前 `schema.sql` 拆成首个基线 migration
- 增加 migration 执行脚本
- 让 `init` 自动执行未应用 migration
- 让 `rebuild` 删除 D1 后重新走完整 migration
- 补 migration 失败时的错误提示和回滚边界说明

当前判断：
- 这块没有必须先等用户拍板的决策
- 先按“SQL 文件 migration + 版本记录表 + init 自动补齐”推进

## 2. 测试和 CI 验证

目标：
- 不只知道“能 build”，还知道“核心能力没坏”

待办：
- 增加 Worker 核心服务测试
- 增加脚本层最小 smoke test
- 增加前端关键请求链路测试
- 把测试接进 GitHub Actions
- 明确哪些检查是 PR 必过项

## 3. 开源仓库面整理

目标：
- 让外部开发者第一次打开仓库就能理解、安装、贡献

待办：
- 补 `LICENSE`
- 补 `CONTRIBUTING.md`
- 补 `SECURITY.md`
- 补 `CHANGELOG.md`
- 收紧 README 的安装、升级、排障入口
- 补一份更明确的架构入口图或说明

## 4. 发布与维护面整理

目标：
- 让仓库从“可读代码”进入“可持续发布和维护”

待办：
- 明确版本号策略
- 明确 release checklist
- 补 issue / PR 模板
- 补破坏性变更记录方式
- 明确 SDK 和主项目的版本关系

## 下一步

直接进入 D1 migration 机制设计和实现。
