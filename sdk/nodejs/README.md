# Node.js SDK

## 安装

正式发布版主推荐直接安装 GitHub Release 附件里的 `.tgz` 包。

```bash
npm install "https://github.com/<owner>/<repo>/releases/download/v<version>/onlymail-sdk-nodejs-<version>.tgz"
```

这条安装方式不绑包管理器，`npm`、`pnpm`、`yarn`、`bun` 都可以直接装同一个 tarball。

如果你要直接跟未发版的仓库代码，再走 `pnpm` 的 Git 子目录安装：

```bash
pnpm add "git+https://github.com/<owner>/<repo>.git#<ref>&path:/sdk/nodejs"
```

这条路径要求你的项目用 `pnpm`。  
`npm` 官方文档只保证 Git 依赖直接指向仓库根目录里的包，不保证这种子目录安装方式，所以这里只把它当开发版入口。

如果你想把依赖直接写进 `package.json`：

```json
{
  "dependencies": {
    "@onlymail/sdk-nodejs": "https://github.com/<owner>/<repo>/releases/download/v<version>/onlymail-sdk-nodejs-<version>.tgz"
  }
}
```

## 用法

```ts
import { OnlyMailClient } from '@onlymail/sdk-nodejs'

const client = new OnlyMailClient('https://your-worker.your-account.workers.dev', process.env.ONLYMAIL_API_KEY!)
const created = await client.createAddress('demo@m1.example.com', 'demo', 24)
const mail = await client.waitForMail(created.address.name, 60_000, 3_000)
console.log(mail.subject)
```

这个 SDK 只面向你自己部署的实例：
- 第一个参数是你自己的后端地址
- 第二个参数是你在后台设置页生成的 API Key

后端地址的选择顺序：
- 正式环境优先用你自己绑定的 Worker API 自定义域名
- 没绑自定义域名时，用默认 `workers.dev` 地址
