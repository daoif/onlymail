# 0005: 平台抽象 Provider 层

## 状态
已实施

## 背景
原系统通过 `lib/cloudflare.ts` 的 `CloudflareClient` 类直接调用 Cloudflare API，service 层高度耦合。

## 决策
引入 Provider 接口层：
- `providers/types.ts`：定义 `DnsProvider`、`EmailProvider` 接口
- `providers/cloudflare/`：Cloudflare 具体实现
- `providers/index.ts`：`createProviders(env)` 工厂

Service 层只依赖接口，不感知具体平台实现。

## 理由
1. **可测试性**：可以 mock Provider 进行单元测试
2. **可替换性**：将来可增加非 Cloudflare 的 Provider 实现
3. **关注点分离**：业务逻辑和平台调用解耦

## 影响
- 删除 `lib/cloudflare.ts`
- `services/domain.ts` 改为通过 `createProviders(env)` 获取 Provider 实例
- `AGENTS.md` 已添加约束：禁止 service 层直接调用 Cloudflare API
