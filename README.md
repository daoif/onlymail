<p align="center">
  <img src="assets/brand/exports/onlymail-mark-256.png" alt="OnlyMail" width="112" />
</p>

<h1 align="center">OnlyMail</h1>

<p align="center">
  <a href="CHANGELOG.md">
    <img src="https://img.shields.io/badge/version-v0.1.0-111827?style=flat-square" alt="version" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-111827?style=flat-square" alt="license" />
  </a>
</p>

<p align="center">
  自部署的个人邮箱系统，基于 Cloudflare Workers + D1 + Email Routing + Pages，开箱即用。
</p>

<p align="center">
  <a href="https://qm.qq.com/q/AHUKoyLVKg">💬 QQ 交流群：993975349</a>
</p>

> 转载说明：本项目欢迎任何社区、论坛、平台转载分享。 但请勿将本项目发布至某 L 站。 原因是：本项目包含社群链接，按该站相关尺度，这类内容属于“推广”。

---

## ✨ 核心能力

| 能力 | 说明 |
|------|------|
| **临时邮箱** | 一键创建地址 → 接收邮件 → 查看详情 → 自动清理 |
| **管理面板** | Vue 3 前端，覆盖地址、邮件、域名与系统设置 |
| **域名自动化** | 根域名 bootstrap、子域名创建、DNS 与 Email Routing 全自动 |
| **双路认证** | 面板走管理员会话 (`/api/*`)，SDK 走 API Key (`/call/*`)，互不干扰 |
| **多语言 SDK** | Node.js + Python，封装地址创建与收件轮询 |

---

## 📂 项目结构

```text
worker/        Cloudflare Worker 后端
frontend/      Vue 3 + Tailwind 管理面板
sdk/nodejs/    Node.js SDK
sdk/python/    Python SDK
scripts/       初始化、迁移与部署脚本
DOCS/          部署、架构、决策与运维文档
```

---

## 🚀 快速开始

**1. 配置凭据**

复制 `.env.local.example` → `.env.local`，填入以下 4 个 Cloudflare 必填项：

```
CF_API_TOKEN
CF_ACCOUNT_ID
CF_EMAIL
CF_GLOBAL_API_KEY
```

**2. 一键初始化**

```bash
pnpm install
pnpm run init
```

`init` 是幂等的，会自动完成：

- 创建或复用 D1 数据库，执行未完成的 migration
- 创建或复用 Worker 与 Pages 默认入口并部署
- 回写 `D1_DATABASE_ID` 到本地配置

这套部署模型固定成 `4 + 1`：

- 手动准备 4 个 Cloudflare 凭据：`CF_API_TOKEN`、`CF_ACCOUNT_ID`、`CF_EMAIL`、`CF_GLOBAL_API_KEY`
- 系统自动维护 1 个内部状态：`D1_DATABASE_ID`

**3. 打开面板**

首次部署完成后，用 Pages 默认地址打开管理面板，创建管理员账号，即可在应用内绑定正式域名。

---

## 🤖 发给 AI 的快速部署提示

如果你不想先把仓库拉到本地，可以把下面这段直接发给**具有工具调用能力**的 AI，让它按 GitHub-only 路线去部署：

