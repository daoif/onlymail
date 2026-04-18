# 决策：managed subdomain 采用“显式资源 + 脏状态对账”生命周期

## 结论

- onlymail 继续只管理“显式创建并记入 D1 的 managed subdomain”。
- 创建时允许自动回收最旧子域，但前提是它本身也属于 onlymail managed domain。
- 删除时以 Cloudflare 当前真实状态为准，不再假设 D1 里保存的资源 ID 一定完整可用。
- Cloudflare API 错误必须透传具体 `code/message`。
- 当前不落地“任意 `*.bucket.root` 无需逐条 DNS/规则即可自动收件”的模式。

## 背景

- 现场已经出现批量删除失败后留下半残 DNS / 丢失规则 / D1 残留三种脏状态。
- 同时 Cloudflare 免费版 DNS 额度有限，managed subdomain 需要进入可回收生命周期。
- co1 的邮件恢复链路已经依赖 onlymail 子域管理；如果 onlymail 对脏状态不容错，上游会被迫人工清库。

## 取舍

### 选择了什么

- 把“删除是否成功”改成对账式删除：按子域名精确查询当前 MX/TXT 和 literal rule，再删真实存在的资源。
- 把“已有 D1 记录”改成可修复状态，而不是直接视为成功。
- 给 managed subdomain 增加按 root 的数量上限，避免 DNS 记录只增不减。

### 没有选择什么

- 没有把 Cloudflare 上所有残留 DNS 自动认领为平台资源。
- 没有继续依赖“只删 stored id，失败就中断”的脆弱删除模型。
- 没有把官方尚未给出稳定能力口径的 wildcard subdomain 邮件接收模式直接做进产品。
