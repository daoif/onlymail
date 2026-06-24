# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [v0.4.3] - 2026-06-24

### Added
- 地址列表和邮件列表统一使用基础分页器，支持首页、上一页、下一页、末页、页码按钮和页码跳转。
- Worker 部署配置开启 Workers Logs observability，并使用 100% head sampling，确保定时清理任务的结构化日志进入 Cloudflare 历史日志。

### Changed
- 邮件管理页从只展示最近邮件改为分页列表，便于在不依赖搜索的情况下翻查历史邮件。
- 部署文档补充 Worker 历史日志采集约定，明确 `wrangler.toml` 由模板生成且包含 observability 配置。

## [v0.4.2] - 2026-06-24

### Changed
- Worker 定时任务增加结构化日志，按步骤记录 TTL 清理、D1 自动清理、管理员会话清理和版本检查的执行状态。
- 发布规范补充完整发布闭环约束：推上去更新默认包含版本号、GitHub 代码、tag、Release、SDK assets 和线上版本验收。
- 发布文档补充版本号与 GitHub Release 必须对齐的发版红线和发布后验收命令。

### Fixed
- 修复 TTL 过期邮箱清理失败会阻断后续 D1 95% 自动清理的问题；现在各定时任务步骤失败隔离，D1 自动清理会继续执行。
- 修复 TTL 过期邮箱清理在数据量较大时全量读取并拼接巨大 `IN` 参数的问题，改为 D1 内部分批删除。

## [v0.4.1] - 2026-06-24

### Changed
- 项目本地与 GitHub Actions 的 Node.js 基线升级到 24，并同步更新 Actions 主版本以使用 Node 24 runtime。
- `/call/domains` 使用 D1-only 轻量列表，机器客户端 discovery 不再触发 Cloudflare DNS inventory；管理后台 `/api/domains` 仍保留实时 DNS 配额展示。
- 已 ready 的 managed subdomain 创建请求增加 D1 fast path，减少重复调用 Cloudflare 的耗时。
- `/call/address` 创建前会先校验域名 ready，未 ready 时返回 `domain_not_ready`，避免创建实际不可收信的地址。
- `/call/address`、`/call/domains` 增加结构化耗时日志，便于观察 OnlyMail 调用耗时和错误。

### Fixed
- 修复部署脚本读取 Wrangler JSON 输出时混入日志导致解析失败的问题。

## [v0.4.0] - 2026-06-09

### Added
- 仪表盘清理操作下新增自动滚动清理开关：开启后 D1 占用达到 95% 时，会自动删除旧临时邮箱和对应邮件，只保留最近活跃的 100 个临时邮箱。
- Worker 定时任务新增 D1 容量守护逻辑，自动清理只处理临时邮箱和临时邮件，永久邮箱与永久邮件不受影响。
- 新增 D1 migration，为临时邮箱按最近活跃时间滚动裁剪补充索引。

### Changed
- 更新后端和前端方案文档，明确 D1 自动清理的触发条件、保留规则和发布/部署边界。

## [v0.3.2] - 2026-05-20

### Added
- 仪表盘新增 D1 容量展示，并把数据库管理收进新的一行。
- 仪表盘新增四类清理动作：清理临时邮件、清理永久邮件、清理临时邮箱、清理永久邮箱。

## [v0.3.1] - 2026-04-27

### Fixed
- 修正域名页根域名 DNS 统计口径：`remaining_dns_count` 现在按 Cloudflare 当前 Zone 的真实 DNS 已用数和计划上限计算，不再误用临时子域名轮换空位。
- 创建子域名前增加 Cloudflare DNS 剩余配额预检，剩余额度不足时提前返回清晰错误，避免依赖 Cloudflare 创建失败后的模糊报错。

### Changed
- 域名页文案改为显示 `CF DNS 剩余 / 上限`、`CF 当前已用`、`OnlyMail 已管理 DNS` 和按当前 DNS 模式估算的可新增子域数量。

## [v0.3.0] - 2026-04-27

