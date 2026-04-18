# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
