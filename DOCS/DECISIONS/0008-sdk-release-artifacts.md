# 0008: SDK 改用 Release 附件分发

## 状态
已实施

## 背景
之前 Node.js 和 Python SDK 都推荐从 Git 仓库子目录安装。这样做有两个问题：

1. Node.js 这条路只有 `pnpm` 能走通，把消费方绑死在一个包管理器上
2. 实际使用中很容易被误写成本地 `file:` 路径，换台机器就装不上

## 决策
SDK 当前不发 npm / PyPI。

正式发布版统一改成通过 GitHub Release 附件分发：

- Node.js：发布 `.tgz`
- Python：同时发布 `.whl` 和 `.tar.gz`

仓库子目录安装继续保留，但只给开发用，不再当正式分发方式。

## 理由
1. **不绑包管理器** — npm / pnpm / yarn / bun 都能装 tarball
2. **不急着上 registry** — 版本节奏还没独立，先不引入 npm / PyPI 运维成本
3. **和 Release 对齐** — 用户只看 GitHub Release，就能拿到源码和 SDK
4. **容易验证** — CI 直接构建产物，再在临时项目里做安装冒烟测试

## 影响
- 新增 `Release SDK Assets` workflow，在正式 Release 发布后自动上传 SDK 附件
- CI 新增 SDK 产物构建和安装冒烟验证
- README、RUNBOOK、RELEASING 和 SDK 文档统一改成 Release 附件为主、仓库子目录为辅
