# 域名接入 Cloudflare

这份文档只解决一件事：**把你的主域名从当前域名商接入 Cloudflare**，让 OnlyMail 后续的根域名 bootstrap、根域名直收、managed subdomain 收件、Worker / Pages 自定义域名都能继续往下做。

> 这一步和 OnlyMail 的部署（`init` / `deploy`）是独立的。做完这里的操作后，再去看 [RUNBOOK](RUNBOOK.md) 或 [DEPLOY](DEPLOY.md) 继续部署。

---

## 1. 边界说明

OnlyMail 涉及 3 类域名操作，本文档只处理第 1 类：

| # | 操作 | 本文档是否覆盖 |
|---|------|--------------|
| 1 | 域名商 → Cloudflare：建 Zone、改 NS、等激活 | ✅ 本文档 |
| 2 | Cloudflare → OnlyMail Web 入口：Worker / Pages 自定义域名 | ❌ 见 DEPLOY |
| 3 | Cloudflare → OnlyMail 收件：根域名 bootstrap、根域名直收 / managed subdomain、Email Routing | ❌ 见 RUNBOOK |

---

## 2. 前置条件

你需要两个 Cloudflare 值：

| 值 | 获取方式 |
|----|---------|
| `CF_API_TOKEN` | [CF 控制台 → API Tokens → Create Token → Custom Token](https://dash.cloudflare.com/profile/api-tokens) |
| `CF_ACCOUNT_ID` | 见下方说明 |

### API Token 推荐权限

建议一次性创建一个具备以下 5 项权限的 Token，后续 OnlyMail 部署也直接复用，不用再建第二个：

| 资源 | 权限 |
|------|------|
| Account → Workers Scripts | Edit |
| Account → D1 | Edit |
| Account → Cloudflare Pages | Edit |
| Zone → DNS | Edit |
| Zone → Zone | Read |

本文档如果走 API 创建 Zone，最低需要 `Zone → Zone: Edit` 或 `Zone → DNS: Edit`。`Zone → Zone: Read` 只够读取 Zone 状态，不够创建 Zone。既然后面部署 OnlyMail 也要用同一个 Token，建议一步到位全部勾上。

### 已有值的复用

- 如果你之前已经跑过 `pnpm run init`，这两个值已经在项目根目录的 `.env.local` 里了，直接拿来用即可
- 这两个值在后续部署中也是必填项，留好备用

### `CF_ACCOUNT_ID` 怎么找

`CF_ACCOUNT_ID` 是账号级 ID，不依赖某个具体域名：

- **已有已托管域名** → 任意域名页右下角 API 区域可以看到
- **第一次接入，还没有已托管域名** → 登录 Cloudflare 后，在 Workers & Pages 等账号级页面，或直接从浏览器地址栏 URL 中读取 Account ID

### AI 获取这两个值

如果你让 AI 来辅助操作，AI 也可以通过浏览器访问 Cloudflare 控制台来帮你创建 Token 和查找 Account ID——前提是你已在浏览器中登录 Cloudflare。

> 本文档的步骤**不需要** `CF_EMAIL` 和 `CF_GLOBAL_API_KEY`。那两个值是后续 OnlyMail 部署完成后做 Email Routing 配置时才用到的。

## 3. 在 Cloudflare 创建 Zone

可以在 Cloudflare 控制台手动添加，也可以用 API：

```
POST /zones
{
  "name": "example.com",
  "account": { "id": "<CF_ACCOUNT_ID>" }
}
```

创建成功后，记下返回结果中的：

- `id` —— Zone ID
- `name_servers` —— Cloudflare 分配的两条 nameserver
- `status` —— 此时应为 `pending`

> 参考：[Cloudflare API - Create Zone](https://developers.cloudflare.com/api/resources/zones/methods/create/)

---

## 4. 去域名商修改 NS

**这一步不能通过 Cloudflare API 完成**，需要去域名注册商那边操作。

具体做法：

1. 登录域名注册商后台
2. 找到域名的 nameserver（NS）设置
3. 删掉原来的 NS 记录
4. 填入 Cloudflare 分配的两条 nameserver（上一步拿到的）

不同注册商的界面位置各不相同，但操作内容是统一的：把权威 NS 指向 Cloudflare。

> 参考：[Cloudflare - Update nameservers](https://developers.cloudflare.com/dns/nameservers/update-nameservers/)

---

## 5. 等待生效并验证

NS 修改通常需要几分钟到 48 小时不等。在此期间可以查询 Zone 状态：

```
GET /zones/<zone_id>
```

验证标准：

- 返回的 `status` 从 `pending` 变为 `active`
- `name_servers` 字段显示 Cloudflare 分配的值

如果长时间没有生效，可以手动触发一次激活检查：

```
PUT /zones/<zone_id>/activation_check
```

> Zone 变为 `active` 之前，**不要开始根域名 bootstrap、子域名收件配置和正式收件验证**。OnlyMail 的基础部署（`init` / `Bootstrap Cloudflare`）可以先完成——它只建 D1、Worker、Pages 和默认入口，不依赖 Zone 状态。

---

## 6. 完成后继续

Zone 激活后，这份文档的职责就结束了。接下来按顺序继续：

1. **部署 OnlyMail** → [RUNBOOK](RUNBOOK.md) 或 [DEPLOY](DEPLOY.md)
2. **绑定自定义域名** → 在管理面板的设置页操作
3. **根域名 bootstrap + 选择根域名直收 / managed subdomain 收件** → 在管理面板的域名页操作

---

## 7. AI 执行边界

如果你让 AI 来辅助完成本文档的操作，以下是能力边界：

| 步骤 | AI 能力 | 条件 |
|------|---------|------|
| 创建 Zone | ✅ 直接调用 CF API | 需要 `CF_API_TOKEN` |
| 读取 NS 和 Zone 状态 | ✅ 直接调用 CF API | 需要 `CF_API_TOKEN` |
| 触发激活检查 | ✅ 直接调用 CF API | 需要 `CF_API_TOKEN` |
| 去域名商改 NS | ⚠️ 视情况而定 | 见下方说明 |

**关于修改 NS**，AI 不能通过 Cloudflare API 完成，但有其他路径：

- **域名商提供 API** → AI 可以直接调用域名商 API 修改 NS
- **AI 有浏览器能力，用户已登录域名商后台** → AI 可以辅助在页面上完成操作
- **以上都不具备** → AI 给出明确的操作指令，由用户手动完成