```text
你现在要帮我部署 OnlyMail，不需要把仓库拉到本地。

源仓库地址：
https://github.com/daoif/onlymail

注意：
- `daoif/onlymail` 是源仓库，只拿来读取文档和工作流定义
- 实际部署必须在我自己的 GitHub 仓库里进行
- 如果我还没有 fork，你先 fork 到我的 GitHub 账号，或者先在我的账号下创建一个自己的仓库，再把源仓库代码同步进去
- 后续所有 Secrets、Variables、Actions workflow、Cloudflare 部署，都只操作我自己的仓库，不要对源仓库做任何写操作

部署方式：
走 GitHub-only 部署，不走本地 init。

我会提供这 4 个 GitHub Secrets：
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- CF_EMAIL
- CF_GLOBAL_API_KEY

要求你直接完成这些事：
1. 检查仓库里的部署文档，优先看 DOCS/DEPLOY.md、DOCS/RUNBOOK.md、DOCS/UPDATE.md
2. 在我自己的 GitHub 仓库里配置部署需要的 Secrets / Variables
3. 手动触发 Bootstrap Cloudflare workflow
4. 等 Worker 和 Pages 默认入口部署完成
5. 告诉我默认前端地址和默认 Worker 地址
6. 再告诉我接下来在后台里还要做什么（管理员初始化、API Key、绑定自定义域名、根域名 bootstrap）

注意：
- OnlyMail 当前固定使用 onlymail-worker / onlymail-frontend / onlymail-db
- 管理面板固定请求 Worker 默认 workers.dev 地址
- Worker / Pages 自定义域名只是别名，不改变面板默认调用路径
- 只认 GitHub Release 作为正式版本来源，不要把普通 commit 当成正式更新
```

这条提示适合：

- 想让 AI 直接在 GitHub 上完成首次部署
- 不想先在本地装依赖、登录 Wrangler、跑 `pnpm run init`
- 想让 AI 直接在自己的 fork / 自建仓库上完成部署
- 后面准备继续用 GitHub Actions 做自动部署

---

## 🛠 本地开发

```bash
pnpm sync:dev-vars
pnpm render:wrangler
pnpm --dir worker dev       # 启动 Worker
pnpm --dir frontend dev     # 启动前端
```

> 纯本地调试不需要先跑 `init`；如需对接真实 Cloudflare 资源，按 [部署文档](DOCS/DEPLOY.md) 准备 `.env.local` 即可。

---

## 📦 部署方式

| 方式 | 适用场景 |
|------|----------|
| **本地部署** | `pnpm run init`，后续继续用本地命令重部署 |
| **GitHub-only** | 通过 `Bootstrap Cloudflare` workflow 完成首次部署 |
| **混合部署** | 先本地跑通，再用 `pnpm setup:github` 把当前 `origin` 仓库接到 CI 自动部署 |

完整步骤 → [DOCS/DEPLOY.md](DOCS/DEPLOY.md)

---

## 🔌 SDK

**Node.js**

```ts
import { OnlyMailClient } from '@onlymail/sdk-nodejs'

const client = new OnlyMailClient(
  'https://your-worker.your-account.workers.dev',
  process.env.ONLYMAIL_API_KEY!
)
```

**Python**

```python
from onlymail_sdk import OnlyMailClient

client = OnlyMailClient(
  'https://your-worker.your-account.workers.dev',
  api_key='YOUR_API_KEY'
)
```

> SDK 仅调用 `/call/*` 受控接口，不提供删除能力。

---

## 📖 文档

| 文档 | 链接 |
|------|------|
| 部署与运维 | [DEPLOY.md](DOCS/DEPLOY.md) |
| 更新路径 | [UPDATE.md](DOCS/UPDATE.md) |
| 系统全貌 | [OVERVIEW.md](DOCS/OVERVIEW.md) |
| 文档目录 | [SUMMARY.md](DOCS/SUMMARY.md) |
| 当前状态 | [STATUS.md](DOCS/STATUS.md) |
| 发布规则 | [RELEASING.md](DOCS/RELEASING.md) |
| 贡献说明 | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 安全反馈 | [SECURITY.md](SECURITY.md) |
| 变更记录 | [CHANGELOG.md](CHANGELOG.md) |

---

## 🏗 运行模型

<details>
<summary>点击展开：系统设计约定</summary>

- 当前实例按**单一 Cloudflare 账号**设计
- `init` 幂等初始化：保留现有 D1，补齐基础设施并重新部署
- `rebuild` 平台重建：删除并重建 D1，然后重跑 `init`
- 管理面板固定请求 Worker 默认 `workers.dev` 地址
- Worker / Pages 自定义域名是对外别名，不改变面板的默认调用路径
- 平台状态以 D1 为准；Cloudflare 上的外部残留不会被默认接管

</details>

---

## License

[MIT](LICENSE)
