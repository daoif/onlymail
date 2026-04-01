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

首个公开版本固定为：

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
pnpm set:version 0.1.0
```

这个命令只做一件事：把指定的版本号同步到上述 4 个位置，不做自动递增。

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

## 发布步骤

按以下顺序执行：

1. 确认工作区干净，没有未提交的改动
2. 判断本次是否值得发版，征询用户同意后方可继续
3. 运行 `pnpm set:version <x.y.z>`
4. 更新 `CHANGELOG.md`
5. 检查 README、DEPLOY、RUNBOOK、UPDATE 中与本次版本相关的说明
6. 执行发布前检查
7. 创建 tag
8. 推送 tag
9. 在 GitHub 上创建 Release
10. 等 `Release SDK Assets` workflow 把 Node.js `.tgz` 和 Python `.whl` / `.tar.gz` 附件挂到当前 Release

本地命令顺序：

```bash
git status
pnpm set:version 0.1.0
pnpm test
pnpm build
pnpm check:scripts
pnpm check:python
python -m pip install build
pnpm build:sdk:artifacts
pnpm check:sdk:artifacts
git tag v0.1.0
git push origin v0.1.0
```

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

因此当前发版的本质是：

**发布源码版本 + SDK 安装附件，而不是单独发 npm / PyPI。**

## GitHub Release 要写什么

Release 页面至少写清楚这几件事：

- 当前版本号
- 这次新增了什么
- 这次改了什么
- 是否有破坏性变更
- 是否需要手工操作
- 当前 Release 附带了哪些 SDK 安装文件
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

当前主仓库和 SDK 保持同节奏发布：

- Node.js SDK
- Python SDK
- 主项目

后续如果 SDK 发布节奏独立，再单独拆分版本规则。
