# 部署指南

## 前置条件

以下是所有部署方式共用的基础要求：

| 条件 | 操作方式 | 说明 |
|------|---------|------|
| Cloudflare 账户 | 🧑 手动 | 需要有至少一个域名托管在 CF |
| Node.js >= 24 | 🧑 手动 | 本地开发和 init 脚本需要 |
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
- 创建后**立即复制** Token，只显示一次
- 这个 Token 给系统自动化和 Cloudflare REST API 调用使用；`wrangler login` 只供 Wrangler CLI 自身使用，不能替代这个 Token

### 额外补充

- 当前实例按单一 Cloudflare 账号设计。域名相关操作按域名自动解析 Zone，不支持手填 Zone ID 跨账号混用凭证
- `CF_EMAIL` 和 `CF_GLOBAL_API_KEY` 也是正常可用部署的必填项。如果只提供 `CF_API_TOKEN` 和 `CF_ACCOUNT_ID`，Worker / Pages / D1 能搭起来，但根域名初始化、子域名管理、catch-all 和 Email Routing 规则等核心自动化都无法运行
- 纯本地部署不需要 GitHub 仓库
- GitHub-only 和混合部署需要 GitHub 仓库
- 如果准备走混合部署，提前装好 `gh` CLI 可以省去手动配置 GitHub Secrets / Variables 的步骤

### AI 读者输入规则

