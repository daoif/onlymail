# 完整路径

这份文档只走一条推荐路径：

1. 准备环境
2. 本地首次部署
3. 完成应用内配置
4. 做一轮手动验证
5. 接入 SDK
6. 可选切到 GitHub 自动部署

如果你只想把项目跑起来，看这份就够了。

---

## 1. 先准备好

先确认这些东西已经有了：

- 一个已托管在 Cloudflare 的域名
- Node.js 20+
- pnpm 10+
- 已执行 `npx wrangler login`

然后复制 `.env.local.example` 为 `.env.local`，只填这 4 个值：

```env
CF_API_TOKEN=
CF_ACCOUNT_ID=
CF_EMAIL=
CF_GLOBAL_API_KEY=
```

这里的模型固定成 `4 + 2`：

- 手动准备 4 个 Cloudflare 凭据
- 系统自动维护 2 个内部状态：`D1_DATABASE_ID`、`JWT_SECRET`

`D1_DATABASE_ID` 和 `JWT_SECRET` 不用手填。第一次跑 `init` 后会自动回写到 `.env.local`。

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
- 写回 `D1_DATABASE_ID` 和 `JWT_SECRET`
- 生成 `worker/wrangler.toml`
- 生成 `worker/.dev.vars`
- 部署 Worker
- 部署前端

跑完以后，你至少会拿到两个默认入口：

- 前端：`https://<pages-subdomain>.pages.dev`
- 后端：`https://<worker>.<account-subdomain>.workers.dev`

---

## 3. 完成应用内配置

打开 Pages 默认地址，第一次进入会先初始化管理员。

进后台以后，按这个顺序做：

1. 在设置页生成 API Key
2. 在设置页绑定 Worker 自定义域名
3. 在设置页绑定 Pages 自定义域名
4. 在域名页初始化根域名
5. 在域名页创建一个收件子域名

这里有两个固定边界：

- 管理面板始终请求 Worker 默认 `workers.dev`
- Worker / Pages 自定义域名只是对外别名，不改变管理面板默认调用路径

---

## 4. 做一轮手动验证

按这条顺序验证就够了：

1. 打开 `pages.dev` 默认地址，确认能进登录页
2. 打开 Worker 默认 `workers.dev` 地址，确认健康检查能访问
3. 登录后台
4. 确认设置页能看到已绑定的自定义域名
5. 在地址页创建一个真实地址
6. 给这个地址发一封测试邮件
7. 在邮件页看到这封邮件

如果这 7 步都通过，说明应用主链已经通了。

---

## 5. 接入 SDK

### Node.js SDK

安装：

```bash
pnpm add "git+https://github.com/<owner>/<repo>.git#<ref>&path:/sdk/nodejs"
```

最小调用：

```ts
import { MailsClient } from '@mails/sdk-nodejs'

const client = new MailsClient(
  'https://your-worker.your-account.workers.dev',
  process.env.MAILS_API_KEY!
)

const domains = await client.listDomains()
const created = await client.createAddress('demo@m1.example.com', 'demo', 24)
const mails = await client.getMailList(created.address.name)
```

### Python SDK

安装：

```bash
python -m pip install "git+https://github.com/<owner>/<repo>.git@<ref>#subdirectory=sdk/python"
```

最小调用：

```python
from mails_sdk import MailsClient

client = MailsClient(
    "https://your-worker.your-account.workers.dev",
    api_key="YOUR_API_KEY",
)

domains = client.list_domains()
created = client.create_address("demo@m1.example.com", "demo", ttl_hours=24)
mails = client.get_mail_list(created["address"]["name"])
```

SDK 这条线现在只开放 `/call/*`：

- 可以创建地址
- 可以查邮件
- 可以轮询等新邮件
- 可以列域名和创建子域名
- 不提供删除和后台设置能力

---

## 6. 可选切到 GitHub 自动部署

如果你本地已经跑通，后面想把部署交给 GitHub，直接跑：

```bash
pnpm setup:github
```

它会把这几项同步到当前 `origin` 对应的 GitHub 仓库：

- Secrets：
  `CLOUDFLARE_ACCOUNT_ID`
  `CLOUDFLARE_API_TOKEN`
  `CF_EMAIL`
  `CF_GLOBAL_API_KEY`
  `JWT_SECRET`
- Variable：
  `D1_DATABASE_ID`

然后你后面只需要：

- push 到默认分支，自动触发 `CI`、`Deploy Worker`、`Deploy Frontend`
- 或手动跑对应 workflow

---

## 日常更新

日常开发只用这几条：

```bash
pnpm deploy:worker
pnpm deploy:frontend
pnpm test
pnpm build
pnpm check:scripts
```

如果平台内部状态已经不可信，再用：

```bash
pnpm run rebuild
```

这条命令只会重建 D1 和重新部署，不碰 DNS、自定义域名和 Email Routing 外部入口。
