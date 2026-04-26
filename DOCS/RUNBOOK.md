<p align="center">
  <img src="../assets/brand/exports/onlymail-mark-256.png" alt="OnlyMail" width="96" />
</p>

# 完整路径

从零到跑通，这份文档走一条完整路径：

1. 准备环境
2. 本地首次部署
3. 完成应用内配置
4. 做一轮手动验证
5. 接入 SDK
6. 可选：切到 GitHub 自动部署

**如果你只想尽快把项目跑起来，看这份就够了。**

---

## 1. 准备工作

确认以下前置条件已就绪：

- 一个已托管在 Cloudflare 的域名
- Node.js 20+、pnpm 10+
- 已执行 `npx wrangler login` 完成浏览器授权

然后复制 `.env.local.example` 为 `.env.local`，只填这 4 个值：

```env
CF_API_TOKEN=
CF_ACCOUNT_ID=
CF_EMAIL=
CF_GLOBAL_API_KEY=
```

部署模型遵循 **4 + 1** 原则：

- **4 个手动准备**：上述 Cloudflare 凭据
- **1 个自动维护**：`D1_DATABASE_ID`（第一次跑 `init` 后自动回写到 `.env.local`，无需手填）

---

## 2. 本地首次部署

先安装依赖：

```bash
pnpm install
```

然后直接跑：

```bash
pnpm run init
```

这一步会自动完成：

- 创建或复用 D1
- 执行 D1 migration
- 创建或复用 Worker 默认入口
- 创建或复用 Pages 默认入口
- 写回 `D1_DATABASE_ID`
- 生成 `worker/wrangler.toml`
- 生成 `worker/.dev.vars`
- 部署 Worker
- 部署前端

跑完以后，你至少会拿到两个默认入口：

- 前端：`https://<pages-subdomain>.pages.dev`
- 后端：`https://<worker>.<account-subdomain>.workers.dev`

---

## 3. 应用内配置

用 Pages 默认地址打开面板，首次进入会提示创建管理员账号。

登录后台后，按顺序完成以下配置：

1. 在**设置**页生成 API Key
2. （可选但推荐）在**设置**页绑定 Worker 自定义域名
3. （可选但推荐）在**设置**页绑定 Pages 自定义域名
4. 在**域名**页初始化根域名
5. 按需二选一：
   - 直接在**地址**页使用根域名创建地址
   - 如果想按项目隔离，再在**域名**页创建一个长期 managed subdomain（收件子域）；自动化临时子域名会按设置页的轮换总数回收

> **设计边界**：管理面板始终通过 Worker 默认 `workers.dev` 地址调用 API。Worker / Pages 自定义域名只是对外别名，不会改变面板的 API 调用路径。
>
> **收件边界**：根域名初始化完成后，根域名本身就可以直接收件；子域名是隔离和轮换时的扩展选项，不是收件必需步骤。

---

## 4. 手动验证

按以下顺序逐项检查：

1. 打开 `pages.dev` 默认地址 → 确认能进登录页
2. 打开 Worker 默认 `workers.dev` 地址 → 确认健康检查可访问
3. 登录后台
4. 如果已经配置了正式入口，确认设置页能看到已绑定的自定义域名
5. 在**地址**页创建一个真实地址（可直接选根域名；如果走隔离模式，先在**域名**页创建子域名再选它）
6. 给该地址发一封测试邮件
7. 在**邮件**页点击“刷新”并看到这封邮件

7 步全部通过，说明应用主链路已经跑通。

---

## 5. 接入 SDK

### Node.js SDK

安装（从 Release 附件）：

```bash
npm install "https://github.com/<owner>/<repo>/releases/download/v<version>/onlymail-sdk-nodejs-<version>.tgz"
```

跟未发版代码：

```bash
pnpm add "git+https://github.com/<owner>/<repo>.git#<ref>&path:/sdk/nodejs"
```

最小调用：

```ts
import { OnlyMailClient } from '@onlymail/sdk-nodejs'

const client = new OnlyMailClient(
  'https://your-worker.your-account.workers.dev',
  process.env.ONLYMAIL_API_KEY!
)

const domains = await client.listDomains()
const created = await client.createAddress('demo@m1.example.com', 'demo', 24)
const mails = await client.getMailList(created.address.name)
```

### Python SDK

安装（从 Release 附件）：

```bash
python -m pip install "https://github.com/<owner>/<repo>/releases/download/v<version>/onlymail_sdk-<version>-py3-none-any.whl"
```

跟未发版代码：

```bash
python -m pip install "git+https://github.com/<owner>/<repo>.git@<ref>#subdirectory=sdk/python"
```

最小调用：

```python
from onlymail_sdk import OnlyMailClient

client = OnlyMailClient(
    "https://your-worker.your-account.workers.dev",
    api_key="YOUR_API_KEY",
)

domains = client.list_domains()
created = client.create_address("demo@m1.example.com", "demo", ttl_hours=24)
mails = client.get_mail_list(created["address"]["name"])
```

SDK 当前开放的能力（均走 `/call/*`）：

- ✅ 创建地址
- ✅ 查询邮件
- ✅ 轮询等待新邮件
- ✅ 列出域名和创建子域名
- ❌ 不提供删除和后台设置能力（Key 泄露不会导致数据丢失）

---

## 6. 可选：切到 GitHub 自动部署

如果本地已经跑通，想把后续部署交给 GitHub Actions，执行：

```bash
pnpm setup:github
```

它会自动同步以下配置到当前 `origin` 对应的 GitHub 仓库：

- **Secrets**：`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`、`CF_EMAIL`、`CF_GLOBAL_API_KEY`
- **Variable**：`D1_DATABASE_ID`

之后你只需要：

- push 到默认分支 → 自动触发 `CI`、`Deploy Worker`、`Deploy Frontend`
- 或在 Actions 页面手动运行对应 workflow

如果还想自动跟上游版本，在 GitHub 仓库变量里设置：

```text
UPSTREAM_REPOSITORY=daoif/onlymail
```

然后启用 `Upstream Sync` workflow。它会按 fast-forward 方式同步上游代码，并自动触发后续部署。

---

## 日常操作

日常开发常用命令：

```bash
pnpm deploy:worker      # 重部署 Worker
pnpm deploy:frontend    # 重部署前端
pnpm test               # 运行测试
pnpm build              # 构建检查
pnpm check:scripts      # 脚本类型检查
```

如果平台内部状态已不可信（版本升级、脏数据等），用：

```bash
pnpm run rebuild
```

`rebuild` 只重建 D1 并重新部署，不碰 DNS、自定义域名和 Email Routing 外部入口。

> 没接 GitHub 自动同步的实例，后台设置页会自动检查 `daoif/onlymail` 的正式 Release，并在有新版本时显示更新横幅。详见 [UPDATE.md](UPDATE.md)。
