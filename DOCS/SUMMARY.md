# 文档索引

本文件列出 `DOCS/` 下的所有文档，按用途分为四组。首次阅读建议从 [RUNBOOK](RUNBOOK.md) 开始。

## 核心文档

- [README](README.md) —— DOCS 目录入口
- [DOMAIN-SETUP](DOMAIN-SETUP.md) —— 把域名从域名商接入 Cloudflare
- [RUNBOOK](RUNBOOK.md) —— 快速跑通一条完整路径
- [UPDATE](UPDATE.md) —— 部署后怎么跟上新版本
- [OVERVIEW](OVERVIEW.md) —— 系统架构与模块职责
- [RELEASING](RELEASING.md) —— 版本策略与发布流程
- [STATUS](STATUS.md) —— 当前进度、风险与待办

## 调研

外部平台和参考项目的调研记录，不直接作为本项目方案。

- [CFTE 参考项目调研](RESEARCH/cfte-research.md)
- [Cloudflare Email Routing 调研](RESEARCH/cf-email-routing-research.md)

## 规划

本项目的范围、路线图和实施方案。

- [项目范围](PLANS/project-scope.md)
- [后端与基础设施方案](PLANS/backend-infra.md)
- [前端 UI Spec](PLANS/frontend-ui-spec.md)
- [前端与 SDK 方案](PLANS/frontend-sdk.md)
- [工程化与 SDK 方案](PLANS/engineering-sdk.md)
- [邮件收发六层边界](PLANS/mail-flow-boundaries.md)
- [开源化硬化状态](PLANS/open-source-hardening.md)

## 决策

关键技术决策的记录，说明背景、取舍和结论。

- [API Key 放进 D1](DECISIONS/0001-api-key-in-d1.md)
- [邮件在收件时解析并落库](DECISIONS/0002-parse-mail-on-ingest.md)
- [前端只用 Tailwind 手写样式](DECISIONS/0003-tailwind-only-admin-ui.md)
- [平台抽象 Provider 层](DECISIONS/0005-provider-abstraction.md)
- [D1 migration 机制](DECISIONS/0006-d1-migrations.md)
- [正式 Release 更新提醒](DECISIONS/0007-release-update-notifications.md)

