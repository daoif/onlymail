# 前端与 SDK 方案

## 前端目标
- 管理面板只做管理，不承载自动化业务逻辑。
- 页面结构短，减少弹窗和绕路。
- 视觉保持白底、少边框、少装饰。
- UI 细节规则统一看 `frontend-ui-spec.md`。

## 前端技术
- Vue 3 + TypeScript + Vite。
- Tailwind CSS。
- Pinia。
- Vue Router。
- 邮件 HTML 渲染时做安全处理，优先用 `DOMPurify` 这类小工具，不引入 UI 组件库。

## UI 约束
- 白色是主色调。
- 边框只做结构分隔，不做每个组件默认描边。
- 间距跟着组件所在上下文走，不复制固定模板。
- 只使用 Tailwind CSS 写样式，不使用 UI 框架。

## 页面结构
- 登录页。
- 仪表盘页。
- 地址页。
- 邮件页。
- 域名页。
- 设置页。

## 页面和接口对应
- 登录页 -> `GET /api/init-status`、首次 `POST /api/init`、日常 `POST /api/login`
- 仪表盘页 -> `GET /api/dashboard`、`POST /api/dashboard/cleanup`、`GET/PUT /api/settings/d1-auto-cleanup`
- 地址页 -> `POST /api/address`、`GET /api/addresses`、`DELETE /api/address/:name`
- 邮件页 -> `GET /api/mails`、`GET /api/mail/:id`、`DELETE /api/mail/:id`
- 域名页 -> `GET /api/domains`、`POST /api/domains/bootstrap`、`POST /api/domains`、`DELETE /api/domains/:name`
- 设置页 -> `GET /api/settings/api-key`、`POST /api/settings/change-password`、`POST /api/settings/api-key/rotate`、`GET/PUT /api/settings/domain-lifecycle`、`GET/POST/DELETE /api/settings/custom-domains`、`GET/POST/DELETE /api/settings/pages-domains`

## 关键交互约定
- 首次访问登录页时，先查管理员是否已初始化；未初始化就直接显示创建管理员表单。
- 登录成功后存管理员会话 token 到 `localStorage`。
- 管理员会话失效后统一跳回登录页。
- 地址页支持直接生成临时邮箱，生成后展示结果并支持复制或跳到邮件页查看。
- 地址页按域名和项目筛选。
- 邮件页左侧列表、右侧详情，标题区右侧提供刷新按钮，不刷新整页即可重新拉取邮件列表。
- 邮件详情优先渲染已清洗 HTML，没有 HTML 时渲染纯文本。
- 仪表盘页新增 D1 容量和清理操作一行：展示当前占用、剩余和占用率，并提供临时 / 永久、邮件 / 邮箱四个清理动作。
- 清理操作下方提供自动滚动清理开关：保存后，D1 占用达到 95% 时自动删除旧临时邮箱及其邮件，只保留最近活跃的 100 个临时邮箱；永久邮箱和永久邮件不参与。
- 域名页要把“根域名是否已初始化”、长期/临时子域数量、Cloudflare DNS 当前已用数 / 剩余额度 / Zone 上限、OnlyMail 已管理 DNS 数量直接显示出来；剩余额度必须来自 Cloudflare 实时 DNS 统计，不能用轮换空位估算。
- 域名页新增子域名时默认创建长期子域名，用户可切换为临时子域名。
- 设置页提供“轮换总数”，控制每个根域名下最多保留多少个临时子域名。
- 设置页提供“DNS 模式”：官方兼容模式每个子域名 4 条 DNS；精简模式每个子域名 1 条 MX。
- 设置页显示管理员账号和 API Key 预览值，不显示旧 key 明文，并提供改密码入口。

## SDK 目标
- SDK 只封装自动化 API，不封装管理端登录。
- Node.js 和 Python 两套接口尽量同名。
- `waitForMail` 是重点能力，负责轮询、超时和首封匹配。
- SDK 只面向用户自己部署的实例，不提供公共服务地址。
- `listDomains` 只走 `/call/domains` D1-only 轻量列表，用于机器客户端 discovery，不触发 Cloudflare 实时统计。
- `createAddress` 创建前要求目标域名在 D1 中处于 ready 状态；未初始化或资源 ID 不完整时会收到 `domain_not_ready`。
- 第一阶段不发 npm / PyPI。
- 正式版通过 GitHub Release 附件分发。
- 仓库子目录安装只留给开发用。

## Node.js SDK
- 目录：`sdk/nodejs/`
- 主推荐：`npm install "https://github.com/<owner>/<repo>/releases/download/v<version>/onlymail-sdk-nodejs-<version>.tgz"`
- 开发版：`pnpm add "git+https://github.com/<owner>/<repo>.git#<ref>&path:/sdk/nodejs"`
- 核心接口：
  - `createAddress(address, project, ttlHours?)`
  - `getMailList(address, page?, size?)`
  - `getMail(id)`
  - `waitForMail(address, timeoutMs?, intervalMs?)`
  - `listDomains(type?, root?, limit?)`
  - `getDomain(name)`
  - `createSubdomain(name, rootName?, subdomainType?)`

## Python SDK
- 目录：`sdk/python/`
- 主推荐：`pip install "https://github.com/<owner>/<repo>/releases/download/v<version>/onlymail_sdk-<version>-py3-none-any.whl"`
- 开发版：`pip install "git+https://github.com/<owner>/<repo>.git@<ref>#subdirectory=sdk/python"`
- 和 Node.js 对齐的接口：
  - `create_address(address, project, ttl_hours=None)`
  - `get_mail_list(address, page=1, size=20)`
  - `get_mail(mail_id)`
  - `wait_for_mail(address, timeout_ms=None, interval_ms=None)`
  - `list_domains(type=None, root=None, limit=None)`
  - `get_domain(name)`
  - `create_subdomain(name, root_name=None, subdomain_type="temporary")`

## 前端与 SDK 的验收
- 前端登录后能走完仪表盘、地址、邮件、域名、设置全链路。
- 页面整体符合 `frontend-ui-spec.md` 的白色主色调、边框和间距约束。
- 邮件详情页能安全显示正文。
- 设置页轮换 API Key 后，旧 key 立刻失效。
- Node.js SDK 能用很短的代码完成“创建地址 -> 等邮件 -> 取正文”，并能查询域名或创建子域名。
- Python SDK 能完成同样的链路。
- 根 README 和两个 SDK README 要明确写清楚安装命令、`baseUrl` 选取顺序，以及 `API Key` 来自后台设置页。



