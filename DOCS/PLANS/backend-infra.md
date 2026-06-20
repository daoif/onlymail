# 后端与基础设施方案

## 目标
- Worker 接收邮件并写入 D1。
- 自动化 API 给注册机用。
- 管理 API 给后台页面用。
- 域名初始化、子域名创建和删除都走 Cloudflare API。
- API Key 支持后台轮换。

## 目录建议
```text
worker/
├── src/
│   ├── worker.ts
│   ├── email.ts
│   ├── scheduled.ts
│   ├── services/
│   │   ├── address.ts
│   │   ├── mail.ts
│   │   ├── domain.ts
│   │   ├── settings.ts
│   │   └── stats.ts
│   ├── routes/
│   │   ├── api.ts
│   │   ├── admin.ts
│   │   └── auth.ts
│   ├── lib/
│   │   ├── db.ts
│   │   ├── crypto.ts
│   │   ├── cloudflare.ts
│   │   └── pagination.ts
│   └── types.ts
├── db/
│   └── migrations/
│       └── 0001_initial.sql
└── wrangler.toml
```

## 数据表

数据库结构不再靠单个 `schema.sql` 初始化，而是通过 `worker/db/migrations/` 里的 SQL migration 递增维护；`init` 和 `deploy:worker` 都会自动补齐未执行的 migration。

### `address`
| 字段 | 说明 |
|------|------|
| `id` | 主键 |
| `name` | 完整邮箱地址，唯一 |
| `domain` | 域名部分，便于筛选 |
| `project` | 业务项目标识 |
| `ttl_hours` | 0=永久，大于 0=临时 |
| `created_at` | 创建时间 |
| `updated_at` | 最后收件时间 |

### `raw_mails`
| 字段 | 说明 |
|------|------|
| `id` | 主键 |
| `address` | 收件地址 |
| `source` | 发件人 |
| `subject` | 主题 |
| `message_id` | 原邮件 ID，便于幂等 |
| `raw` | 原始 MIME |
| `text` | 解析后的纯文本 |
| `html` | 解析后的 HTML |
| `created_at` | 收件时间 |

### `domains`
| 字段 | 说明 |
|------|------|
| `id` | 主键 |
| `name` | 域名 |
| `root_name` | 所属根域名 |
| `is_root` | 1 表示根域名 |
| `subdomain_type` | `root` / `permanent` / `temporary`，长期子域名不参与临时轮换 |
| `routing_enabled` | 根域名是否已完成初始化 |
| `cf_zone_id` | Cloudflare zone id |
| `mx_record_ids` | JSON 数组，保存多条 MX 记录 ID |
| `txt_record_id` | SPF 记录 ID |
| `route_rule_id` | Email Routing 规则 ID |
| `created_at` | 创建时间 |

### `settings`
| 字段 | 说明 |
|------|------|
| `key` | 主键 |
| `value` | 字符串配置值 |
| `created_at` | 创建时间 |
| `updated_at` | 更新时间 |

## 关键实现调整
- `settings` 表保留并启用，至少存 `admin_user`、`admin_pass_hash`、`api_key_hash`、`api_key_preview`、`api_key_rotated_at`、`subdomain_rotation_limit`、`subdomain_dns_mode`、`d1_auto_cleanup_temporary_enabled`。
- 管理员密码只存 SHA-256 哈希，首次初始化后不再依赖环境变量里的管理员账号密码。
- API Key 生成后只返回明文一次，数据库只存哈希和预览值。
- 邮件入库时就解析出 `subject`、`source`、`text`、`html`，前端详情页不在浏览器里二次解析原始 MIME。
- 地址的 `updated_at` 在收件后更新，TTL 清理按这个字段判断。

## 鉴权设计
- `/api/*` 给管理面板，用 D1 里的管理员会话令牌。
- `/call/*` 给自动化调用方，用 `Authorization: Bearer <api_key>`。
- `GET /api/init-status` 用来判断管理员是否已初始化，不做登录会话校验。
- `POST /api/init` 只允许首次初始化时调用，写入 `admin_user` 和 `admin_pass_hash`。
- `POST /api/login` 从 D1 `settings` 读取管理员账号和密码哈希做登录。
- 可轮换的 API Key、管理员账号和后台会话都放 D1；环境变量里只保留 Cloudflare 相关配置。

## 自动化 API
- `POST /call/address`
  - 请求体：`{ address, project, ttl_hours? }`
  - 返回 `created | occupied | available`。
- 创建前只查 D1 校验目标域名 ready；域名不存在、`routing_enabled != 1` 或资源 ID 不完整时返回 `domain_not_ready`，不创建不可收信地址。
- `GET /call/mails/:address`
  - 返回邮件摘要列表。
- `GET /call/mail/:id`
  - 返回 `raw`、`text`、`html`、`source`、`subject`、`created_at`。
- `GET /call/domains`
  - 返回 D1-only 轻量域名列表，用于机器客户端 discovery；不读取 Cloudflare DNS inventory 或 Email Routing 规则。
- `GET /call/domains/:name`
  - 返回单个域名详情。
- `POST /call/domains`
  - 创建或修复 managed subdomain；若 D1 已存在且 ready，直接返回 D1 记录，不调用 Cloudflare。
- `/call/address`、`/call/domains` 会输出结构化耗时日志，包含 endpoint、domain/address、project、duration_ms、status/error_code，不记录 API Key。

