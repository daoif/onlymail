# Cloudflare Email Routing 调研

## 这份文档的边界
- 这里记录的是 Cloudflare 平台本身的 Email Routing 和 DNS API 能力。
- 这里不描述参考项目怎么实现收件，参考项目视角统一看 `cfte-research.md`。
- 这里的结论直接服务本项目的域名管理设计。

## 账户前置条件

- 需要一个 Cloudflare 账户，域名 DNS 已托管在 Cloudflare。
- 需要至少一个已配置 Email Routing 的域名。
- 需要一个已部署的 Worker（用于接收邮件）。

## 已确认的 API 能力
- 可以通过 `POST /zones/{zone_id}/email/routing/enable` 启用某个 zone 的 Email Routing。
- 可以通过 `POST /zones/{zone_id}/dns/records` 创建或补齐收件用的 MX 和 TXT 记录。
- 可以通过 `POST /zones/{zone_id}/email/routing/rules` 创建把邮件送到 Worker 的规则。
- 可以通过 `GET/DELETE /zones/{zone_id}/email/routing/rules` 列出和删除规则。
- 可以通过 DNS 记录 ID 删除已经创建的子域名 MX 和 TXT 记录。

## 对本项目真正有用的流程
1. 先对根域名做一次初始化。
   - 如果还没启用 Email Routing，就先调用 enable API。
   - 初始化完成后，把根域名记到 `domains` 表，标记 `is_root=1`。
2. 再按子域名创建流程补齐收件能力。
   - 创建 3 条 MX 记录。
   - 创建 1 条 SPF TXT 记录。
   - 创建 1 条把 `*@子域名` 指向 Worker 的 Email Routing 规则。
3. 删除子域名时，只删除该子域名对应的资源，不碰根域名。

## 关于“一个示例只写 1 条 MX”这件事
- 单条 MX 的示例只是在说明 DNS API 的请求形状，不是本项目的最终配置方案。
- 本项目落地时按 3 条 MX 记录实现，并把记录 ID 全部存下来，删除时按 ID 回收。

## 平台限制和实现含义
- 子域名和根域名在同一个 zone 里处理，不需要给每个子域名单独建 zone。
- 一个 Worker 可以接多个域名和子域名的邮件，区分来源靠 `message.to`。
- 需要的 Token 权限至少包括 `Zone - DNS - Edit`、`Zone - Email Routing Rules - Write`、`Zone - Zone - Read`。
- 根域名初始化和子域名创建是两步，不要把“参考项目里常见的手工控制台流程”和“平台 API 能自动化”混成一件事。

## 对本项目的直接结论
- 后端需要一个根域名初始化接口，而不只是“添加子域名”接口。
- `domains` 表除了存 `route_rule_id`，还要能存多条 MX 记录 ID。
- 域名删除要按资源 ID 删除，不能靠名字模糊匹配。
- 管理面板要能显示根域名是否已经完成初始化，否则用户不知道为什么子域名创建失败。
