# 部署指南

## 前置条件

以下是部署前**必须手动准备**的内容：

| 条件 | 操作方式 | 说明 |
|------|---------|------|
| Cloudflare 账户 | 🧑 手动 | 需要有至少一个域名托管在 CF |
| Node.js >= 20 | 🧑 手动 | 本地开发和 init 脚本需要 |
| pnpm >= 10 | 🧑 手动 | `npm i -g pnpm` |
| GitHub 私有仓库 | 🧑 手动 | 用于代码托管和 CI/CD |
| Cloudflare API Token | 🧑 手动 | 见下方「创建 API Token」 |
| `gh` CLI（可选） | 🧑 手动 | 用于自动设置 GitHub Secrets，不装则手动在网页上设 |

### 创建 Cloudflare API Token

打开 https://dash.cloudflare.com/profile/api-tokens → **Create Token** → **Custom Token**：

| 资源 | 权限 |
|------|------|
| Account → Workers Scripts | Edit |
| Account → D1 | Edit |
| Account → Cloudflare Pages | Edit |
| Zone → DNS | Edit |
| Zone → Email Routing Rules | Write |
| Zone → Zone | Read |

- Account Resources: `All accounts`
- Zone Resources: `All zones`
- 创建后**立即复制**，只显示一次
- 这个 Token 是给系统自动化和直接调用 Cloudflare REST API 用的；`wrangler login` 只给 Wrangler CLI 自己用，不能替代这个 Token

---

## 一、首次全新部署

> 图例：🤖 = CLI/脚本可自动  |  🧑 = 必须手动  |  ⚡ = `gh` CLI 可自动（否则手动）

### 步骤 1：安装依赖 🤖

```bash
pnpm install
```

### 步骤 2：登录 Cloudflare 🧑

```bash
npx wrangler login    # 浏览器弹出授权页面，供 Wrangler CLI 自己使用
```

### 步骤 3：运行初始化脚本 🤖

```bash
CF_DEFAULT_ZONE_ID="你的ZoneID" pnpm run init
```

脚本自动完成：
- ✅ 创建 D1 数据库 `mails-db`
- ✅ 从 `wrangler.toml.template` 生成 `wrangler.toml`
- ✅ 初始化数据库表结构（`db/schema.sql`）
- ✅ 生成 JWT_SECRET 并设为 wrangler secret
- ✅ 部署 Worker 到 Cloudflare

> 如果你的 Zone ID 不确定，可以在 CF 控制台 → 你的域名 → 右下角「API」找到。

### 步骤 4：配置 Email Routing 🧑

**当前项目还没有自动做这一步**，所以这里先手动配：

1. 进入 CF 控制台 → 你的域名 → Email → Email Routing
2. 如果还没有启用，点 **Get started** 启用 Email Routing
3. 进入 **Email Workers** 标签页
4. 添加 **Catch-all** 规则，Action 选 **Send to Worker**，Worker 选 `mails-worker`

### 步骤 5：部署前端 🤖

```bash
cd frontend && pnpm build
npx wrangler pages deploy dist --project-name=mails-frontend
```

### 步骤 6：设置 GitHub Secrets（CI/CD 自动部署）⚡

有 `gh` CLI 时可以自动设置：

```bash
# Account ID（从 wrangler whoami 获取）
gh secret set CLOUDFLARE_ACCOUNT_ID --body '你的AccountID' -R 你的用户名/mails

# API Token
gh secret set CLOUDFLARE_API_TOKEN --body '你创建的cfut_xxx' -R 你的用户名/mails

# wrangler.toml 全文（注意用 -Encoding UTF8 避免 BOM）
Get-Content worker/wrangler.toml -Encoding UTF8 -Raw | gh secret set BACKEND_TOML -R 你的用户名/mails
```

没有 `gh` CLI 时，去 GitHub → 仓库 → Settings → Secrets and variables → Actions，手动添加：

| Secret 名称 | 值 |
|-------------|------|
| `CLOUDFLARE_ACCOUNT_ID` | CF 账户 ID |
| `CLOUDFLARE_API_TOKEN` | 上面创建的 API Token |
| `BACKEND_TOML` | `worker/wrangler.toml` 的全部文本内容 |

