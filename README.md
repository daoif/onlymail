# mails

基于 Cloudflare Workers + D1 + Email Routing 的个人邮箱系统，支持注册机自动化调用和后台管理。

## 功能

- 📧 **临时邮箱**：创建临时邮箱地址，自动收件，TTL 过期自动清理
- 🔑 **双路认证**：JWT（前端完整权限）+ API Key（SDK 受控子集）
- 🖥️ **管理面板**：Vue 3 管理界面，骨架屏加载 + SWR 缓存策略
- 🌐 **域名管理**：自动化 DNS 和 Email Routing 规则的创建与回收
- 📦 **多语言 SDK**：Node.js 和 Python SDK，封装 `waitForMail` 和域名操作
- 🔌 **平台抽象**：Provider 接口层，后续可脱离 Cloudflare

## 项目结构

```
worker/              # Cloudflare Worker 后端（Hono + D1）
  src/providers/     # 平台抽象层（Provider 接口 + CF 实现）
  src/routes/        # API 路由（/api JWT + /call API Key）
  src/services/      # 业务逻辑
frontend/            # Vue 3 + Tailwind 管理面板
sdk/nodejs/          # Node.js SDK
sdk/python/          # Python SDK
scripts/             # 初始化脚本
DOCS/                # 项目文档
```

## 部署方式

### 1. 本地部署

适合先调试、先确认环境，或者你根本不想接 GitHub Actions。

这条路径里：
- 把仓库拉到本地
- 本地跑 `pnpm run init`
- 后续继续用本地命令部署 Worker 和 Pages

GitHub 在这条路径里不是必需项。

### 2. GitHub-only 部署

适合不想先拉到本地，想直接在自己的 GitHub 仓库里完成首次部署。

这条路径里：
- fork 本仓库，或新建一个自己的仓库后把代码放进去
- 在 GitHub 仓库里配置 Cloudflare secrets
- 手动运行 `Bootstrap Cloudflare` workflow
- 后续 push 代码后，Worker 和 Pages 自动更新

这条路径的首次初始化不依赖本地 `init`。

### 3. 混合部署

适合先在本地把环境调通，后面再切到 GitHub 自动更新。

这条路径里：
- 先在本地跑一次 `pnpm run init`
- 再执行 `pnpm setup:github`，把后续自动部署需要的仓库配置写进去
- 后续 push 到自己的 GitHub 仓库，交给 Actions 自动部署

如果你需要改代码、调试 Cloudflare 现场、排查域名问题，这条路径最顺手。

## 快速开始

### 首次部署

```bash
pnpm install
pnpm run init    # 首次接入 Cloudflare：创建 D1、部署 Worker、准备 Pages，默认入口走 workers.dev + pages.dev
```

`worker/wrangler.toml` 是本地运行配置，会由模板生成，不提交 Git。

`init` 只准备基础设施，不会提前绑定 Worker / Pages 自定义域名。自定义域名留给应用里的初始化引导和设置页处理。

如果你不想先拉到本地，可以直接走上面的 GitHub-only 部署，第一次运行 `Bootstrap Cloudflare` workflow 即可。

`init` 可以重复运行，用来重新对齐 D1、Worker、Pages 这些基础设施；但它会刷新 `JWT_SECRET`，现有后台登录态会失效。

### 本地开发

先复制 `worker/.dev.vars.example` 为 `worker/.dev.vars`，至少填好 `JWT_SECRET`。

```bash
# 先生成 worker/wrangler.toml
CF_DEFAULT_ZONE_ID="你的ZoneID" \
CF_ACCOUNT_ID="你的AccountID" \
D1_DATABASE_ID="你的database_id" \
pnpm render:wrangler

# 启动后端
pnpm --dir worker dev

# 启动前端
pnpm --dir frontend dev
```

首次打开登录页时，如果系统还没有管理员账号，页面会先进入初始化流程。

只调本地页面和本地 API 时，不需要先跑 `init`。`init` 是给第一次接到真实 Cloudflare 环境时用的。

