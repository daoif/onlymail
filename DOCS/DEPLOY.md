# 部署指南

## 前置条件

以下是所有部署方式都共用的基础前置条件：

| 条件 | 操作方式 | 说明 |
|------|---------|------|
| Cloudflare 账户 | 🧑 手动 | 需要有至少一个域名托管在 CF |
| Node.js >= 20 | 🧑 手动 | 本地开发和 init 脚本需要 |
| pnpm >= 10 | 🧑 手动 | `npm i -g pnpm` |
| Cloudflare API Token | 🧑 手动 | 见下方「创建 API Token」 |

### 创建 Cloudflare API Token

打开 https://dash.cloudflare.com/profile/api-tokens → **Create Token** → **Custom Token**：

| 资源 | 权限 |
|------|------|
| Account → Workers Scripts | Edit |
| Account → D1 | Edit |
| Account → Cloudflare Pages | Edit |
| Zone → DNS | Edit |
| Zone → Zone | Read |

- Account Resources: `All accounts`
- Zone Resources: `All zones`
- 创建后**立即复制**，只显示一次
- 这个 Token 是给系统自动化和直接调用 Cloudflare REST API 用的；`wrangler login` 只给 Wrangler CLI 自己用，不能替代这个 Token

### 额外准备项

- 当前实例按单一 Cloudflare 账号设计。域名相关操作都按域名自动解析 Zone，不支持靠手填 Zone ID 跨账号混用凭证。
- `CF_EMAIL` 和 `CF_GLOBAL_API_KEY` 也按正常可用部署的必填项处理。只给 `CF_API_TOKEN` 和 `CF_ACCOUNT_ID` 虽然能把 Worker / Pages / D1 搭起来，但根域名 bootstrap、子域名创建删除、catch-all 和 Email Routing 规则这些核心自动化都跑不起来。
- 纯本地部署不需要 GitHub 仓库。
- GitHub-only 和混合部署需要 GitHub 仓库。
- 如果你准备走混合部署，装好 `gh` CLI 会省掉手动填写 GitHub Secrets / Variables 的步骤。

### AI 读者的输入规则

