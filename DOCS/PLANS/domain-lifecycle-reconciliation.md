# 域名生命周期与脏状态修复方案

## 背景

- 2026-04-19 现场已经证明：onlymail 的子域生命周期会出现三类问题：
  1. 批量删除中途失败，Cloudflare 资源删了一部分，D1 还留旧行。
  2. Email Routing 规则分页只读第一页，导致后续判断“是否已有规则”并不完整。
  3. Cloudflare 真实错误码被压平成统一文案，排障时看不到 `81045` 这类关键信息。
- 同时，`onlyaini.com` 已撞到免费版 DNS 配额，子域名不能继续只增不减。

## 目标

1. 保留“手动添加 / 手动删除长期 managed subdomain”的能力。
2. 子域名分成长期和临时两类：长期不参与自动轮换，临时才按 root 维度回收最旧项。
3. 删除流程按 Cloudflare 当前真实状态回收资源，不因旧 ID 缺失而留下脏状态。
4. 如果 D1 已有旧子域，但 Cloudflare 资源不完整，再次创建时自动补齐缺失资源并回写新 ID。
5. Cloudflare API 错误原样透传 code/message，便于现场排障。
6. Email Routing 规则读取必须取完整分页。

## 非目标

- 不把 Cloudflare 上所有 DNS 残留自动接管为平台事实；D1 仍然是 onlymail 的唯一事实源。
- 不实现“任意 `*.bucket.root` 无需逐条 DNS/规则即可收件”的模式。按当前官方能力口径，这仍不属于可稳定交付的方案。

## 实施口径

### 1. 新建流程

- `createSubdomain` 不再因为 D1 里“已经有一行”就直接返回。
- 统一改成：
  1. 解析 root。
  2. 拉取 Cloudflare 当前 DNS + Email Routing 真实状态。
  3. 计算缺哪些资源。
  4. 补齐缺失资源。
  5. 把最新 `mx_record_ids` / `txt_record_id` / `route_rule_id` 回写到 D1。

### 2. 长期与临时子域名

- `domains.subdomain_type` 取值：
  - `root`：根域名。
  - `permanent`：长期子域名，由用户主动创建，不会被临时轮换回收。
  - `temporary`：临时子域名，沿用轮换生命周期。
- 管理后台创建子域名默认是 `permanent`；SDK / `/call/domains` 默认创建 `temporary`，也允许显式传 `subdomainType`。

### 3. 数量上限与 DNS 统计

- 轮换总数从 D1 `settings.subdomain_rotation_limit` 读取，默认 `5`；旧的 `ONLYMAIL_MANAGED_SUBDOMAIN_LIMIT` 只作为未写入 D1 时的兼容回退。
- 轮换总数按 root 独立生效：每个根域名最多保留 N 个临时子域名。
- 达到上限时，只删除当前 root 下最旧的 `temporary` 子域名，再创建新的临时子域名。
- 每个 managed subdomain 约占 `3 MX + 1 TXT = 4` 条 DNS 记录；`GET /api/domains` 会在根域名行返回已管理 DNS、剩余可用 DNS、可管理 DNS 容量（已管理 + 按当前轮换总数还能新增的临时 DNS）、长期/临时子域数量。

### 4. 删除流程

- 删除不再盲信 D1 里保存的资源 ID。
- 先按子域名精确查询 Cloudflare 当前 MX/TXT。
- 再按 rule id 或 literal matcher `*@domain` 精确定位 Email Routing 规则。
- 只删除“当前仍存在且精确匹配该子域名”的资源。
- Cloudflare 侧删除完成后，再删 D1 记录。

### 5. 手动与自动的关系

- 手动长期 managed subdomain 仍然保留。
- 自动回收只会处理 onlymail 自己管理并记录在 D1 `domains` 表中的 `temporary` 子域。
- 不碰业务 DNS、根域名 MX/TXT、DKIM、A/CNAME 等非 managed 资源。

## 验证

1. 规则数超过 20/50 时，`listEmailRules` 仍能拿全量。
2. Cloudflare 返回 `code + message` 时，API 响应里能直接看到。
3. 构造“D1 有旧子域但 TXT/规则缺失”的状态，再次 `createSubdomain` 后能自动补齐。
4. 构造“批量删除中途缺 1 条 MX / 缺规则”的状态，再次删除能清干净并移除 D1 行。