正常可用部署的默认输入：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CF_EMAIL`
- `CF_GLOBAL_API_KEY`

按需输入：

- `gh` CLI：如果 AI 检测到本机有 `gh` 且已登录，直接用它写 GitHub Secrets / Variables；否则提示用户手动去网页设置

推荐推进方式：

- 一开始就准备好 4 个 Cloudflare 值
- AI 先检测 `gh` 和 Email Routing 凭据；检测到就直接用，缺少则在真正需要的节点拦住并明确说明

---

## 本地参数统一配置

本地开发和本地脚本统一读取项目根目录的 `.env.local`。

配置模型遵循 **4 + 1** 原则：

- **4 个手动准备**：Cloudflare 凭据 `CF_API_TOKEN`、`CF_ACCOUNT_ID`、`CF_EMAIL`、`CF_GLOBAL_API_KEY`
- **1 个自动维护**：系统内部状态 `D1_DATABASE_ID`

操作步骤：

1. 复制 `.env.local.example` 为 `.env.local`
2. 填入 4 个 Cloudflare 必填项
3. 如果已有现成的 D1 数据库，还可以提前填入 `D1_DATABASE_ID`

以下本地入口都会先读 `.env.local`：

| 命令 | 用途 |
|------|------|
| `pnpm run init` | 初始化并部署全套基础设施 |
| `pnpm render:wrangler` | 生成 `wrangler.toml` |
| `pnpm setup:github` | 同步配置到 GitHub |
| `pnpm sync:dev-vars` | 同步开发环境变量 |
| `pnpm deploy:worker` | 重部署 Worker |
| `pnpm deploy:frontend` | 重部署前端 |

如果 shell 里已有同名环境变量，shell 的值优先，`.env.local` 不会覆盖。

`setup:github` 和 `init` 在需要写 GitHub Secrets / Variables 时，会优先使用 GitHub Actions 自带的仓库上下文；本地运行时则直接从当前 git 的 `origin` 远程仓库推导目标仓库，不再额外要求填写仓库名。

`init` 首次运行完成后，会自动把 `D1_DATABASE_ID` 回写到 `.env.local`，并生成：

- `worker/wrangler.toml`
- `worker/.dev.vars`

这 5 个值在三条部署路径里的落点固定如下：

| 值 | 本地部署 | GitHub-only | 混合部署 |
|------|------|------|------|
| `CF_API_TOKEN` | `.env.local` 手填 | GitHub Secret | 先在 `.env.local` 手填，再用 `setup:github` 写进 GitHub Secret |
| `CF_ACCOUNT_ID` | `.env.local` 手填 | GitHub Secret | 先在 `.env.local` 手填，再用 `setup:github` 写进 GitHub Secret |
| `CF_EMAIL` | `.env.local` 手填 | GitHub Secret | 先在 `.env.local` 手填，再用 `setup:github` 写进 GitHub Secret |
| `CF_GLOBAL_API_KEY` | `.env.local` 手填 | GitHub Secret | 先在 `.env.local` 手填，再用 `setup:github` 写进 GitHub Secret |
| `D1_DATABASE_ID` | `init` / `rebuild` 自动回写到 `.env.local` | `Bootstrap Cloudflare` 自动写回 GitHub Variable | 本地先回写到 `.env.local`，再由 `setup:github` 写进 GitHub Variable |

运行时实际读取规则也固定了：

- 本地命令先读 `.env.local`
- GitHub workflow 先读 GitHub Secrets / Variables
- Worker 运行时只读已经部署进 Cloudflare 的 secrets、`wrangler.toml` 和 D1
- `D1_DATABASE_ID` 不放进 D1；它是数据库指针，必须在读 D1 之前先可用

Worker 历史日志采集也固定在模板里：

- `worker/wrangler.toml.template` 默认开启 `[observability] enabled = true`
- `head_sampling_rate = 1`，确保定时任务、TTL 清理和 D1 自动清理的结构化日志不被采样漏掉
- `pnpm render:wrangler`、`pnpm run init`、`pnpm deploy:worker` 和 GitHub `Deploy Worker` 都会从模板重新生成 `worker/wrangler.toml`
- 排查线上定时任务时，优先查 Cloudflare Workers Logs；`wrangler tail` 只适合实时观察，不保存历史日志

命令边界固定为以下三条：

| 命令 | 行为 |
|------|------|
| `pnpm run init` | 保留现有 D1，补齐缺失的基础设施，然后重新部署 Worker / Frontend。默认入口只认 `workers.dev` + `pages.dev`，不读取 Cloudflare 上已有的自定义域名残留 |
| `pnpm run rebuild` | 删除并重建 D1，然后重跑 `init`。只处理平台内部状态，不碰 DNS、自定义域名、Email Routing 外部入口 |
| `pnpm deploy:worker` / `pnpm deploy:frontend` | 单独重发代码，给开发和排障用 |

前端管理面板的 API 路径设计：

- 页面可以从 `pages.dev` 或 Pages 自定义域名打开
- 页面里的 API 请求始终打 Worker 默认 `workers.dev`
- Worker 自定义域名只作为 SDK、人工调试和对外展示的别名
- 绑定或移除 Worker 自定义域名，不会触发前端 API 路径切换

---

## 收件域名的两种模式

- **根域名直收**：在应用内完成根域名 bootstrap 后，就可以直接创建 `abc@root.com` 这样的地址。
- **managed subdomain（托管子域）**：如果要按项目 / 批次 / 租户隔离，再额外创建 `m1.root.com`、`m1.m1.root.com` 这类显式子域。长期子域名不会被轮换删除；临时子域名达到设置页轮换总数后，只回收当前 root 下最旧的临时项。

两种模式都依赖同一个前置条件：**根域名已在 Cloudflare 托管，并已在 OnlyMail 中完成 bootstrap。**

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
- 需要频繁修改代码和调试，但上线后想省事

特点：
- 首次用本地 `init` 跑通
- 再用 `setup:github` 把当前 `origin` 仓库配置写进 GitHub
- 后续 push 到 GitHub 自动部署

推荐日常工作方式：
- 日常开发和调试在本地进行
- push 到 GitHub 后交给 CI 自动部署到 Cloudflare
- `pnpm deploy:worker`、`pnpm deploy:frontend` 保留为本地调试和应急通道，不作为主路径

---

## 二、本地部署（无 GitHub）

> 图例：🤖 = CLI/脚本可自动  |  🧑 = 必须手动  |  ⚡ = `gh` CLI 可自动（否则手动）

**开始前请准备好：**

- Cloudflare 账号，且至少有一个域名已托管
- Node.js >= 24、pnpm >= 10
- Cloudflare API Token 和 Account ID（获取位置：CF 控制台 → 任意已托管域名 → 右下角 API 区域）
- `CF_EMAIL` 和 `CF_GLOBAL_API_KEY`（根域名初始化、子域名管理、catch-all、Email Routing 等核心自动化均依赖这组值）
- 以上值已填入 `.env.local`
- 已执行 `npx wrangler login` 完成浏览器授权

> 本地部署不需要 GitHub 账号或仓库。

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

脚本会自动完成：

- ✅ 创建 D1 数据库 `onlymail-db`
- ✅ 创建或确认 Pages 项目，读取默认 `pages.dev` 地址并同步到 D1
- ✅ 从模板生成 `wrangler.toml`
- ✅ 执行 D1 migration（`worker/db/migrations/`）
- ✅ 部署 Worker，读取默认 `workers.dev` 地址作为管理面板固定 API 入口
- ✅ 首次构建并部署前端

如果当前仓库 `origin` 已指向 GitHub 且本机 `gh` 已登录，还会自动写入 GitHub Secrets / Variables。

> **提示**：`init` 是“接入真实 Cloudflare 环境”的脚本，不是本地开发的前置步骤。它只准备基础设施，自定义域名留给应用设置页处理。`init` 可以安全重跑以重新对齐基础设施；Cloudflare 上已有但未写进 D1 的残留不会被自动接管。

### 步骤 4：如果后面要接 GitHub 自动部署，再写 GitHub Secrets ⚡

有 `gh` CLI 时可以自动设置：

```bash
pnpm setup:github
```

该脚本会：

- 写入 GitHub Secrets：`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`、`CF_EMAIL`、`CF_GLOBAL_API_KEY`
- 写入 GitHub Variable：`D1_DATABASE_ID`
- 缺少关键值时直接报错，不会写入不完整的配置
- 本地运行时以当前 git `origin` 为目标仓库，无需手动填写仓库名

没有 `gh` CLI 时，去 GitHub → 仓库 → Settings → Secrets and variables → Actions，手动添加：

Secrets：

| 名称 | 值 |
|------|------|
| `CLOUDFLARE_ACCOUNT_ID` | CF 账户 ID |
| `CLOUDFLARE_API_TOKEN` | 上面创建的 API Token |
| `CF_EMAIL` | Cloudflare 账号邮箱 |
| `CF_GLOBAL_API_KEY` | Cloudflare Global API Key |

Variables：

| 名称 | 值 |
|------|------|
| `D1_DATABASE_ID` | `onlymail-db` 的 database id |

> `worker/wrangler.toml` 不需要上传到 GitHub，也不需要再作为整文件 Secret 保存。CI 会按模板自动生成。

### 步骤 5：初始化管理员 🧑

打开 Pages 默认地址（`https://你的-pages-subdomain.pages.dev`），首次访问时系统会自动显示管理员创建表单。

