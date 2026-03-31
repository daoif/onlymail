# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
