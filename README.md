<p align="center">
  <img src="assets/brand/exports/onlymail-mark-256.png" alt="OnlyMail" width="112" />
</p>

<h1 align="center">OnlyMail</h1>

<p align="center">
  <a href="CHANGELOG.md">
    <img src="https://img.shields.io/badge/version-v0.3.0-111827?style=flat-square" alt="version" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-111827?style=flat-square" alt="license" />
  </a>
</p>

<p align="center">
  完全运行在 Cloudflare 上的自部署邮箱系统 —— Workers · D1 · Email Routing · Pages，支持“根域名直收 + managed subdomain”两种收件域模式。
</p>

<p align="center">
  <a href="https://qm.qq.com/q/AHUKoyLVKg">💬 QQ 交流群：993975349</a>
</p>

> 转载说明：本项目欢迎任何社区、论坛、平台转载分享。 但请勿将本项目发布至某 L 站。 原因是：本项目包含社群链接，按该站相关尺度，这类内容属于“推广”。

---

## ✨ 核心能力

| 能力 | 说明 |
|------|------|
| **临时邮箱** | 一键创建收件地址，自动接收并展示邮件，到期自动清理 |
| **管理面板** | Vue 3 前端，统一管理地址、邮件、域名和系统设置 |
| **域名自动化** | 支持两种收件域模式：根域名 bootstrap 后可直接收 `abc@root.com`，也可显式托管 managed subdomain 做项目隔离；子域名分长期 / 临时，临时项按根域名独立轮换 |
| **双路认证** | 面板走管理员会话（`/api/*`），SDK 走 API Key（`/call/*`），权限隔离 |
| **多语言 SDK** | 提供 Node.js 和 Python SDK，封装地址创建与收件轮询 |

---

## 📮 两种邮箱域名管理方式

### 1. 根域名直收

- 在 **域名** 页完成根域名 bootstrap 后，就能直接创建 `abc@yourdomain.com`
- 适合想尽快开收、域名数量少、维护成本低的场景

### 2. managed subdomain（托管子域）

- 在已初始化根域名下显式创建 `m1.yourdomain.com`、`m1.m1.yourdomain.com`
- 适合按项目 / 批次 / 租户隔离收件域名的场景
- 长期子域名不会被自动轮换删除；临时子域名达到设置页里的轮换总数后，按 root 自动回收最旧临时项
- 设置页可选择 DNS 模式：官方兼容模式每个子域名 4 条 DNS；精简模式每个子域名 1 条 MX
- 域名页会按根域名显示已管理 DNS、剩余可用 DNS 和可管理 DNS 容量

地址页会把两类已就绪域名一起列出来，创建邮箱时直接选择即可。

---

## 📂 项目结构

```text
worker/        Cloudflare Worker 后端（API + 收件入口）
frontend/      Vue 3 + Tailwind 管理面板
sdk/nodejs/    Node.js SDK
sdk/python/    Python SDK
scripts/       初始化、迁移与部署脚本
DOCS/          部署、架构、决策与运维文档
```

---

## 🚀 快速开始

**1. 配置凭据**

复制 `.env.local.example` 为 `.env.local`，填入 4 个 Cloudflare 必填项：

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

`init` 是幂等的，可以安全重复运行。它会自动完成：

- 创建或复用 D1 数据库，并执行所有未完成的 migration
- 创建或复用 Worker 与 Pages 默认入口，并完成部署
- 将 `D1_DATABASE_ID` 回写到本地配置

整套部署模型遵循 **4 + 1** 原则：

- **4 个手动准备**：Cloudflare 凭据 `CF_API_TOKEN`、`CF_ACCOUNT_ID`、`CF_EMAIL`、`CF_GLOBAL_API_KEY`
- **1 个自动维护**：系统内部状态 `D1_DATABASE_ID`

**3. 打开面板**

部署完成后，用 Pages 默认地址（`*.pages.dev`）打开管理面板，创建管理员账号。随后在应用内完成两类配置：

- **Web 入口（可选但推荐）**：绑定 Worker / Pages 自定义域名
- **收件域（必做）**：先初始化根域名；之后可直接用根域名收件，或按项目再创建 managed subdomain

---

## 🤖 发给 AI 的快速部署提示

如果你不想在本地操作，可以把下面这段提示词直接发给**具有工具调用能力**的 AI（例如 Cursor、Windsurf、Claude Code），让它按 GitHub-only 路线完成部署：

<details>
<summary>点击展开提示词</summary>

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
6. 再告诉我接下来在后台里还要做什么（管理员初始化、API Key、绑定自定义域名、根域名 bootstrap，以及选择“根域名直收”还是“managed subdomain”）

