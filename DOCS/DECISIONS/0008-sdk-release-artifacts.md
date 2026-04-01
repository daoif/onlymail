# 0008: SDK 正式分发改为 Release 附件

## 状态
已实施

## 背景
Node.js SDK 之前主推 `pnpm` 的 Git 仓库子目录安装，Python SDK 之前主推 `pip` 的 Git 子目录安装。

这条路有两个问题：

1. Node.js 会把消费方绑定到 `pnpm`
2. 外部项目很容易把它误用成机器相关的本地 `file:` 路径，安装方式不可移植

## 决策
SDK 当前不发 npm / PyPI。

正式发布版统一改成通过 GitHub Release 附件分发：

- Node.js：发布 `.tgz`
- Python：同时发布 `.whl` 和 `.tar.gz`

Git 仓库子目录安装继续保留，但只作为未发版代码的开发入口，不再当正式分发方式。

## 理由
1. **不绑定包管理器**：Node.js 用户不需要为了装 SDK 额外切到 `pnpm`
2. **不急着上 registry**：在版本节奏和发布流程还没完全独立前，先不引入 npm / PyPI 运维成本
3. **和主仓库 Release 对齐**：用户只认正式 GitHub Release，就能同时拿到源码版本和 SDK 安装文件
4. **更容易验证**：CI 可以直接构建附件，再在临时项目里做本地安装冒烟测试

## 影响
- 新增 `Release SDK Assets` workflow，在正式 Release 发布后自动上传 SDK 附件
- CI 新增 SDK 产物构建和安装冒烟验证
- README、RUNBOOK、RELEASING 和 SDK 文档统一改成 Release 附件为主、仓库子目录为辅