## 管理 API
- `GET /api/init-status`
  - 返回管理员是否已初始化。
- `POST /api/init`
  - 首次设置管理员账号和密码。
- `POST /api/login`
- `GET /api/dashboard`
  - 返回总地址数、总邮件数、域名数、今日新邮件数，以及 D1 当前容量（占用、上限、剩余和占用率）。
- `POST /api/dashboard/cleanup`
  - 请求体：`{ scope: mails|addresses, target: temporary|permanent }`
  - 分别清理临时 / 永久邮件或邮箱；清理邮箱时会连同对应邮件一起删除。
- `GET /api/settings/d1-auto-cleanup`
  - 返回自动滚动清理开关、触发容量占比和保留临时邮箱数量。
- `PUT /api/settings/d1-auto-cleanup`
  - 请求体：`{ enabled }`
  - 开关开启后，D1 占用达到 95% 时自动删除旧临时邮箱及其邮件，只保留最近活跃的 100 个临时邮箱。
- `GET /api/addresses`
- `DELETE /api/address/:name`
- `GET /api/mails`
  - 支持按地址筛选和分页。
- `GET /api/mail/:id`
- `DELETE /api/mail/:id`
- `POST /api/domains/bootstrap`
  - 初始化根域名；首次启用 Email Routing 时走这里。
- `GET /api/domains`
  - 根域名行返回长期/临时子域数量。
  - 根域名行会实时读取 Cloudflare Zone DNS：`cf_dns_record_count` 是当前已用 DNS 数，`remaining_dns_count` 是当前剩余可新增 DNS 数，`cf_dns_record_limit` / `manageable_dns_count` 是当前 Zone DNS 上限，`managed_dns_count` 是 OnlyMail managed subdomain 当前仍存在的 MX/TXT 数。
- `POST /api/domains`
  - 创建子域名的 MX、TXT 和路由规则；`subdomainType=permanent|temporary`，管理端默认长期。
- `DELETE /api/domains/:name`
- `GET /api/settings/api-key`
  - 返回管理员账号、遮挡后的 key 预览和轮换时间。
- `POST /api/settings/change-password`
  - 校验旧密码后更新管理员密码。
- `POST /api/settings/api-key/rotate`
  - 生成新 key，返回一次性明文。
- `GET /api/settings/domain-lifecycle`
  - 返回临时子域名轮换总数、DNS 模式和每个子域名占用的 DNS 记录数。
- `PUT /api/settings/domain-lifecycle`
  - 更新轮换总数和 DNS 模式；轮换总数按根域名独立生效。
- `GET /api/settings/custom-domains`
  - 返回 Worker 自定义域名列表。
- `POST /api/settings/custom-domains`
  - 绑定 Worker 自定义域名。
- `DELETE /api/settings/custom-domains/:id`
  - 移除 Worker 自定义域名。
- `GET /api/settings/pages-domains`
  - 返回 Pages 自定义域名列表和验证状态。
- `POST /api/settings/pages-domains`
  - 绑定 Pages 自定义域名，并自动把 CNAME 对齐到 Pages 项目的真实 subdomain。
- `DELETE /api/settings/pages-domains/:domain`
  - 移除 Pages 自定义域名。

## 域名管理顺序
1. 先调用根域名初始化接口。
2. 初始化成功后，`domains` 表写入一条 `is_root=1` 记录。
3. 添加长期子域名时，按当前 DNS 模式创建 DNS 和 1 条 Email Routing 规则，不参与临时轮换。
4. 添加子域名前，按 Cloudflare 当前 Zone DNS 已用数和上限预检剩余额度；额度不足时提前返回明确错误。
5. 添加临时子域名时，先按当前 root 的 `subdomain_rotation_limit` 判断是否需要回收最旧临时子域名。
6. DNS 模式默认 `compatible`（3 MX + 1 TXT）；可切换 `minimal`（1 MX）。
7. 删除子域名时，按 Cloudflare 当前真实 MX/TXT/Email Routing 规则对账后删除。

## 邮件接收流程
1. 收到邮件后取 `message.to`。
2. 地址不存在就丢弃，不入库。
3. 地址存在就用 PostalMime 解析。
4. 保存 `raw`、`source`、`subject`、`text`、`html`、`message_id`。
5. 用异步方式更新 `address.updated_at`。

## 定时清理
- Cron 每小时执行一次。
- TTL 清理条件：`ttl_hours > 0` 且 `updated_at` 超过 TTL。
- 自动滚动清理条件：`d1_auto_cleanup_temporary_enabled=true` 且 D1 占用达到 95%；触发后按 `updated_at DESC, id DESC` 保留最近活跃的 100 个临时邮箱，其余临时邮箱和对应邮件分批删除。
- 两类清理都先删 `raw_mails`，再删 `address`。
- 每次输出清理日志，至少包含删了多少地址、多少邮件。

## 后端验收
- `wrangler dev` 能起一个最小 Hono Worker。
- 创建地址后，发到这个地址的邮件能在 D1 查到。
- 自动化 API 带 key 能用，不带 key 返回 401。
- 管理员能登录，仪表盘有统计值。
- 后台能轮换 API Key，旧 key 立刻失效。
- 根域名初始化一次后，子域名能自动创建和回收。