### 步骤 6：确认默认入口可用 🧑

打开浏览器确认：
- `https://你的-pages-subdomain.pages.dev` 已经能进入登录页
- `https://你的-worker.你的-account-subdomain.workers.dev/` 已经能返回 Worker 健康检查

### 步骤 7：在设置页绑定正式入口（可选但推荐）🧑

登录后进入 **设置** 页面：
- 绑定 Worker API 自定义域名，例如 `onlymail-api.你的域名`
- 绑定 Pages 自定义域名，例如 `onlymail.你的域名`

Pages 自定义域名绑定时，系统会自动将 CNAME 对齐到 Pages 项目的真实 `subdomain` 并重试验证。如果状态显示“HTTP 已生效、证书验证等待中”，通常等待 5~10 分钟即可。

### 步骤 8：生成 API Key 🧑

登录后进入 **设置** 页面，点击 **生成新 Key**。这个 Key 是 SDK 调用 `/call/*` 端点的凭证。

### 步骤 9：初始化根域名 🧑

进入 **域名** 页面，填入根域名，点击 **初始化根域名**。系统会按域名自动解析 Zone，并把根域名 catch-all 指到 Worker。

初始化完成后有两种收件方式：

- 直接使用根域名收件：创建 `abc@根域名`
- 额外创建 managed subdomain：例如 `abc@m1.根域名`，适合按项目隔离