正常可用部署默认输入：
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CF_EMAIL`
- `CF_GLOBAL_API_KEY`

按需输入：
- `gh` CLI
  如果 AI 检测到本机有 `gh` 且已经登录，就直接用它写 GitHub Secrets / Variables；没有再提示用户手动去网页设置。

推荐推进方式：
- 一开始就准备 4 个 Cloudflare 值：`CF_API_TOKEN`、`CF_ACCOUNT_ID`、`CF_EMAIL`、`CF_GLOBAL_API_KEY`。
- AI 先检测 `gh` 和这组 Email Routing 凭证；检测到就直接用，缺了就在真正要做 Email Routing 的节点拦住并报清楚。

---

## 本地参数统一配置

本地开发和本地脚本现在统一读项目根目录的 `.env.local`。

先做这一步：

1. 复制 `.env.local.example` 为 `.env.local`
2. 先填 4 个 Cloudflare 必填项：`CF_API_TOKEN`、`CF_ACCOUNT_ID`、`CF_EMAIL`、`CF_GLOBAL_API_KEY`
3. 如果你已经有现成 D1，再填 `D1_DATABASE_ID`
4. 如果你要后面直接写 GitHub 仓库配置，再填 `GITHUB_REPOSITORY`

这几个本地入口都会先读 `.env.local`：

- `pnpm run init`
- `pnpm render:wrangler`
- `pnpm setup:github`
- `pnpm sync:dev-vars`
- `pnpm deploy:worker`
- `pnpm deploy:frontend`

如果 shell 里已经有同名环境变量，shell 的值优先，`.env.local` 不会覆盖它。

`init` 首次跑完后会自动把 `D1_DATABASE_ID` 和 `JWT_SECRET` 回写到 `.env.local`，并顺手生成：

- `worker/wrangler.toml`
- `worker/.dev.vars`

命令边界固定成这三条：

- `pnpm run init`：保留现有 D1，补齐缺的基础设施，然后重新部署 Worker / Frontend。默认入口只认 `workers.dev + pages.dev`，不读取 Cloudflare 上已有的自定义域名残留。
- `pnpm run rebuild`：删除并重建 D1，轮换 `JWT_SECRET`，然后重新跑一遍 `init`。它只处理平台内部状态，不碰 DNS、自定义域名、Email Routing 外部入口。
- `pnpm deploy:worker` / `pnpm deploy:frontend`：单独重发代码，给开发和排障用。

前端管理面板的 API 路径也固定成这条设计：

- 页面可以从 `pages.dev` 或 Pages 自定义域名打开
- 页面里的 API 请求始终打 Worker 默认 `workers.dev`
- Worker 自定义域名只作为 SDK、人工调试和对外展示的别名
- 绑定或移除 Worker 自定义域名，不触发前端 API 路径切换

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

推荐工作方式：
- 日常开发和调试放在本地
- push 到 GitHub 后交给 CI 自动部署到 Cloudflare
- `pnpm deploy:worker`、`pnpm deploy:frontend` 作为本地调试和应急通道保留，不当成主路径

---

## 二、本地部署（无 GitHub）

> 图例：🤖 = CLI/脚本可自动  |  🧑 = 必须手动  |  ⚡ = `gh` CLI 可自动（否则手动）

**开始前请准备好：**

- CF 账号，且至少有一个域名已托管在 Cloudflare
- Node.js >= 20，pnpm >= 10
- Cloudflare API Token
- Cloudflare Account ID
  获取位置：CF 控制台 → 点进任意已托管域名 → 右下角 API 区域
- Cloudflare 账号邮箱 `CF_EMAIL` 和 Global API Key `CF_GLOBAL_API_KEY`
  正常可用部署默认就一起准备好；根域名 bootstrap、子域名创建或删除、catch-all、Email Routing 规则这些核心自动化都依赖这组值
- 以上值已填入项目根目录的 `.env.local`
- 已执行 `npx wrangler login` 完成浏览器授权

不需要 GitHub 账号或仓库。

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
- ✅ 读取 Worker 默认 `workers.dev` 地址并作为管理面板固定 API 入口
- ✅ 首次构建并部署前端

如果还提供了 `GITHUB_REPOSITORY`，并且本机 `gh` 已登录，脚本还会继续：
- ✅ 写 GitHub Secrets / Variables

> 如果你的 Account ID 不确定，可以在 CF 控制台 → 点进任意已托管域名 → 右下角「API」区域找到。
>
> 这里的 `init` 是“第一次接入真实 Cloudflare 环境”的脚本，不是“为了本地把项目跑起来”的前置步骤。
>
> 这里的 `init` 只准备基础设施；Worker / Pages 自定义域名不在这一步处理，留给应用里的设置页。
>
> `init` 可以重跑，用于重新对齐基础设施；默认会复用 `.env.local` 里的 `JWT_SECRET`。Cloudflare 上已有但没写进 D1 的自定义域名、DNS 残留不会被默认接管。

### 步骤 4：如果后面要接 GitHub 自动部署，再写 GitHub Secrets ⚡

有 `gh` CLI 时可以自动设置：

```bash
pnpm setup:github
```

这个脚本会：
- 写入 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`，以及按需写入 `CF_EMAIL`、`CF_GLOBAL_API_KEY` 这些 GitHub Secrets
- 写入 `D1_DATABASE_ID`、`CF_DEFAULT_WORKER_NAME`、`CF_DEFAULT_PAGES_PROJECT` 这些 GitHub Variables
- 如果能从 Cloudflare 读到 Pages 项目默认地址，还会顺手写入 `ALLOWED_ORIGINS`
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
| `D1_DATABASE_ID` | `mails-db` 的 database id |
| `CF_DEFAULT_WORKER_NAME` | Worker 名，默认 `mails-worker` |
| `CF_DEFAULT_PAGES_PROJECT` | Pages 项目名，默认 `mails-frontend` |
| `ALLOWED_ORIGINS` | 可选；默认推荐填当前 Pages 项目的 `pages.dev` 地址、它的预览子域名和 `http://localhost:5173` |

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

进入 **域名** 页面，填入根域名，点击 **初始化根域名**。系统会按域名自动解析 Zone。之后就可以创建子域名用于收件了。

### 步骤 10：做一次从 0 验证 🧑

建议按这条顺序检查：

1. 打开 `https://你的-pages-subdomain.pages.dev`，确认前端能访问
2. 打开 `https://你的-worker.你的-account-subdomain.workers.dev/`，确认 Worker 健康检查能访问
3. 在设置页绑定 `mails-api.你的域名` 和 `mails.你的域名`
4. 在 **域名** 页面创建一个子域名
5. 用 **地址** 页面创建一个真实地址
6. 往这个地址发一封测试邮件，确认能在 **邮件** 页面看到

### 后续重部署

首次 `init` 完成后，你改了代码想重新部署，不需要再跑 `init`，用下面两条命令：

```bash
# 重部署 Worker（改了 worker/ 下的代码后）
pnpm deploy:worker

# 重部署前端（改了 frontend/ 下的代码后）
pnpm deploy:frontend
```

两条命令都会自动读 `.env.local`。`pnpm deploy:frontend` 会自己读取当前 Worker 默认 `workers.dev` 地址，把它写进前端构建结果；Worker 自定义域名不会改变管理面板这条调用路径。

### 平台内部重建

