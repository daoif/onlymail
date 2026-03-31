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
- `settings` 表保留并启用，至少存 `admin_user`、`admin_pass_hash`、`api_key_hash`、`api_key_preview`、`api_key_rotated_at`。
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
- `POST /api/address`
  - 请求体：`{ address, project, ttl_hours? }`
  - 返回 `created | occupied | available`。
- `GET /api/addresses`
  - 支持 `page`、`size`、`domain`、`project`。
- `DELETE /api/address/:name`
  - 删除地址和全部邮件。
- `GET /api/mails/:address`
  - 返回邮件摘要列表。
- `GET /api/mail/:id`
  - 返回 `raw`、`text`、`html`、`source`、`subject`、`created_at`。
- `DELETE /api/mail/:id`
  - 删除单封邮件。

## 管理 API
- `GET /api/init-status`
  - 返回管理员是否已初始化。
- `POST /api/init`
  - 首次设置管理员账号和密码。
- `POST /api/login`
- `GET /api/dashboard`
  - 返回总地址数、总邮件数、域名数、今日新邮件数。
- `GET /api/addresses`
- `DELETE /api/address/:name`
- `GET /api/mails`
  - 支持按地址筛选和分页。
- `GET /api/mail/:id`
- `DELETE /api/mail/:id`
- `POST /api/domains/bootstrap`
  - 初始化根域名；首次启用 Email Routing 时走这里。
- `GET /api/domains`
- `POST /api/domains`
  - 创建子域名的 MX、TXT 和路由规则。
- `DELETE /api/domains/:name`
- `GET /api/settings/api-key`
  - 返回管理员账号、遮挡后的 key 预览和轮换时间。
- `POST /api/settings/change-password`
  - 校验旧密码后更新管理员密码。
- `POST /api/settings/api-key/rotate`
  - 生成新 key，返回一次性明文。
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
3. 添加子域名时，按顺序创建 3 条 MX、1 条 SPF TXT、1 条 Email Routing 规则。
4. 删除子域名时，只按存下来的资源 ID 删除。

## 邮件接收流程
1. 收到邮件后取 `message.to`。
2. 地址不存在就丢弃，不入库。
3. 地址存在就用 PostalMime 解析。
4. 保存 `raw`、`source`、`subject`、`text`、`html`、`message_id`。
5. 用异步方式更新 `address.updated_at`。

## 定时清理
- Cron 每小时执行一次。
- 清理条件：`ttl_hours > 0` 且 `updated_at` 超过 TTL。
- 先删 `raw_mails`，再删 `address`。
- 每次输出清理日志，至少包含删了多少地址、多少邮件。

## 后端验收
- `wrangler dev` 能起一个最小 Hono Worker。
- 创建地址后，发到这个地址的邮件能在 D1 查到。
- 自动化 API 带 key 能用，不带 key 返回 401。
- 管理员能登录，仪表盘有统计值。
- 后台能轮换 API Key，旧 key 立刻失效。
- 根域名初始化一次后，子域名能自动创建和回收。



