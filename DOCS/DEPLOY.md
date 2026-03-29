# 部署指南

## 前置条件

以下是部署前**最低要准备**的内容：

| 条件 | 操作方式 | 说明 |
|------|---------|------|
| Cloudflare 账户 | 🧑 手动 | 需要有至少一个域名托管在 CF |
| Node.js >= 20 | 🧑 手动 | 本地开发和 init 脚本需要 |
| pnpm >= 10 | 🧑 手动 | `npm i -g pnpm` |
| GitHub 仓库 | 🧑 手动 | 私有或公开都可以 |
| Cloudflare API Token | 🧑 手动 | 见下方「创建 API Token」 |
| `gh` CLI（可选） | 🧑 手动 | 装了以后，AI 可以直接写 GitHub Secrets / Variables |
| Cloudflare Global API Key + Email（可选） | 🧑 手动 | 装了以后，AI 可以直接处理 Email Routing 的启用、关闭、清理和排查 |

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

### AI 读者的输入规则

最低输入：
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CF_DEFAULT_ZONE_ID`

到了 Worker 持续部署这一步，还需要：
- `D1_DATABASE_ID`

可选输入：
- `CF_GLOBAL_API_KEY` + `CF_EMAIL`
  到了 Email Routing、批量清理或高级排查这一步时，如果给了这组值，AI 可以直接继续；没给时，再提示用户补或者改走控制台。
- `gh` CLI
  如果 AI 检测到本机有 `gh` 且已经登录，就直接用它写 GitHub Secrets / Variables；没有再提示用户手动去网页设置。

推荐推进方式：
- 一开始只要求最低输入。
- AI 先检测 `gh`、`CF_GLOBAL_API_KEY`、`CF_EMAIL` 是否存在。
- 检测到就直接用，没检测到再在真正卡住的节点提示，不在开头一次性抛一长串要求。

---

## 一、先选部署方式

### 方式 A：本地部署

适合：
- 先调试再上线
- 不想接 GitHub Actions
- 需要本地直接排查 Cloudflare 现场

特点：
- 首次初始化用本地 `pnpm run init`
- GitHub 不是必需项
- 后续可以一直本地部署

### 方式 B：GitHub-only 部署

适合：
- 不想先拉到本地
- 想让首次初始化也在 GitHub 上完成
- 后续直接用 push 或 workflow 触发自动部署

特点：
- 首次初始化用 `Bootstrap Cloudflare` workflow
- 需要先在 GitHub 仓库里配置 Cloudflare secrets
- 后续可以启用 `Upstream Sync` 自动同步上游更新

### 方式 C：混合部署

适合：
- 先本地调通，再切到 GitHub 自动部署
- 需要频繁改代码和调试，但上线后想省事

特点：
- 第一次用本地 `init`
- 再用 `setup:github` 把仓库配置写进去
- 后续 push 到 GitHub 自动部署

---

## 二、本地部署（无 GitHub）

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
CF_DEFAULT_ZONE_ID="你的ZoneID" \
CF_ACCOUNT_ID="你的AccountID" \
CF_API_TOKEN="你的cfut_xxx" \
pnpm run init
```

脚本自动完成：
- ✅ 创建 D1 数据库 `mails-db`
- ✅ 创建或确认 Pages 项目
- ✅ 读取 Pages 默认 `pages.dev` 地址并写入默认前端来源
- ✅ 从 `wrangler.toml.template` 生成 `wrangler.toml`
- ✅ 初始化数据库表结构（`db/schema.sql`）
- ✅ 生成 JWT_SECRET 并设为 wrangler secret
- ✅ 部署 Worker 到 Cloudflare
- ✅ 读取 Worker 默认 `workers.dev` 地址并作为前端 API Base URL
- ✅ 首次构建并部署前端

如果还提供了 `CF_EMAIL` + `CF_GLOBAL_API_KEY`，脚本还会继续：
- ✅ 启用 Email Routing
- ✅ 把 catch-all 指到 `mails-worker`