如果版本升级、历史试错或脏数据让平台内部状态已经不可信，用：

```bash
pnpm run rebuild
```

这条命令会：
- 删除并重建 D1
- 轮换 `JWT_SECRET`，让旧后台登录态失效
- 重新跑一遍 `init`

这条命令不会处理：
- DNS 记录
- Worker / Pages 自定义域名
- Email Routing 外部入口配置

---

---

## 三、GitHub-only 部署（无需先拉本地）

**开始前请准备好：**

- CF 账号，且至少有一个域名已托管在 Cloudflare
- GitHub 账号和一个你能控制的仓库
- 仓库已启用 GitHub Actions
- Cloudflare API Token
- Cloudflare Account ID
- `CF_EMAIL` 和 `CF_GLOBAL_API_KEY`
  如果你要让应用后续完成根域名 bootstrap、catch-all 和后续规则操作，这组值应当提前准备好
- 你已经知道要填进 workflow 的 Worker 名和 Pages 项目名，或者准备接受默认值

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
| `CF_EMAIL` | 必需 | 先作为仓库 secret 提供给 workflow；部署后的 Worker 也会把它作为运行时 secret 使用 |
| `CF_GLOBAL_API_KEY` | 必需 | 先作为仓库 secret 提供给 workflow；部署后的 Worker 也会把它作为运行时 secret 使用 |

### 步骤 4：运行首次初始化 workflow 🧑

进入 `Actions -> Bootstrap Cloudflare -> Run workflow`，填：
- `cf_default_worker_name`（不填默认 `mails-worker`）
- `cf_default_pages_project`（不填默认 `mails-frontend`）

这个 workflow 会直接跑仓库里的 `pnpm run init`，自动完成：
- 创建或确认 D1
- 初始化 schema
- 部署 Worker
- 创建或确认 Pages 项目
- 部署前端到 `pages.dev`
- 把后续自动部署要用的 GitHub Variables 写回仓库

这个 workflow 也可以重跑；效果和本地重复运行 `init` 一样，适合重新对齐基础设施。它会保留现有 D1，默认也会复用现有 `JWT_SECRET`。

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

**开始前请准备好：**

- 本地部署那一套前置条件已经准备好，尤其是 `.env.local`
- GitHub 账号和一个你能控制的仓库
- 如果想自动写 GitHub Secrets / Variables，准备好 `gh` CLI 并完成登录
- `.env.local` 里已经有 4 个 Cloudflare 必填项：`CF_API_TOKEN`、`CF_ACCOUNT_ID`、`CF_EMAIL`、`CF_GLOBAL_API_KEY`

这条路径的顺序是：

1. 本地按上面的“本地部署”跑通一次  
2. 在本地执行 `pnpm setup:github`  
3. 把代码 push 到自己的 GitHub 仓库  
4. 后续交给 `Deploy Worker` / `Deploy Frontend`

混合部署推荐的日常工作方式是：本地开发和调试，push 到 GitHub 后由 CI 自动部署到 Cloudflare。本地重部署命令 `pnpm deploy:worker`、`pnpm deploy:frontend` 保留给调试和应急，不当成主路径。

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

先确保 `.env.local` 已填好，然后生成 `worker/.dev.vars` 和 `worker/wrangler.toml`。

```bash
pnpm sync:dev-vars

# 生成 worker/wrangler.toml
pnpm render:wrangler

# 启动后端
pnpm --dir worker dev     # http://127.0.0.1:8787

# 启动前端
pnpm --dir frontend dev   # http://localhost:5173（已代理到 Worker）
```

本地开发分两档：

- 只调本地页面和本地 API：
  只需要 `.env.local` 里的 `JWT_SECRET`，再运行 `pnpm sync:dev-vars` 和 `pnpm render:wrangler`。这时不需要先跑 `init`，也不需要先创建线上 D1。
- 本地还要调 Cloudflare 管理能力：
  再往 `.env.local` 里补 `CF_API_TOKEN`、`CF_ACCOUNT_ID`、`CF_DEFAULT_PAGES_PROJECT`。
- 本地还要调 Email Routing：
  再往 `.env.local` 里补 `CF_EMAIL`、`CF_GLOBAL_API_KEY`。`CF_AUTH_EMAIL` 这个旧名字也兼容。

---

## 九、完整步骤速查

```
🧑 创建 CF API Token（带正确权限）
本地部署：
🧑 复制 .env.local.example 为 .env.local，并填好参数
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

本地重部署：
🤖 pnpm deploy:worker      # 改了 Worker 代码后
🤖 pnpm deploy:frontend    # 改了前端代码后

长期更新：
⚡ push 到自己的 GitHub 仓库，自动部署
⚡ 可选启用 Upstream Sync，自动接收上游 fast-forward 更新
```


