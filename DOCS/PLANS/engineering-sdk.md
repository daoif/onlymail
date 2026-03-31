# 工程与 SDK 设计决策

## 一、自定义域名

### 命名规则

- API: `onlymail-api.{根域名}`
- 前端: `onlymail.{根域名}`

例如：`onlymail-api.example.com` 和 `onlymail.example.com`

### 设计要求

- `onlymail-api`和`onlymail`前缀是**默认值**，用户可在设置页里修改
- 根域名不能写死，随用户实际域名而定
- 在设置页中作为推荐值，但允许自定义输入

### workers_dev

保持开启，无安全影响——未被调用就不会被发现，且所有接口都有认证保护。

### 管理面板 API 主路径

- 前端管理面板固定请求 Worker 默认 `workers.dev`
- Worker 自定义域名继续保留，但只作为 SDK、人工调试和品牌化入口的别名
- 绑定或移除 Worker 自定义域名，不改变前端管理面板的 API 请求地址
- 这样可以避免“前端构建结果跟着自定义域名切换”的耦合

---

## 二、CORS

- 默认：限制 origin 为当前 Pages 项目的 `pages.dev` 正式地址、它的预览子域名和本地开发 `localhost`
- 应用内新增的前端自定义域名要在运行时追加进去，不能只靠环境变量
- CORS 配置需要同时支持模板默认值和运行时动态扩展
- SDK 是服务端调用，不受 CORS 影响
- 随 API 重构一起改动，无需单独处理

---

## 三、SDK 重设计

### 维护范围

Python 和 Node.js 两套 SDK 同时维护，保持 API 一致性。
当前只面向用户自己部署的实例，不面向公共服务。

### 路径变更

所有请求路径从 `/api/*` 改为 `/call/*`。

### 分发方式

- 第一阶段不发 npm / PyPI。
- Node.js 主推荐通过 GitHub 仓库子目录安装：`pnpm add "git+https://github.com/<owner>/<repo>.git#<ref>&path:/sdk/nodejs"`。
- Python 主推荐通过 GitHub 仓库子目录安装：`python -m pip install "git+https://github.com/<owner>/<repo>.git@<ref>#subdirectory=sdk/python"`。
- Node.js 当前不主推 `npm`，因为官方文档只保证 Git 依赖直接指向仓库根目录里的包，不保证这种子目录安装方式。

### 方法清单

```
# 邮箱操作
createAddress(address, project, ttlHours?)     → AddressRecord
getMailList(address, page?, size?)             → MailSummary[]
getMail(id)                                   → MailDetail
waitForMail(address, timeout?, interval?)     → MailDetail

# 域名操作（新增）
listDomains(type?, root?, limit?)             → DomainRecord[]
getDomain(name)                               → DomainDetail（含按项目统计）
createSubdomain(name, rootName?)              → DomainRecord
```

### 删除的方法

- ~~deleteAddress~~ — 移除
- ~~deleteMail~~ — 移除

Key 泄露时不会造成数据丢失。

### 域名轮换策略

- 可以内置，但**必须显式启用**（opt-in）
- 默认不启用，避免新用户困惑
- 调用方可以自行实现策略，SDK 只提供数据查询能力
- 具体策略逻辑后续实测再调整，当前优先让 SDK 能跑起来

---

## 四、平台抽象（去 CF 强耦合）

### 目标

当前不做非 CF 适配，但重构时建立接口层，后续迁移只需实现新 Provider。

### CF 耦合点分析

| 模块 | CF 依赖 | 抽象方案 |
|------|---------|----------|
| 数据库 | D1（SQLite 协议） | 定义 `DatabaseProvider` 接口，当前实现为 D1 |
| HTTP 框架 | Hono | 已跨平台，无需处理 |
| 邮件接收 | CF Email Workers | 定义 `EmailProvider` 接口；非 CF 环境需另起 SMTP 服务 |
| DNS/域名管理 | CF API | 定义 `DnsProvider` 接口；迁出时可选择保留域名在 CF 或适配其他 DNS |
| 定时任务 | CF Scheduled | 定义 `SchedulerProvider` 接口，非 CF 用 cron |

### 当前行动

1. 重构时所有平台特定操作通过 Provider 接口调用
2. 在 `AGENTS.md` 加入规则：**禁止直接调用 CF API，必须通过 Provider 接口**
3. 各 Provider 接口定义在 `worker/src/providers/` 目录
4. 当前只实现 `cloudflare/` 子目录下的 CF 版本

### 未来迁移

- 邮件接收：用开源 SMTP 方案（如 Haraka）或第三方 inbound webhook（Mailgun/SendGrid）
- DNS：如果域名仍在 CF，API 不变；如果迁出，实现对应 DNS Provider
- 数据库：D1 兼容 SQLite，迁移到 better-sqlite3 或 PostgreSQL 改动很小

---

## 五、前端体验规范

### 骨架屏（Skeleton Loading）

- 每个数据加载页面必须有骨架占位组件
- 骨架高度/形状匹配真实内容布局，避免页面跳动
- 首次加载和切换页面时立即显示骨架，不出现空白

### 缓存策略（Stale-While-Revalidate）

- 切换页面时先展示缓存中的旧数据（stale），同时后台请求新数据
- 新数据返回后无缝替换，不闪白、不跳动
- 推荐方案：Vue Query（TanStack Query）或自定义 composable
- 缓存 key 按路由 + 查询参数粒度管理

### 规范要求

> 此规范适用于本项目及后续前端项目，写入 `AGENTS.md` 作为开发约束。

1. **禁止裸 loading**：不得出现页面完全空白等待数据
2. **切页不闪**：页面切换必须复用缓存或骨架过渡
3. **渐进加载**：数据到达后渐进渲染，不要一次性替换整个页面