如果还提供了 `GITHUB_REPOSITORY`，并且本机 `gh` 已登录，脚本还会继续：
- ✅ 写 GitHub Secrets / Variables

> 如果你的 Zone ID 不确定，可以在 CF 控制台 → 你的域名 → 右下角「API」找到。
>
> 这里的 `init` 是“第一次接入真实 Cloudflare 环境”的脚本，不是“为了本地把项目跑起来”的前置步骤。
>
> 这里的 `init` 只准备基础设施；Worker / Pages 自定义域名不在这一步处理，留给应用里的设置页。
>
> `init` 可以重跑，用于重新对齐基础设施；但会刷新 `JWT_SECRET`，现有后台登录态会失效。

### 步骤 4：设置 GitHub Secrets（CI/CD 自动部署）⚡

有 `gh` CLI 时可以自动设置：

```bash
GITHUB_REPOSITORY='你的用户名/mails' \
CLOUDFLARE_ACCOUNT_ID='你的AccountID' \
CLOUDFLARE_API_TOKEN='你创建的cfut_xxx' \
CF_DEFAULT_ZONE_ID='你的ZoneID' \
D1_DATABASE_ID='你的database_id' \
CF_DEFAULT_WORKER_NAME='mails-worker' \
CF_DEFAULT_PAGES_PROJECT='mails-frontend' \
pnpm setup:github
```

这个脚本会：
- 写入 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN` 两个 GitHub Secrets
- 写入 `CF_DEFAULT_ZONE_ID`、`D1_DATABASE_ID`、`CF_DEFAULT_WORKER_NAME`、`CF_DEFAULT_PAGES_PROJECT` 这些 GitHub Variables
- 如果能从 Cloudflare 读到 Pages 项目和 Worker 默认地址，还会顺手写入 `ALLOWED_ORIGINS` 和 `VITE_API_BASE_URL`
- 自动跳过没提供的可选项

没有 `gh` CLI 时，去 GitHub → 仓库 → Settings → Secrets and variables → Actions，手动添加：

Secrets：

| 名称 | 值 |
|------|------|
| `CLOUDFLARE_ACCOUNT_ID` | CF 账户 ID |
| `CLOUDFLARE_API_TOKEN` | 上面创建的 API Token |

Variables：

| 名称 | 值 |
|------|------|
| `CF_DEFAULT_ZONE_ID` | Zone ID |
| `D1_DATABASE_ID` | `mails-db` 的 database id |
| `CF_DEFAULT_WORKER_NAME` | Worker 名，默认 `mails-worker` |
| `CF_DEFAULT_PAGES_PROJECT` | Pages 项目名，默认 `mails-frontend` |
| `ALLOWED_ORIGINS` | 可选；默认推荐填当前 Pages 项目的 `pages.dev` 地址、它的预览子域名和 `http://localhost:5173` |
| `VITE_API_BASE_URL` | 前端请求后端的基础地址，推荐填当前 Worker 的 `workers.dev` 地址 |

> `worker/wrangler.toml` 不需要上传到 GitHub，也不需要再作为整文件 Secret 保存。CI 会按模板自动生成。

### 步骤 5：首次初始化管理员 🧑

打开 Pages 默认地址（`https://你的-pages-subdomain.pages.dev`），系统检测到管理员未初始化时会自动显示创建管理员表单。

### 步骤 6：确认默认入口可用 🧑

打开浏览器确认：
- `https://你的-pages-subdomain.pages.dev` 已经能进入登录页
- `https://你的-worker.你的-account-subdomain.workers.dev/` 已经能返回 Worker 健康检查

### 步骤 7：在设置页绑定正式入口 🧑

登录后进入 **设置** 页面：
- 绑定 Worker API 自定义域名，例如 `mails-api.你的域名`
- 绑定 Pages 自定义域名，例如 `mails.你的域名`

