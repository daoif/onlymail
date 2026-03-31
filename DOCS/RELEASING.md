# 发布流程

这份文档只说一件事：OnlyMail 准备正式发布时，按什么顺序做。

## 发布前先看哪里

先按这个顺序看：

1. `DOCS/STATUS.md`
   先确认当前状态、已知风险和最近变更是不是现场事实。
2. `CHANGELOG.md`
   先把这次版本真正交付了什么写清楚。
3. `DOCS/UPDATE.md`
   确认更新路径说明和这次 release 的行为没有冲突。

## 版本规则

项目按语义化版本推进：

- `MAJOR`：破坏性变更、迁移成本明显变化
- `MINOR`：向后兼容的新功能
- `PATCH`：向后兼容的问题修复和文档修正

首个公开版本固定为：

- `v0.1.0`

## 什么时候需要发版

先用这个标准判断：

- 只改了本地注释、未对外暴露的重构、临时实验代码，不需要发版
- 改了文档，但不会影响用户部署、使用、升级理解，一般不需要单独发版
- 只修了仓库内部维护脚本，但不会影响用户部署、升级、运行，一般不需要单独发版
- 只要影响到用户的部署、升级、运行、接口、SDK、管理面板行为，就应该发版

更直接一点：

- 用户拿到新代码后，需要重新理解“怎么部署、怎么更新、怎么调用”，就发版
- 用户拿到新代码后，只是仓库内部更干净了，不发版也行

## 版本号统一改哪里

当前版本号有 4 个正式位置：

1. [package.json](../package.json)
2. [sdk/nodejs/package.json](../sdk/nodejs/package.json)
3. [sdk/python/pyproject.toml](../sdk/python/pyproject.toml)
4. [shared/app-release.ts](../shared/app-release.ts)

不要手动一个个改。直接用：

```bash
pnpm set:version 0.1.0
```

这个命令只做一件事：把你指定的版本号同步到上面 4 个位置，不做自动递增。

## 发布前检查

每次发布前至少做这些：

1. 跑完 `pnpm test`
2. 跑完 `pnpm build`
3. 跑完 `pnpm check:scripts`
4. 如果改了 Python SDK，再跑 `pnpm check:python`
5. 检查 `CHANGELOG.md`
6. 检查有没有新增 migration
7. 检查 `DOCS/STATUS.md` 是否还是现场事实

## 发布步骤

按这个顺序做：

1. 确认工作区干净，没有未提交改动
2. 先判断这次是不是值得发版,征询用户已经,需得到授权.
3. 如果要发版，先运行 `pnpm set:version <x.y.z>`
4. 更新 `CHANGELOG.md`
5. 检查 README、DEPLOY、RUNBOOK、UPDATE 里和这次版本相关的说明
6. 跑一遍发布前检查
7. 创建 tag
8. 推送 tag
9. 在 GitHub 上创建 Release

本地命令顺序：

```bash
git status
pnpm set:version 0.1.0
pnpm test
pnpm build
pnpm check:scripts
pnpm check:python
git tag v0.1.0
git push origin v0.1.0
```

## 发版发的是什么

当前项目没有单独需要上传的“安装包产物”作为正式发布主体。

现在的正式发布，发的是两部分：

1. **源码版本**
   - Git tag
   - GitHub Release
   - GitHub 自动生成的 source tarball / zipball

2. **发布说明**
   - 这次版本做了什么
   - 用户要不要重新部署
   - 用户要不要手工处理数据或配置

所以当前发版的本质就是：

**发布源码版本，而不是发布一套独立二进制安装包。**

SDK 现在也是跟着主仓库源码走，没有独立发 npm / PyPI。

## GitHub Release 要写什么

Release 页面至少写清楚这几件事：

- 当前版本号
- 这次新增了什么
- 这次改了什么
- 是否有破坏性变更
- 是否需要手工操作
- 文档入口：
  - `README.md`
  - `DOCS/DEPLOY.md`
  - `DOCS/RUNBOOK.md`
  - `DOCS/UPDATE.md`

## 这次首发建议写法

`v0.1.0` 的 release note 至少应包含：

- OnlyMail 已完成本地部署、GitHub-only 部署、混合部署三条主路径
- 平台状态模型固定成 `4 + 1`
- 后台登录改成 D1 管理的管理员会话
- GitHub 自动更新和后台版本提醒都已接通
- Node.js / Python SDK 已完成真实安装和真实调用验证

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

当前主仓库和 SDK 版本先保持同节奏发布：

- Node.js SDK
- Python SDK
- 主项目

后面如果 SDK 发布节奏独立，再单独拆版本规则。