如果你在本地还要测试域名、Pages、自定义域名这些 Cloudflare 管理能力，再把下面这些补进 `worker/.dev.vars`：
- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`
- `CF_DEFAULT_ZONE_ID`
- `CF_DEFAULT_PAGES_PROJECT`

如果你在本地还要继续测 Email Routing 的启用、关闭、清理，再额外补：
- `CF_EMAIL`（也兼容旧名字 `CF_AUTH_EMAIL`）
- `CF_GLOBAL_API_KEY`

## 部署

- Worker 通过 GitHub Actions 自动部署到 Cloudflare
- `wrangler.toml` 不提交 Git，CI 会按模板和 GitHub Secrets / Variables 现场生成
- 前端通过 Cloudflare Pages 自动部署
- 首次如果走 GitHub-only 部署，使用 `Bootstrap Cloudflare` workflow 做基础设施初始化
- 如果你维护自己的 fork，还可以启用 `Upstream Sync` workflow 定时同步上游更新

## 配置输入

最低需要：
- Cloudflare API Token
- Cloudflare Account ID
- Cloudflare Zone ID
- D1 Database ID

可选增强：
- `CF_GLOBAL_API_KEY` + `CF_EMAIL`：让 AI 或脚本继续处理 Email Routing 的启用、关闭、清理和排查
- `gh` CLI：让 AI 或脚本直接写 GitHub Secrets / Variables，少走网页步骤
- `ALLOWED_ORIGINS`：需要手动覆盖默认来源时再提供；默认会按 Pages 项目的 `pages.dev` 地址和本地开发地址生成
- `GITHUB_REPOSITORY`：给了以后，`init` 可以顺手调用 `gh` 写 GitHub 仓库配置

推荐做法是先给最低必需项，缺到关键节点再补可选项。AI 检测到 `gh` 或额外 Cloudflare 凭证时，可以直接继续，不需要再走手工说明。

首次跑完 `init` 后，先用 Pages 默认地址进入后台完成管理员初始化；等系统能用了，再在设置页绑定 `mails-api.你的域名` 和 `mails.你的域名` 这类正式入口。

如果你走 GitHub-only 路径，第一次 `Bootstrap Cloudflare` workflow 跑完后的顺序也一样：先用 `pages.dev` 默认地址初始化管理员，再在设置页绑定正式域名。

## SDK 接入

SDK 只面向你自己部署的实例，不提供公共服务地址。

### Node.js SDK

主推荐方式是用 `pnpm` 直接从 GitHub 安装子目录包：

```bash
pnpm add "git+https://github.com/<owner>/<repo>.git#master&path:/sdk/nodejs"
```

如果你想把依赖直接写进 `package.json`：

```json
{
  "dependencies": {
    "@mails/sdk-nodejs": "git+https://github.com/<owner>/<repo>.git#master&path:/sdk/nodejs"
  }
}
```

然后在项目里这样用：

```ts
import { MailsClient } from '@mails/sdk-nodejs'

const client = new MailsClient('https://your-worker.your-account.workers.dev', process.env.MAILS_API_KEY!)
```

### Python SDK

主推荐方式是用 `pip` 直接从 GitHub 安装子目录包：

```bash
python -m pip install "git+https://github.com/<owner>/<repo>.git@master#subdirectory=sdk/python"
```

如果你想把依赖写进 `requirements.txt`：

```txt
git+https://github.com/<owner>/<repo>.git@master#subdirectory=sdk/python
```

然后在项目里这样用：

```python
from mails_sdk import MailsClient

client = MailsClient('https://your-worker.your-account.workers.dev', api_key='YOUR_API_KEY')
```

### 当前边界

- Node SDK 当前主支持 `pnpm` 的 Git 子目录安装
- Python SDK 主支持 `pip` 的 Git 子目录安装
- 现在不发 npm，也不发 PyPI
- 后面是否发包，等仓库外复用频率和版本维护需求都更明确后再决定

### 实际接入顺序

1. 先部署自己的实例
2. 登录后台，在设置页生成 API Key
3. 选择一个后端地址作为 `baseUrl`
   - 正式环境优先用你自己绑定的 Worker API 自定义域名
   - 没绑自定义域名时，用默认 `workers.dev` 地址
4. 再在业务项目里安装 SDK
5. 用 SDK 调 `createAddress -> waitForMail -> getMail`

## API 概览

### `/api/*` — 管理 API（Bearer JWT）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/init-status` | 查询管理员是否已初始化 |
| POST | `/api/init` | 首次初始化管理员账号 |
| POST | `/api/login` | 管理员登录 |
| GET | `/api/dashboard` | 统计概览 |
| POST | `/api/address` | 创建邮箱地址 |
| GET | `/api/addresses` | 地址列表（支持 domain/project 过滤） |
| DELETE | `/api/address/:name` | 删除地址 |
| GET | `/api/mails` | 邮件列表（支持 address 过滤） |
| GET | `/api/mail/:id` | 邮件详情 |
| DELETE | `/api/mail/:id` | 删除邮件 |
| POST | `/api/domains/bootstrap` | 根域名初始化 |
| GET | `/api/domains` | 域名列表（支持 type/root/limit 过滤） |
| GET | `/api/domains/:name` | 域名详情（含地址统计） |
| POST | `/api/domains` | 创建子域名 |
| DELETE | `/api/domains/:name` | 删除子域名 |
| GET | `/api/settings/api-key` | API Key 状态 |
| POST | `/api/settings/api-key/rotate` | 轮换 API Key |
| POST | `/api/settings/change-password` | 修改密码 |
| GET | `/api/settings/custom-domains` | Worker 自定义域名列表 |
| POST | `/api/settings/custom-domains` | 绑定 Worker 自定义域名 |
| DELETE | `/api/settings/custom-domains/:id` | 移除 Worker 自定义域名 |
| GET | `/api/settings/pages-domains` | Pages 自定义域名列表 |
| POST | `/api/settings/pages-domains` | 绑定 Pages 自定义域名（自动对齐 CNAME 并重试验证） |
| DELETE | `/api/settings/pages-domains/:domain` | 移除 Pages 自定义域名 |

### `/call/*` — SDK API（Bearer API Key）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/call/address` | 创建邮箱地址 |
| GET | `/call/mails/:address` | 按地址查邮件列表 |
| GET | `/call/mail/:id` | 邮件详情 |
| GET | `/call/domains` | 可用域名列表 |
| GET | `/call/domains/:name` | 域名详情 |
| POST | `/call/domains` | 创建子域名 |

> `/call/*` 只支持创建+只读，无 DELETE，Key 泄露不会造成数据丢失。

## License

暂未附带开源许可证。准备公开仓库时，再按你的发布方式补 `LICENSE`。

