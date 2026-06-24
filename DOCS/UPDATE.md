# 更新路径

这份文档只解答一个问题：OnlyMail 部署好以后，怎么跟上新版本？

系统把"更新"拆成三层：

1. **代码自动部署** —— 默认分支代码变了，就通过 GitHub Actions 更新 Cloudflare 上的 Worker / Pages
2. **正式版本发布** —— 维护者创建 GitHub Release，形成用户可识别的版本号、发布说明和 SDK 附件
3. **新版本提醒** —— 已部署实例检查正式 GitHub Release，告诉管理员有新版本

三者是独立能力，不要混在一起理解：

| 事情 | 触发方式 | 结果 |
|------|----------|------|
| 更新正在运行的 Cloudflare 服务 | push 到默认分支，或手动运行部署 workflow | 执行 `CI` / `Deploy Worker` / `Deploy Frontend`，把代码部署到 Worker / Pages |
| 发布一个正式版本 | 手动创建 GitHub Release，例如 `gh release create v0.3.0 ...` | 生成正式 Release，触发 `Release SDK Assets` 上传 SDK 附件 |
| 后台提示有新版本 | Worker 定时或设置页手动检查 GitHub Release | 管理面板显示更新横幅或版本信息 |

> 重点：**push 会部署，但不会自动创建 GitHub Release；`Release SDK Assets` 会给已发布的 Release 挂附件，但不会替你创建 Release。**
> 对当前维护仓库来说，默认分支 push 后线上 Worker / Pages 会由部署 workflow 自动更新；其他未接自动同步的实例只有在正式 GitHub Release 发布后才会看到更新提醒。
> 如果后台看到“当前版本”高于“最新版本”，这不是更新提醒逻辑问题，而是维护者已经部署了更高版本代码，却没有创建对应 GitHub Release。应回到 [`RELEASING.md`](RELEASING.md) 补发同版本 Release，并确认 `Release SDK Assets` 成功。

---

## 1. 你自己维护的仓库

如果实例就是从你自己的仓库部署的，后续修改代码再 push，GitHub Actions 会自动触发部署：

- `CI`
- `Deploy Worker`
- `Deploy Frontend`

这种情况只是在更新你自己的线上服务，不一定需要发正式版本。

如果这次变更只是你自用，流程到 push 成功、部署 workflow 成功就结束。

如果这次变更要作为对外正式版本，例如 `v0.3.0`：

1. 先按 [`RELEASING.md`](RELEASING.md) 更新版本号、`CHANGELOG.md` 和相关文档
2. 提交并 push 到默认分支，让 `CI` / 部署 workflow 先跑完
3. 再创建 GitHub Release
4. 等 `Release SDK Assets` workflow 把 SDK 附件挂到这个 Release

---

## 2. GitHub workflow 分工

当前仓库内的 workflow 分工如下：

| Workflow | 主要触发 | 负责什么 | 不负责什么 |
|----------|----------|----------|------------|
| `CI` | push / pull request | 测试、构建、脚本检查、SDK 产物校验 | 不部署 Cloudflare，不创建 Release |
| `Bootstrap Cloudflare` | 手动运行 | 首次 GitHub-only 初始化，执行 `pnpm run init` | 不用于日常发版 |
| `Deploy Worker` | 默认分支相关路径变更，或手动运行 | 执行 D1 migration，并部署 `onlymail-worker` | 不创建 Release，不上传 SDK 附件 |
| `Deploy Frontend` | 默认分支相关路径变更，或手动运行 | 构建并部署 `onlymail-frontend` Pages | 不创建 Release |
| `Upstream Sync` | 定时或手动运行 | fork 仓库 fast-forward 同步上游，并补触发 `CI` / deploy workflow | 不自动 merge 分叉提交，不创建 Release |
| `Release SDK Assets` | GitHub Release published，或手动运行 | 构建 Node.js / Python SDK 安装包，并挂到当前 Release | 不创建 Release，不部署 Cloudflare |

因此，日常可以按这个判断：

- **我要更新 Cloudflare 上正在跑的服务**：push 默认分支，确认 `CI` / `Deploy Worker` / `Deploy Frontend` 成功
- **我要发布一个用户可见的新版本**：在 push 部署成功后，再创建 GitHub Release
- **我要让未自动同步的实例看到更新提醒**：必须创建正式 GitHub Release，普通 commit 不会触发提醒
- **我已经改了 `APP_VERSION` / `package.json` 版本号**：这已经进入正式发版流程，不能只部署不发 Release；必须继续按 [`RELEASING.md`](RELEASING.md) 完成 Release 和发布后验收

