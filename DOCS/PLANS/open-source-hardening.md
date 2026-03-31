# 开源化硬化状态

这份清单只做一件事：把项目从“主体功能已经完成”推进到“高质量开源项目”。第一轮基础硬化已经完成，下面记录当前设计和后续缺口。

## 当前结论

这 4 个面已经都落地了：

1. D1 migration 机制
2. 测试和 CI 验证
3. 开源仓库面整理
4. 发布与维护面整理

## 1. D1 migration 机制

当前设计：

- 数据库结构通过 `worker/db/migrations/` 里的 SQL 文件递增维护
- `schema_migrations` 记录已执行版本
- `pnpm migrate:d1` 提供手动入口
- `init` 保留现有 D1，并自动补齐未执行 migration
- `deploy:worker` 在部署前先自动补齐远程 migration
- `rebuild` 删除并重建 D1 后，再重跑 `init`

已完成：

- 新增 migration 目录和命名规则
- 增加 `schema_migrations` 版本记录表
- 把原来的 `schema.sql` 收进首个基线 migration
- 增加 migration 执行脚本和脚本层测试
- 补齐 migration 失败时的报错边界

仍需关注：

- 后续新增 migration 时，要明确是否兼容旧数据
- 一旦出现需要人工介入的数据迁移，必须同步写进 `CHANGELOG.md`

## 2. 测试和 CI 验证

当前设计：

- 根目录 `pnpm test` 统一跑脚本、Worker、前端三层测试
- GitHub Actions `CI` 在默认分支 push 和 PR 上自动执行测试、构建和检查
- `pnpm build`、`pnpm check:scripts`、`pnpm check:python` 作为发布前必跑项

已完成：

- 增加 D1 migration 脚本测试
- 增加 Worker 关键服务测试
- 增加前端 API 请求封装测试
- 把测试、构建、脚本检查、Python SDK 检查接进 CI

仍需关注：

- 当前测试更偏单元和最小 smoke test，真实 Cloudflare API 行为仍要靠线上 smoke test 验证
- 域名生命周期、Email Routing 异常分支、SDK 端到端链路还可以继续补

## 3. 开源仓库面整理

当前设计：

- 先把首次打开仓库最需要的文件配齐，再继续补示例和截图

已完成：

- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CHANGELOG.md`
- Issue / PR 模板
- README 里的部署、维护和开源入口整理

仍需关注：

- 可以继续补安装截图或 demo 图
- 后续如果出现外部贡献，再细化贡献规范

## 4. 发布与维护面整理

当前设计：

- 主仓库和两个 SDK 暂时同节奏发布
- 发布前固定跑一套检查，数据库变更按 migration 管理

已完成：

- `DOCS/RELEASING.md`
- 版本号策略
- release checklist
- 破坏性变更记录方式
- SDK 与主项目的版本关系说明

仍需关注：

- 首个公开版本号和 release note 还没正式打出来
- 如果后面 SDK 发布节奏独立，需要把版本策略拆开

## 当前优先级

下一步先做这 3 件事：

1. 跑一轮真实 Cloudflare 现场 smoke test
2. 补第二批业务链路测试
3. 准备首个公开版本发布