### 步骤 10：做一次从 0 验证 🧑

建议按这条顺序检查：

1. 打开 `https://你的-pages-subdomain.pages.dev`，确认前端能访问
2. 打开 `https://你的-worker.你的-account-subdomain.workers.dev/`，确认 Worker 健康检查能访问
3. 如需正式 Web 入口，在设置页绑定 `onlymail-api.你的域名` 和 `onlymail.你的域名`
4. 在 **域名** 页面初始化根域名；如需隔离，再额外创建一个 managed subdomain
5. 用 **地址** 页面创建一个真实地址
6. 往这个地址发一封测试邮件，确认能在 **邮件** 页面看到

### 后续重部署

首次 `init` 完成后，修改代码只需重新部署对应模块，无需再跑 `init`：

```bash
pnpm deploy:worker      # 重部署 Worker（修改了 worker/ 后）
pnpm deploy:frontend    # 重部署前端（修改了 frontend/ 后）
```

两条命令都会自动读取 `.env.local`。`deploy:frontend` 会自动获取 Worker 默认 `workers.dev` 地址并写入前端构建结果；Worker 自定义域名不影响管理面板的 API 调用路径。

### 平台内部重建

如果版本升级、历史试错或脏数据导致平台内部状态不可信，使用：

```bash
pnpm run rebuild
```

`rebuild` 会删除并重建 D1，然后重跑 `init`。它**不会**处理 DNS 记录、Worker / Pages 自定义域名和 Email Routing 外部入口。

---

## 三、GitHub-only 部署（无需先拉本地）

**开始前请准备好：**

- CF 账号，且至少有一个域名已托管在 Cloudflare
- GitHub 账号和一个你能控制的仓库
- 仓库已启用 GitHub Actions
- Cloudflare API Token
- Cloudflare Account ID
- `CF_EMAIL` 和 `CF_GLOBAL_API_KEY`（根域名初始化、catch-all 和 Email Routing 规则等核心功能依赖这组值，建议提前准备）

### 步骤 1：准备自己的仓库 🧑

两种方式均可：

- Fork 本仓库
- 新建自己的仓库，将源码同步进去

> 如果后续想自动接收上游更新，推荐使用 fork。

### 步骤 2：启用 GitHub Actions 🧑

进入仓库的 `Actions` 页面，确认以下 workflow 可用：
- `Bootstrap Cloudflare`
- `Deploy Worker`
- `Deploy Frontend`

如果使用 fork，还可以一并启用：
- `Upstream Sync`（自动接收上游更新）

### 步骤 3：配置 GitHub Secrets 🧑

进入仓库：
`Settings -> Secrets and variables -> Actions`

添加以下 Repository secrets：

| 名称 | 是否必需 | 说明 |
|------|----------|------|
| `CLOUDFLARE_ACCOUNT_ID` | 必需 | Cloudflare Account ID |
| `CLOUDFLARE_API_TOKEN` | 必需 | Cloudflare API Token |
| `CF_EMAIL` | 必需 | 先作为仓库 secret 提供给 workflow；部署后的 Worker 也会把它作为运行时 secret 使用 |
| `CF_GLOBAL_API_KEY` | 必需 | 先作为仓库 secret 提供给 workflow；部署后的 Worker 也会把它作为运行时 secret 使用 |

### 步骤 4：运行首次初始化 workflow 🧑

进入 `Actions -> Bootstrap Cloudflare -> Run workflow`，直接运行即可。

该 workflow 执行 `pnpm run init`，自动完成：

- 创建或确认 D1 并执行 migration
- 部署 Worker 和 Pages
- 将 `D1_DATABASE_ID` 写回仓库 Variable

