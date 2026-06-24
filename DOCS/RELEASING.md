# 发布流程

这份文档只解答一个问题：OnlyMail 准备正式发布时，按什么顺序操作。

## 发布前先看这里

按以下顺序确认：

1. **`DOCS/STATUS.md`** —— 确认当前状态、已知风险和最近变更是否反映现场事实
2. **`CHANGELOG.md`** —— 把这次版本真正交付的内容写清楚
3. **`DOCS/UPDATE.md`** —— 确认更新路径说明与本次 Release 的行为没有冲突

## 版本规则

项目按语义化版本推进：

- `MAJOR`：破坏性变更、迁移成本明显变化
- `MINOR`：向后兼容的新功能
- `PATCH`：向后兼容的问题修复和文档修正

历史上首个公开版本为：

- `v0.1.0`

## 什么时候需要发版

判断标准：

- 只改了内部注释、未对外暴露的重构、临时实验代码 → **不需要发版**
- 只改了文档，且不影响用户部署、使用或升级理解 → **一般不需要单独发版**
- 只改了仓库内部维护脚本，不影响用户 → **一般不需要单独发版**
- 影响到用户的部署、升级、运行、接口、SDK、管理面板行为 → **应该发版**

更直接的判断：

- 用户拿到新代码后，需要重新理解“怎么部署、怎么更新、怎么调用” → 发版
- 用户拿到新代码后，只是仓库内部更干净了 → 可以不发版

## 版本号统一修改位置

当前版本号有 4 个正式位置：

1. [`package.json`](../package.json)
2. [`sdk/nodejs/package.json`](../sdk/nodejs/package.json)
3. [`sdk/python/pyproject.toml`](../sdk/python/pyproject.toml)
4. [`shared/app-release.ts`](../shared/app-release.ts)

不要手动逐个修改，直接用：

```bash
pnpm set:version <x.y.z>
```

这个命令只做一件事：把指定的版本号同步到上述 4 个位置，不做自动递增。

### 版本号和 Release 必须对齐

只要 `pnpm set:version <x.y.z>` 已经进入默认分支，并且这次变更不是纯私有实验，就必须在同一次发版流程里创建对应的 GitHub Release：

- 代码内版本：`<x.y.z>`
- GitHub Release tag：`v<x.y.z>`

禁止停在“版本号已经改成 `<x.y.z>`，线上也已经部署，但 GitHub 最新 Release 还停在旧版本”的状态。这样会造成后台版本检查、SDK Release 附件和外部用户可见版本全部不一致。

如果只是维护者自用、不准备对外发版，不要提前运行 `pnpm set:version`。先按普通部署流程 push / deploy；等决定正式发版时，再进入本文档流程统一改版本号、写 changelog、创建 Release。

## 发布前检查

每次发布前至少做这些：

1. 跑完 `pnpm test`
2. 跑完 `pnpm build`
3. 跑完 `pnpm check:scripts`
4. 如果改了 Python SDK，再跑 `pnpm check:python`
5. 跑完 `python -m pip install build`
6. 跑完 `pnpm build:sdk:artifacts`
7. 跑完 `pnpm check:sdk:artifacts`
8. 检查 `CHANGELOG.md`
9. 检查有没有新增 migration
10. 检查 `DOCS/STATUS.md` 是否还是现场事实

## GitHub workflow 与发版边界

发布时要区分两条线：

1. **默认分支 push 线**
   - 触发 `CI`
   - 按路径触发 `Deploy Worker` / `Deploy Frontend`
   - 更新 Cloudflare 上正在运行的 Worker / Pages
   - **不会**自动创建 GitHub Release

2. **GitHub Release 线**
   - 由维护者手动创建 Release，推荐用 `gh release create`
   - 触发 `Release SDK Assets`
   - 上传 Node.js `.tgz`、Python `.whl`、Python `.tar.gz`
   - 成为后台更新提醒识别的正式版本来源
   - **不会**替你部署 Cloudflare

`Release SDK Assets` 的定位很窄：**只给已经 published 的 Release 构建并挂载 SDK 附件**。它不会创建 Release，也不应该承担发版决策。

## 发布步骤

按以下顺序执行：

1. 确认工作区干净，没有未提交的改动
2. 判断本次是否值得发版，征询用户同意后方可继续
3. 运行 `pnpm set:version <x.y.z>`
4. 更新 `CHANGELOG.md`
5. 检查 README、DEPLOY、RUNBOOK、UPDATE 中与本次版本相关的说明
6. 执行发布前检查
7. 提交版本号、`CHANGELOG.md` 和文档变更
8. push 到默认分支，等待 `CI` 和必要的部署 workflow 成功
9. 创建 GitHub Release（推荐 `gh release create`，由它在目标分支上创建 tag）
10. 等 `Release SDK Assets` workflow 把 SDK 附件挂到当前 Release
11. 校验 GitHub 最新 Release tag 等于本次版本号
12. 检查 Release 页面是否已经出现源码包和 SDK 附件

推荐命令顺序：