### Added
- 域名页新增长期 / 临时子域名分类，长期子域名不参与自动轮换，临时子域名按每个根域名独立轮换。
- 根域名行新增 DNS 容量统计：已管理 DNS、剩余可用 DNS、可管理 DNS，以及长期 / 临时子域数量。
- 设置页新增域名轮换配置：可在线调整每个根域名的轮换总数。
- 设置页新增子域名 DNS 模式：官方兼容模式（3 MX + 1 TXT）与精简模式（1 MX）。
- 邮件页标题区新增刷新按钮，无需刷新整页即可重新拉取邮件。

### Changed
- 子域名创建按 DNS 模式动态计算 DNS 记录数量，精简模式下可显著提高同一根域名可承载的临时子域数量。
- SDK 创建子域名接口支持显式指定长期 / 临时类型，管理后台默认长期，SDK 默认临时。
- 域名生命周期、部署、更新和 Cloudflare Email Routing 调研文档同步更新到新口径。

### Fixed
- 子域名 DNS 资源对账兼容 Cloudflare 返回的尾点格式和非固定 MX priority，避免重复创建可复用 MX。

## [v0.2.0] - 2026-04-19

### Added
- managed subdomain 生命周期治理：创建前会按 root 自动回收最旧子域，默认上限为 5，可通过 `ONLYMAIL_MANAGED_SUBDOMAIN_LIMIT` 调整。
- 子域脏状态对账：删除会按 Cloudflare 当前真实 MX/TXT/Email Routing 规则精确回收，创建会补齐缺失资源并回写最新资源 ID。
- 补充域名生命周期修复方案与决策文档，明确多层子域仍按显式 managed subdomain 管理。

### Changed
- Cloudflare API 错误改为透传具体 `code/message`，例如 `81045 Record quota exceeded` 之类的现场错误可直接回显。
- Email Routing 规则读取改为完整分页，不再只看第一页结果。
- 删除与回滚流程只处理本次实际创建的 Cloudflare 资源，不再误删复用中的旧记录。

### Fixed
- 修复 `createSubdomain` 在 D1 已有旧记录时直接返回，导致 TXT / Email Routing 规则缺失无法自动修复的问题。
- 修复批量删除中途中断后遗留半残 DNS / 丢失规则 / D1 残留时，后续删除仍无法清理干净的问题。

## [v0.1.1] - 2026-04-01

### Added
- GitHub Actions `Release SDK Assets` workflow，正式 Release 发布后自动上传 Node.js `.tgz` 和 Python `.whl` / `.tar.gz`。
- SDK 发布产物构建与安装冒烟验证：先生成 Release 附件，再在临时 Node / Python 项目里完成本地安装检查。

### Changed
- Node.js / Python SDK 的正式分发方式改成 GitHub Release 附件，不再把仓库子目录安装当唯一正式入口。
- SDK 相关文档、运行手册和发布流程已统一到新的分发口径。

## [v0.1.0] - 2026-03-31

### Added
- D1 migration 机制，`init` / `rebuild` / `deploy:worker` 已接入。
- 根级测试入口 `pnpm test`，覆盖脚本 migration 逻辑和 Worker smoke test。
- GitHub Actions `CI` workflow。
- 开源仓库基础文件：`LICENSE`、`CONTRIBUTING.md`、`SECURITY.md`。
- GitHub-only 部署路径、`Bootstrap Cloudflare` workflow 和 `Upstream Sync` 自动同步。
- 正式 Release 更新提醒，后台可检查上游新版本并显示更新横幅。
- `DOCS/DOMAIN-SETUP.md`，单独说明域名从注册商接入 Cloudflare 的流程。

### Changed
- 前端管理面板固定请求 Worker 默认 `workers.dev`，不再把 `VITE_API_BASE_URL` 当用户配置项。
- `init` 和文档口径统一为：4 个 Cloudflare 值是正常可用部署的必填项。
- `init` 只处理基础设施和默认入口，自定义域名、根域名 bootstrap、Email Routing 收件配置改到应用内完成。
- 发布、部署、运行边界相关文档已统一到 README、DEPLOY、RUNBOOK、UPDATE、STATUS、RELEASING。