Pages 自定义域名这一步会自动把 CNAME 对齐到 Pages 项目的真实 `subdomain`，然后重试验证。  
如果状态显示“HTTP 已生效、证书验证等待中”，继续等 5 到 10 分钟。

### 步骤 8：生成 API Key 🧑

登录后进入 **设置** 页面，点击 **生成新 Key**。这个 Key 是 SDK 调用 `/call/*` 端点的凭证。

### 步骤 9：初始化根域名 🧑

进入 **域名** 页面，填入根域名和 Zone ID，点击 **初始化根域名**。之后就可以创建子域名用于收件了。

### 步骤 10：做一次从 0 验证 🧑

建议按这条顺序检查：

1. 打开 `https://你的-pages-subdomain.pages.dev`，确认前端能访问
2. 打开 `https://你的-worker.你的-account-subdomain.workers.dev/`，确认 Worker 健康检查能访问
3. 在设置页绑定 `mails-api.你的域名` 和 `mails.你的域名`
4. 在 **域名** 页面创建一个子域名
5. 用 **地址** 页面创建一个真实地址
6. 往这个地址发一封测试邮件，确认能在 **邮件** 页面看到

---

---

## 三、GitHub-only 部署（无需先拉本地）

### 步骤 1：准备自己的仓库 🧑

有两种都可以：
- fork 本仓库
- 新建一个自己的仓库，再把当前代码放进去

如果你后面想自动接收上游更新，fork 更顺手。

### 步骤 2：启用 GitHub Actions 🧑

进入仓库的 `Actions` 页面，确认以下 workflow 可用：
- `Bootstrap Cloudflare`
- `Deploy Worker`
- `Deploy Frontend`

如果你用的是 fork，还可以顺手启用：
- `Upstream Sync`

### 步骤 3：配置 GitHub Secrets 🧑

进入仓库：
`Settings -> Secrets and variables -> Actions`

先加这些 `Repository secrets`：

| 名称 | 是否必需 | 说明 |
|------|----------|------|
| `CLOUDFLARE_ACCOUNT_ID` | 必需 | Cloudflare Account ID |
| `CLOUDFLARE_API_TOKEN` | 必需 | Cloudflare API Token |
| `CF_EMAIL` | 可选 | 给 Email Routing 自动化用 |
| `CF_GLOBAL_API_KEY` | 可选 | 给 Email Routing 自动化用 |

### 步骤 4：运行首次初始化 workflow 🧑

进入 `Actions -> Bootstrap Cloudflare -> Run workflow`，填：
- `cf_default_zone_id`
- `cf_default_worker_name`（不填默认 `mails-worker`）
- `cf_default_pages_project`（不填默认 `mails-frontend`）

这个 workflow 会直接跑仓库里的 `pnpm run init`，自动完成：
- 创建或确认 D1
- 初始化 schema
- 部署 Worker
- 创建或确认 Pages 项目
- 部署前端到 `pages.dev`
- 可选启用 Email Routing
- 把后续自动部署要用的 GitHub Variables 写回仓库

这个 workflow 也可以重跑；效果和本地重复运行 `init` 一样，适合重新对齐基础设施，但会刷新 `JWT_SECRET`。

### 步骤 5：初始化管理员 🧑

打开 workflow 输出里对应的 Pages 默认地址，进入登录页，完成管理员初始化。

### 步骤 6：在应用内绑定正式域名 🧑

登录后进入设置页：
- 绑定 Worker API 自定义域名
- 绑定 Pages 自定义域名

### 步骤 7：后续更新 🤖

后面你只需要：
- push 到自己的仓库，自动部署 Worker / Pages
- 或手动运行 `Deploy Worker` / `Deploy Frontend`

如果是 fork，并且你想接收上游更新：
- 设置仓库变量 `UPSTREAM_REPOSITORY=上游owner/repo`
- 启用 `Upstream Sync`

`Upstream Sync` 只做 fast-forward 同步。  
如果你的默认分支已经有自己的提交，workflow 会停下来，不会替你自动 merge。