此 workflow 可以安全重跑，效果等同于本地重复执行 `init`，适合重新对齐基础设施。

### 步骤 5：初始化管理员 🧑

打开 workflow 输出里对应的 Pages 默认地址，进入登录页，完成管理员初始化。

### 步骤 6：在应用内完成正式入口与收件域配置 🧑

登录后进入应用：

- （可选但推荐）在设置页绑定 Worker API 自定义域名
- （可选但推荐）在设置页绑定 Pages 自定义域名
- 在域名页初始化根域名
- 按需选择：直接使用根域名收件，或额外创建 managed subdomain 做隔离

### 步骤 7：后续更新 🤖

之后你只需要：

- push 到自己的仓库 → 自动部署 Worker / Pages
- 或在 Actions 页面手动运行 `Deploy Worker` / `Deploy Frontend`

这只代表“线上服务已更新”，不等于“项目已发正式版本”。如果这次变更要让其他实例收到更新提醒，或要提供 SDK 安装附件，还需要创建 GitHub Release；发布 Release 后 `Release SDK Assets` workflow 会自动挂载 SDK 附件。

如果使用 fork 并想接收上游更新：

- 设置仓库变量 `UPSTREAM_REPOSITORY=上游owner/repo`
- 启用 `Upstream Sync`

`Upstream Sync` 只做 fast-forward 同步。如果默认分支已有分叉提交，workflow 会停下来等你手动处理，不会自动 merge。

> 不配 `Upstream Sync` 也没问题——系统不会自动拉代码，但会在后台设置页提醒管理员“有新的正式 Release 可以更新”。更新提醒和自动部署是两条独立能力，详见 [UPDATE.md](UPDATE.md)。

---

## 四、混合部署（先本地，后 GitHub）

**开始前请准备好：**

- 本地部署的全部前置条件（尤其是 `.env.local` 已填好 4 个 Cloudflare 必填项）
- GitHub 账号和一个你能控制的仓库
- 如果想自动写 GitHub 配置，提前装好 `gh` CLI 并完成登录

按以下顺序操作：

1. 先按上面的“本地部署”跑通一次
2. 执行 `pnpm setup:github`
3. 把代码 push 到自己的 GitHub 仓库
4. 后续交给 `Deploy Worker` / `Deploy Frontend` 自动部署

> `setup:github` 默认以当前 git `origin` 为目标仓库。

推荐日常工作方式：本地开发和调试，push 后由 CI 自动部署。`pnpm deploy:worker`、`pnpm deploy:frontend` 保留为调试和应急通道。

---

## 五、后续推送（CI/CD 自动部署）

配置好 GitHub Secrets 后，推送到默认分支会自动触发检查，并按变更路径触发部署：

| 触发条件 | Workflow | 动作 |
|---------|----------|------|
| 任意默认分支 push | CI | 测试、构建、脚本检查和 SDK 产物校验 |
| `worker/` 有变更 | Deploy Worker | 自动部署 Worker |
| `frontend/` 有变更 | Deploy Frontend | 自动构建并部署 Pages |
| 手动触发 | `gh workflow run` | 两个 workflow 均支持 |

### CI/CD 流程

```
推送到默认分支
  ↓
GitHub Actions 触发
  ↓
安装 pnpm（自动读取 package.json 中的 packageManager 版本）
  ↓
pnpm install --frozen-lockfile
  ↓
按模板 + Secrets/Variables 生成 worker/wrangler.toml（Worker 专属）
  ↓
wrangler deploy / pages deploy
```

> `wrangler.toml` 不提交 Git（已 `.gitignore`），本地和 CI 均现场生成。

### 推送和 Release 的边界

- push 到默认分支：负责让当前仓库对应的 Cloudflare Worker / Pages 更新
- GitHub Release：负责形成正式版本、更新提醒来源和 SDK 附件
- `Release SDK Assets`：只在 Release published 后上传 SDK 附件，不创建 Release，也不部署 Cloudflare

