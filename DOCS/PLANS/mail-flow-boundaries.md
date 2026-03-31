# 邮件收发六层边界

这份文档只回答一件事：从 Cloudflare 到应用，邮件收发涉及哪些层，每层各自负责什么、不负责什么。

## 概览

按职责从下到上分成 6 层：

1. init — 基础设施准备
2. 自定义域名 — 访问入口（API/前端）
3. 根域名 bootstrap — 告诉系统“这个根域名要收邮件”
4. 收件子域名 — 把某个子域名变成可收件域
5. 具体邮箱地址 — 业务层的地址对象
6. 收件处理 — Worker 收到邮件后的落库与查询

每一层只往下一层输出，不跨层做事。

## 1. init（基础设施）

代码入口：`scripts/init.ts`

负责：
- 创建 D1 数据库并初始化 schema
- 创建或确认 Pages 项目
- 按模板生成 `worker/wrangler.toml`
- 生成 `worker/.dev.vars`
- 部署 Worker 到 `workers.dev`
- 构建并部署前端到 Pages
- 可选调用 `setup:github` 写 GitHub Secrets / Variables

不负责：
- 不启用 Email Routing
- 不配置任何 catch-all
- 不绑定任何 Worker / Pages 自定义域名
- 不读取 Cloudflare 里已有的自定义域名残留并回写到默认配置
- 不决定“哪个域名用来收邮件”

这一层完成后，系统有了可用的 API 和前端入口（workers.dev + pages.dev），但还没有任何可收件域名。
这一层的事实来源是 D1 和本地配置；Cloudflare 上存在但没写进 D1 的外部残留不会被默认接管。

## 2. 自定义域名（访问入口）

代码入口：
- 后端：`worker/src/routes/api.ts` 中 `/api/settings/custom-domains` 和 `/api/settings/pages-domains`
- Provider：`worker/src/providers/cloudflare/domain-binding.ts`
- 前端：`frontend/src/views/SettingsView.vue`

负责：
- 为 Worker API 绑定自定义域名（如 `onlymail-api.example.com` → Worker）
- 为前端 Pages 绑定自定义域名（如 `onlymail.example.com` → Pages）
- 自动创建/更新对应的 CNAME 记录
- 提供更好记的访问别名，不改动管理面板固定使用的 `workers.dev` API 主路径

不负责：
- 不启用 Email Routing
- 不创建任何 MX/TXT 记录
- 不创建 Email Routing 规则
- 不把某个域名“宣告”为邮箱根域名

这一层只关心“用户通过什么 URL 访问后台和前端”。

## 3. 根域名 bootstrap（邮箱根域名）

代码入口：
- 后端：`worker/src/services/domain.ts` 中 `bootstrapRootDomain`
- 路由：`worker/src/routes/api.ts` 中 `POST /api/domains/bootstrap`
- 前端：`frontend/src/views/DomainsView.vue` 根域名初始化表单

负责：
- 按 `rootDomain` 自动解析对应 Zone ID
- 检查该 Zone 的 Email Routing 设置，如果未启用则启用
- 把根域名的 catch-all 规则指向 Worker（让 `abc@rootDomain` 这类地址可以直收）
- 把根域名写入 `domains` 表，标记 `is_root = 1`、保存 `cf_zone_id`

不负责：
- 不创建子域名的 MX/TXT/规则
- 不创建具体邮箱地址
- 不绑定 Worker / Pages 自定义域名

这一层的结果是：
- 根域名在 Cloudflare 上已经启用 Email Routing
- 根域名级别的 catch-all 会把未命中规则的邮件投递到 Worker
- 应用知道有哪些根域名已经“准备好做邮箱”

## 4. 收件子域名

代码入口：
- 后端：`worker/src/services/domain.ts` 中 `createSubdomain` / `deleteSubdomain`
- 路由：`worker/src/routes/api.ts` 中 `POST /api/domains` / `DELETE /api/domains/:name`
- 前端：`frontend/src/views/DomainsView.vue` 子域名表单

负责：
- 在根域名所在 Zone 下，为子域名创建 3 条 MX 记录（指向 Cloudflare MX）
- 为子域名创建 1 条 SPF TXT 记录
- 为子域名创建 1 条 Email Routing 规则：`*@子域名` → Worker
- 在删除子域名时，按存下来的 `mx_record_ids` / `txt_record_id` / `route_rule_id` 回收这些资源
- 在 `domains` 表中记录每个子域名及其关联的 Cloudflare 资源 ID

不负责：
- 不启用根域名的 Email Routing（这一层依赖第 3 层已经做完）
- 不创建具体邮箱地址
- 不绑定任何 Web 访问入口域名

这一层的结果是：
- 每个收件子域名都有完整的 MX/TXT/Email Routing 配置
- Worker 能区分“邮件来自哪个子域名”（`message.to` 中体现）

## 5. 具体邮箱地址

代码入口：
- 后端：`worker/src/services/address.ts` 中 `createOrInspectAddress` 等
- 路由：`worker/src/routes/api.ts` 和 `/call` 路由
- 前端：`frontend/src/views/AddressesView.vue`

负责：
- 在 `address` 表中按 `name`（完整邮箱地址）、`domain`、`project`、`ttl_hours` 记录业务地址
- 标记地址是否已存在、是否被当前项目占用
- 列出地址并统计每个地址对应的邮件数量

不负责：
- 不调用任何 Cloudflare API
- 不创建/删除 MX/TXT/Email Routing 规则

创建地址的前置条件是：对应的根域名或子域名已经在第 3/4 层完成初始化。

## 6. 收件处理

代码入口：
- Worker：`worker/src/worker.ts` 中 `email()` 入口
- 业务：`worker/src/email.ts`、`worker/src/services/mail.ts`

负责：
- 从 Cloudflare Email Routing 收到邮件
- 根据 `message.to` 在 `address` 表中查找目标地址
- 如果找到地址，则解析邮件并落入 `raw_mails` 表
- 提供按地址和分页查询邮件列表、查看邮件详情、删除邮件的接口

不负责：
- 不修改任何 Cloudflare 配置
- 不创建/删除域名、子域名或 Email Routing 规则

到这一层为止，整条“收件链路”闭环：

1. Cloudflare 把符合规则的邮件投递给 Worker
2. Worker 按地址查业务表
3. 找到地址则落库，前端和 SDK 通过 API 查询邮件

## 小结

- init 只负责“基础设施就绪”，不参与域名和邮件路由决策。
- 自定义域名只负责“好看的访问入口”，不参与收件。
- 根域名 bootstrap 决定“哪些根域名参与收件”，并启用 Email Routing + catch-all。
- 收件子域名把“能收哪些域名的邮件”细分到子域名层级。
- 具体邮箱地址和收件处理只在应用内部操作数据库，不再碰 Cloudflare API。
