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

## 快速开始

### 首次部署

```bash
pnpm install
pnpm run init    # 一键初始化（创建 D1、生成配置、设置 Secrets）
```

### 本地开发

```bash
# 配置环境变量
cp worker/wrangler.toml.template worker/wrangler.toml
# 编辑 wrangler.toml 填入实际值

# 启动后端
pnpm --dir worker dev

# 启动前端
pnpm --dir frontend dev
```

首次打开登录页时，如果系统还没有管理员账号，页面会先进入初始化流程。

## 部署

- Worker 通过 GitHub Actions 自动部署到 Cloudflare
- `wrangler.toml` 不提交 Git，通过 `BACKEND_TOML` Secret 注入
- 前端通过 Cloudflare Pages 自动部署

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

Private