```bash
VERSION=<x.y.z>
git status
pnpm set:version "$VERSION"
# 手动更新 CHANGELOG.md、README.md 和 DOCS/ 中与本次版本相关的内容
pnpm test
pnpm build
pnpm check:scripts
pnpm check:python
python -m pip install build
pnpm build:sdk:artifacts
pnpm check:sdk:artifacts
git add --all
git commit -m "发布${VERSION}版本"
git push origin <default-branch>
gh release create "v${VERSION}" --target <default-branch> --title "v${VERSION}" --notes-file <release-notes-file>
gh release view "v${VERSION}"
gh release list --limit 1
gh run list --workflow "Release SDK Assets" --limit 5
```

如果不用 `gh` CLI，也可以在 GitHub 网页上创建 Release：

1. tag 名使用 `v<x.y.z>`
2. target 选择刚刚 push 的默认分支 commit
3. Release 内容填写本次发布说明
4. 发布后等待 `Release SDK Assets` 自动运行

也可以先手动 `git tag` / `git push origin v<x.y.z>`，再基于这个 tag 创建 Release；但当前推荐路径是直接让 `gh release create` 在目标分支上创建 tag，减少“tag 已推送但 Release 未发布”的中间状态。

## 发布后验收

发布后不要只看部署 workflow 成功，还要确认正式版本源已经对齐：

```bash
VERSION=<x.y.z>
VERSION="$VERSION" node --import tsx --input-type=module -e 'const moduleValue = await import("./shared/app-release.ts"); const appRelease = moduleValue.APP_VERSION ? moduleValue : moduleValue.default; const { APP_VERSION } = appRelease; if (APP_VERSION !== process.env.VERSION) throw new Error(`APP_VERSION=${APP_VERSION}, expected=${process.env.VERSION}`)'
gh release view "v${VERSION}" --json tagName,isDraft,isPrerelease,publishedAt,url
gh release list --limit 1
gh run list --workflow "Release SDK Assets" --limit 5
```

验收标准：

- `shared/app-release.ts` 中的 `APP_VERSION` 等于 `<x.y.z>`
- `gh release view v<x.y.z>` 能查到已发布 Release，且不是 draft / prerelease
- `gh release list --limit 1` 的第一条就是 `v<x.y.z>`
- `Release SDK Assets` 已成功结束
- Release assets 里已经有 Node.js 和 Python SDK 附件

如果发现当前实例版本高于 GitHub 最新正式 Release，说明这次发版漏了 GitHub Release。处理方式不是改后台提示文案，而是补发对应版本的 Release，并确认 SDK 附件 workflow 成功。

## 发版发的是什么

现在的正式发布，发的是三部分：

1. **源码版本**
   - Git tag
   - GitHub Release
   - GitHub 自动生成的 source tarball / zipball

2. **SDK 安装产物**
   - Node.js SDK：`onlymail-sdk-nodejs-<version>.tgz`
   - Python SDK：`onlymail_sdk-<version>-py3-none-any.whl`
   - Python SDK：`onlymail_sdk-<version>.tar.gz`

3. **发布说明**
   - 这次版本做了什么
   - 用户要不要重新部署
   - 用户要不要手工处理数据或配置

当前发版的本质：**发布源码 + SDK 安装包，不单独发 npm / PyPI。**

## GitHub Release 要写什么

Release 页面至少写清楚这几件事：

- 当前版本号
- 这次新增了什么
- 这次改了什么
- 是否有破坏性变更
- 是否需要手工操作
- 当前 Release 附带了哪些 SDK 安装包
- 文档入口：
  - `README.md`
  - `DOCS/DEPLOY.md`
  - `DOCS/RUNBOOK.md`
  - `DOCS/UPDATE.md`

创建 Release 后必须再确认两件事：

1. `Release SDK Assets` workflow 已成功结束
2. Release assets 中至少有：
   - `onlymail-sdk-nodejs-<version>.tgz`
   - `onlymail_sdk-<version>-py3-none-any.whl`
   - `onlymail_sdk-<version>.tar.gz`

## 当前阶段 release note 建议重点

现在的 release note 至少应覆盖这些用户真正会关心的变化：

- 三条部署路径（本地 / GitHub-only / 混合）有没有新增前置条件、命令边界或人工步骤
- 两种收件域模式有没有变化：根域名直收、managed subdomain 生命周期 / 自动回收 / 脏状态对账
- 管理员面板和 SDK 的权限边界有没有变化（`/api/*` vs `/call/*`）
- 更新方式有没有变化：Upstream Sync、后台更新提醒、是否需要手动 `rebuild`
- SDK Release 附件、安装方式和兼容性有没有变化

## 数据库变更要求

只要版本里有数据库结构改动：

1. 新增 migration 文件
2. 写清楚是否兼容旧数据
3. 如果需要人工介入，写进 `CHANGELOG.md`
4. 如果是破坏性迁移，升 `MAJOR`

## 破坏性变更记录

以下情况都按破坏性变更处理：

- 公开 API 路径或返回结构改动
- SDK 方法签名改动
- 配置项删除或重命名
- 需要用户手工处理数据或重新部署

这类变更必须同时更新：

- `CHANGELOG.md`
- `DOCS/STATUS.md`
- 对应的 `DOCS/DECISIONS/*.md` 或 `DOCS/PLANS/*.md`

## SDK 版本关系

当前主仓库和 SDK 保持同节奏发布：

- Node.js SDK
- Python SDK
- 主项目

后续如果 SDK 发布节奏独立，再单独拆分版本规则。
