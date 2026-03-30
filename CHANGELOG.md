# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- D1 migration 机制，`init` / `rebuild` / `deploy:worker` 已接入。
- 根级测试入口 `pnpm test`，覆盖脚本 migration 逻辑和 Worker smoke test。
- GitHub Actions `CI` workflow。
- 开源仓库基础文件：`LICENSE`、`CONTRIBUTING.md`、`SECURITY.md`。

### Changed
- 前端管理面板固定请求 Worker 默认 `workers.dev`，不再把 `VITE_API_BASE_URL` 当用户配置项。
- `init` 和文档口径统一为：4 个 Cloudflare 值是正常可用部署的必填项。