也就是说，GitHub-only / 混合部署里的“后续推送”已经能更新你自己的服务；如果你是维护者并准备对外发版，还要继续执行 [`RELEASING.md`](RELEASING.md)。

特别注意：如果这次推送已经包含 `pnpm set:version` 生成的版本号变更，或者改动了 `shared/app-release.ts` / `package.json` 的版本号，就不能只等部署 workflow 成功。必须继续创建同版本 GitHub Release，并按 [`RELEASING.md`](RELEASING.md) 的发布后验收确认最新 Release、SDK 附件和代码版本一致。

---

## 六、自动接收上游更新

### 适用前提

这条线主要面向 fork 用户。

为获得最佳体验，建议：

- 默认分支保持干净，不堆积长期私有改动
- 实验性改动放在其他分支

### 配置方式

1. 在 GitHub 仓库变量中设置 `UPSTREAM_REPOSITORY=上游owner/repo`
2. 启用 `Upstream Sync` workflow
3. 等待定时运行，或手动触发一次

### 同步边界

`Upstream Sync` 只接受 fast-forward 更新：

- 默认分支与上游同线 → 自动同步
- 默认分支已有分叉提交 → 停下来等你手动处理

同步成功后，workflow 会显式触发 `CI`，并根据实际变更决定是否触发 `Deploy Worker` / `Deploy Frontend`。这是有意为之——避免 `GITHUB_TOKEN` push 不触发下游 workflow 的问题，也避免自动 merge 打乱用户仓库历史。

> 不启用 `Upstream Sync` 的实例不会自动更新代码，但后台设置页会检查 `daoif/onlymail` 的正式 Release 并提示管理员手动更新。

---

## 七、API 认证架构

| 路径前缀 | 认证方式 | 用途 | 权限范围 |
|---------|---------|------|---------|
| `/api/*` | Bearer 管理员会话 token | 前端管理面板 | 完整 CRUD + 设置 |
| `/call/*` | Bearer API Key | SDK / 外部调用 | 只创建 + 只读，无删除 |

> `/call/*` 设计原则：即使 Key 泄露也不会造成数据丢失。

---

## 八、本地开发

确保 `.env.local` 已填好，然后生成本地开发配置并启动服务：

```bash
pnpm sync:dev-vars          # 同步开发环境变量
pnpm render:wrangler        # 生成 worker/wrangler.toml
pnpm --dir worker dev       # 启动后端（http://127.0.0.1:8787）
pnpm --dir frontend dev     # 启动前端（http://localhost:5173，已代理到 Worker）
```

本地开发按需分档：

| 场景 | 需要的配置 |
|------|----------|
| 只调本地页面和 API | 运行 `sync:dev-vars` + `render:wrangler` 即可，不需要先跑 `init` |
| 还要调 Cloudflare 管理能力 | `.env.local` 中补充 `CF_API_TOKEN`、`CF_ACCOUNT_ID` |
| 还要调 Email Routing | `.env.local` 中补充 `CF_EMAIL`、`CF_GLOBAL_API_KEY`（旧名 `CF_AUTH_EMAIL` 也兼容） |

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
🧑（可选）在设置页绑定 Worker / Pages 自定义域名
🧑 在域名页初始化根域名
🧑 按需：直接用根域名收件，或创建 managed subdomain

GitHub-only 部署：
🧑 配 GitHub Secrets
🧑 运行 Bootstrap Cloudflare
🧑 打开 Pages 默认地址，创建管理员
🧑（可选）在设置页绑定 Worker / Pages 自定义域名
🧑 在域名页初始化根域名
🧑 按需：直接用根域名收件，或创建 managed subdomain

本地重部署：
🤖 pnpm deploy:worker      # 改了 Worker 代码后
🤖 pnpm deploy:frontend    # 改了前端代码后

长期更新：
⚡ push 到自己的 GitHub 仓库，自动部署
⚡ 可选启用 Upstream Sync，自动接收上游 fast-forward 更新
⚡ 正式发版另走 GitHub Release，Release SDK Assets 只负责上传 SDK 附件
```