---

## 3. fork 上游仓库，并且想自动跟上更新

这是推荐的自动更新路径。

先确认两件事：

1. 你的仓库已经配好 GitHub Actions 和 Cloudflare secrets
2. 默认分支尽量保持干净，不要长期堆自己的分叉提交

然后在仓库变量里设置：

```text
UPSTREAM_REPOSITORY=daoif/onlymail
```

再启用：

- `Upstream Sync`

它会执行以下操作：

1. 每 12 小时检查一次上游默认分支
2. 如果你的默认分支还能 fast-forward，就自动同步上游代码
3. 同步成功后，显式触发 `CI`、`Deploy Worker`、`Deploy Frontend`

这条线只接受 fast-forward：

- 默认分支与上游同线 → 自动更新
- 默认分支已有分叉提交 → 停下来等你手动处理

---

## 4. 没配自动同步，或者是本地部署

这类实例不会自动更新代码。

系统会改成提醒你：

1. Worker 每 24 小时检查一次 `daoif/onlymail` 的最新正式 GitHub Release
2. 只认正式 release tag，例如 `v0.1.0`、`v0.2.0`
3. 不认普通 push，也不认没发 release 的 commit
4. 管理面板登录后会显示更新横幅
5. 设置页可以手动点"立即检查更新"

因此这条线的行为是：

- **会提醒** —— 登录后台就能看到
- **不会自动更新** —— 需要你手动拉代码并重新部署

---

## 5. 更新横幅

当实例版本落后于最新正式 release 时，登录管理面板就会在顶部看到一条更新横幅。

横幅提供以下操作：

| 操作 | 说明 |
|------|------|
| 查看如何更新 | 跳转到本文档的手动更新指引 |
| 查看项目仓库 | 打开 GitHub 仓库首页 |
| 仅关闭本次更新通知 | 忽略当前版本的提醒，下个版本再弹 |
| 永久关闭更新通知 | 不再显示横幅，但设置页仍保留版本信息 |

下面分别说明两个关闭操作的行为。

### 仅关闭本次更新通知

只针对当前检测到的那个版本生效。

例如：当前最新版本是 `0.2.0`，你点了关闭——之后 `0.2.0` 不再弹横幅；等 `0.3.0` 发布后，横幅会重新出现。

### 永久关闭更新通知

只关闭顶部横幅，不影响设置页中的版本信息。

设置页仍然会显示当前版本、最新版本、上次检查时间、手动检查按钮，以及更新文档和仓库入口。

---

## 6. 设置页

设置页的"版本更新"区块会显示：

| 信息 | 说明 |
|------|------|
| 当前版本 | 本实例正在运行的版本 |
| 最新版本 | 上游最新正式 release |
| 上次检查时间 | Worker 最后一次检查更新的时间 |
| 是否有更新 | 当前版本与最新版本是否一致 |
| 手动检查按钮 | 立即触发一次版本检查 |
| 重新启用通知 | 如果之前永久关闭过横幅，可以在这里重新打开 |

所以即使你不想要横幅，版本信息也不会完全消失。

---

## 7. 手动更新

### 本地部署

拉取新版本代码后，按改动范围执行：

```bash
pnpm install
pnpm deploy:worker
pnpm deploy:frontend
```

如果 release note 中标注了需要重建平台内部状态，再补一步：

```bash
pnpm run rebuild
```

### GitHub-only / 混合部署

如果没配 `Upstream Sync`，手动把上游新版本合进默认分支后 push 即可。后续的 `CI`、`Deploy Worker`、`Deploy Frontend` 会自动执行。

如果你是项目维护者，并且这次 push 对应一个新的正式版本，还需要继续按 [`RELEASING.md`](RELEASING.md) 创建 GitHub Release。否则 Cloudflare 服务虽然已经更新，但其他实例的更新提醒和 SDK Release 附件都不会出现。

---

## 8. 当前限制

这套更新提醒**不会**做这些事：

- 自动下载 release
- 自动修改你的代码仓库
- 自动处理破坏性迁移
- 在未登录后台时主动弹提醒

它只负责一件事：**告诉管理员，有新的正式版本可以跟了。**