> ⚠️ **PowerShell 用户注意**：不要用 `echo` 管道设置 Secret，会注入 BOM 字符导致 CF API 报错。用 `--body` 参数或 `-Encoding UTF8`。

### 步骤 7：首次初始化管理员 🧑

打开前端地址（Pages 部署后的 URL），系统检测到管理员未初始化时会自动显示创建管理员表单。

### 步骤 8：绑定 Worker 和 Pages 自定义域名 🧑

登录后进入 **设置** 页面：

1. 在 **Worker API 域名** 里绑定 `mails-api.你的域名`
2. 在 **前端 Pages 域名** 里绑定 `mails.你的域名`

Pages 这一步会自动完成：
- 读取 Pages 项目的真实 `subdomain`
- 创建或修正 `mails` 的 CNAME
- 调用 Pages API 重试验证

如果页面状态已经变成“域名验证（HTTP）已生效，但证书验证还在等待”，先继续等 5 到 10 分钟；这段时间不要重复删建。

### 步骤 9：生成 API Key 🧑

登录后进入 **设置** 页面，点击 **生成新 Key**。这个 Key 是 SDK 调用 `/call/*` 端点的凭证。

### 步骤 10：初始化根域名 🧑

进入 **域名** 页面，填入根域名和 Zone ID，点击 **初始化根域名**。之后就可以创建子域名用于收件了。

### 步骤 11：做一次从 0 验证 🧑

建议按这条顺序检查：

1. 打开 `https://mails.你的域名`，确认前端能访问
2. 打开 `https://mails-api.你的域名/`，确认 Worker 健康检查能访问
3. 在 **域名** 页面创建一个子域名
4. 用 **地址** 页面创建一个真实地址
5. 往这个地址发一封测试邮件，确认能在 **邮件** 页面看到

---

## 二、后续推送（CI/CD 自动部署）

配置好 GitHub Secrets 后，后续推送代码会自动触发部署：

| 触发条件 | Workflow | 动作 |
|---------|----------|------|
| `worker/` 有变更 | Deploy Worker | 自动部署 Worker |
| `frontend/` 有变更 | Deploy Frontend | 自动构建 + 部署 Pages |
| 手动触发 | `gh workflow run` | 两个 workflow 都支持 |

### CI/CD 工作原理

```
推送到 master
  ↓
GitHub Actions 触发
  ↓
安装 pnpm（自动读 package.json 的 packageManager 版本）
  ↓
pnpm install --frozen-lockfile
  ↓
从 BACKEND_TOML Secret 写入 worker/wrangler.toml   ← Worker 专属
  ↓
wrangler deploy / pages deploy
```

> `wrangler.toml` 不在 Git 中（已 `.gitignore`），CI 从 Secret 注入。

---

## 三、API 认证架构

| 路径前缀 | 认证方式 | 用途 | 权限范围 |
|---------|---------|------|---------|
| `/api/*` | Bearer JWT | 前端管理面板 | 完整 CRUD + 设置 |
| `/call/*` | Bearer API Key | SDK / 注册机 | 只创建 + 只读，无删除 |

> `/call/*` 设计原则：Key 泄露不会造成数据丢失。

---

## 四、本地开发

```bash
# 配置
cp worker/wrangler.toml.template worker/wrangler.toml
# 编辑 wrangler.toml 填入实际值

# 启动后端
pnpm --dir worker dev     # http://127.0.0.1:8787

# 启动前端
pnpm --dir frontend dev   # http://localhost:5173（已代理到 Worker）
```

---

## 五、完整步骤速查

```
🧑 创建 CF API Token（带正确权限）
🧑 wrangler login
🤖 pnpm install
🤖 pnpm run init（创建 D1 + 生成配置 + 部署 Worker）
🧑 CF 控制台配置 Email Routing catch-all → Worker
🤖 前端 build + pages deploy
⚡ gh secret set × 3（或手动在 GitHub 网页设置）
🧑 打开前端，创建管理员
🧑 设置页绑定 Worker / Pages 自定义域名
🧑 设置页生成 API Key
🧑 域名页初始化根域名
🧑 创建真实地址并做一次收件测试
```