---

## 四、混合部署（先本地，后 GitHub）

这条路径的顺序是：

1. 本地按上面的“本地部署”跑通一次  
2. 在本地执行 `pnpm setup:github`  
3. 把代码 push 到自己的 GitHub 仓库  
4. 后续交给 `Deploy Worker` / `Deploy Frontend`

混合部署的意义只有一个：  
第一次调试和排错更顺手，后面上线和更新更省事。

---

## 五、后续推送（CI/CD 自动部署）

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
按模板和 Secrets / Variables 生成 worker/wrangler.toml   ← Worker 专属
  ↓
wrangler deploy / pages deploy
```

> `wrangler.toml` 不在 Git 中（已 `.gitignore`），本地和 CI 都现场生成。

---

## 六、自动接收上游更新

### 适用前提

这条线主要给 fork 用户。

你的仓库如果满足这两条，体验会最好：
- 默认分支尽量保持干净，不直接堆自己的长期改动
- 你自己的实验性改动放在别的分支

### 配置方式

1. 在 GitHub 仓库变量里设置：
   `UPSTREAM_REPOSITORY=上游owner/repo`
2. 启用 `Upstream Sync`
3. 等它定时运行，或者手动点一次

### 边界

`Upstream Sync` 只接受 fast-forward 更新。  
这意味着：
- 你的默认分支如果还和上游一条线，就能自动跟上
- 你的默认分支如果已经有分叉提交，就会停下来，等你手动处理

这是故意这样设计的，避免自动 merge 把用户自己的仓库历史揉乱。

---

## 七、API 认证架构

| 路径前缀 | 认证方式 | 用途 | 权限范围 |
|---------|---------|------|---------|
| `/api/*` | Bearer JWT | 前端管理面板 | 完整 CRUD + 设置 |
| `/call/*` | Bearer API Key | SDK / 注册机 | 只创建 + 只读，无删除 |

> `/call/*` 设计原则：Key 泄露不会造成数据丢失。

---

## 八、本地开发

先复制 `worker/.dev.vars.example` 为 `worker/.dev.vars`，至少填好 `JWT_SECRET`。

```bash
# 配置
CF_DEFAULT_ZONE_ID="你的ZoneID" \
CF_ACCOUNT_ID="你的AccountID" \
D1_DATABASE_ID="你的database_id" \
pnpm render:wrangler

# 启动后端
pnpm --dir worker dev     # http://127.0.0.1:8787

# 启动前端
pnpm --dir frontend dev   # http://localhost:5173（已代理到 Worker）
```

本地开发分两档：

- 只调本地页面和本地 API：
  只需要 `worker/wrangler.toml` + `worker/.dev.vars` 里的 `JWT_SECRET`。这时不需要先跑 `init`，也不需要先创建线上 D1。
- 本地还要调 Cloudflare 管理能力：
  再补 `CF_API_TOKEN`、`CF_ACCOUNT_ID`、`CF_DEFAULT_ZONE_ID`、`CF_DEFAULT_PAGES_PROJECT`。
- 本地还要调 Email Routing：
  再补 `CF_EMAIL`、`CF_GLOBAL_API_KEY`。`CF_AUTH_EMAIL` 这个旧名字也兼容。

---

## 九、完整步骤速查

```
🧑 创建 CF API Token（带正确权限）
本地部署：
🧑 wrangler login
🤖 pnpm install
🤖 pnpm run init
🧑 打开 Pages 默认地址，创建管理员
🧑 在设置页绑定 Worker / Pages 自定义域名

GitHub-only 部署：
🧑 配 GitHub Secrets
🧑 运行 Bootstrap Cloudflare
🧑 打开 Pages 默认地址，创建管理员
🧑 在设置页绑定 Worker / Pages 自定义域名

长期更新：
⚡ push 到自己的 GitHub 仓库，自动部署
⚡ 可选启用 Upstream Sync，自动接收上游 fast-forward 更新
```