注意：
- OnlyMail 当前固定使用 onlymail-worker / onlymail-frontend / onlymail-db
- 管理面板固定请求 Worker 默认 workers.dev 地址
- Worker / Pages 自定义域名只是别名，不改变面板默认调用路径
- 只认 GitHub Release 作为正式版本来源，不要把普通 commit 当成正式更新
```

</details>

这条提示适合以下场景：

- 想让 AI 直接在 GitHub 上完成首次部署，不在本地装依赖
- 想在自己的 fork 或自建仓库上完成部署
- 后续打算用 GitHub Actions 做持续部署

---

## 🛠 本地开发

```bash
pnpm sync:dev-vars          # 同步开发环境变量
pnpm render:wrangler        # 生成 wrangler.toml
pnpm --dir worker dev       # 启动 Worker（http://127.0.0.1:8787）
pnpm --dir frontend dev     # 启动前端（http://localhost:5173）
```

> 纯本地调试不需要先跑 `init`。如需连接真实 Cloudflare 资源，参考 [部署文档](DOCS/DEPLOY.md) 配好 `.env.local` 即可。

---

## 📦 部署方式

| 方式 | 适用场景 | 入口命令 |
|------|----------|----------|
| **本地部署** | 先调试再上线，不依赖 GitHub | `pnpm run init` |
| **GitHub-only** | 全程在 GitHub 上完成，无需本地环境 | `Bootstrap Cloudflare` workflow |
| **混合部署** | 先本地跑通，再接入 CI 自动部署 | `pnpm run init` → `pnpm setup:github` |

详细步骤 → [DOCS/DEPLOY.md](DOCS/DEPLOY.md)

---

## 🔌 SDK

正式版走 GitHub Release 附件，npm / pnpm / yarn / bun 都能装。

**Node.js 安装**

```bash
npm install "https://github.com/<owner>/<repo>/releases/download/v<version>/onlymail-sdk-nodejs-<version>.tgz"
```

**Python 安装**

```bash
python -m pip install "https://github.com/<owner>/<repo>/releases/download/v<version>/onlymail_sdk-<version>-py3-none-any.whl"
```

要跟未发版代码，也可以从仓库子目录装：

- Node.js：`pnpm add "git+https://github.com/<owner>/<repo>.git#<ref>&path:/sdk/nodejs"`
- Python：`python -m pip install "git+https://github.com/<owner>/<repo>.git@<ref>#subdirectory=sdk/python"`

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

> SDK 仅调用 `/call/*` 受控接口，只能创建和查询，不提供删除能力，Key 泄露不会导致数据丢失。

---

## 📖 文档

| 文档 | 说明 |
|------|------|
| [SUMMARY.md](DOCS/SUMMARY.md) | DOCS 总入口与索引 |
| [DOMAIN-SETUP.md](DOCS/DOMAIN-SETUP.md) | 把域名从域名商接入 Cloudflare |
| [RUNBOOK.md](DOCS/RUNBOOK.md) | 从零开始的完整操作路径 |
| [DEPLOY.md](DOCS/DEPLOY.md) | 三种部署方式的详细步骤 |
| [UPDATE.md](DOCS/UPDATE.md) | 版本更新与自动同步 |
| [OVERVIEW.md](DOCS/OVERVIEW.md) | 系统架构全貌 |
| [STATUS.md](DOCS/STATUS.md) | 当前开发状态与待办 |
| [RELEASING.md](DOCS/RELEASING.md) | 发布流程与版本规则 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 贡献者指南 |
| [SECURITY.md](SECURITY.md) | 安全问题反馈 |
| [CHANGELOG.md](CHANGELOG.md) | 变更记录 |

---

## 🏗 运行模型

<details>
<summary>点击展开：系统设计约定</summary>

- 当前实例按**单一 Cloudflare 账号**设计，不支持跨账号混用凭证
- `init` 幂等初始化：保留现有 D1，补齐缺失的基础设施，然后重新部署
- `rebuild` 平台重建：删除并重建 D1，然后重跑 `init`；不碰 DNS 和外部入口
- 管理面板始终请求 Worker 默认 `workers.dev` 地址
- Worker / Pages 自定义域名仅作为对外别名，不影响面板的 API 调用路径
- 收件域名支持两种模式：根域名直收，或在已初始化根域名下显式创建 managed subdomain
- 平台状态以 D1 为唯一事实来源；Cloudflare 上的外部残留不会被自动接管

</details>

---

## License

[MIT](LICENSE)
