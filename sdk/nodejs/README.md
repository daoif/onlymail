# Node.js SDK

## 安装

推荐直接装 GitHub Release 附件里的 `.tgz`：

```bash
npm install "https://github.com/<owner>/<repo>/releases/download/v<version>/onlymail-sdk-nodejs-<version>.tgz"
```

`npm`、`pnpm`、`yarn`、`bun` 都能装。

要跟未发版代码，可以用 `pnpm` 从仓库子目录装（需要项目本身用 pnpm）：

```bash
pnpm add "git+https://github.com/<owner>/<repo>.git#<ref>&path:/sdk/nodejs"
```

写进 `package.json`：

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

创建子域名时，SDK 默认创建参与轮换的临时子域名；如果要长期保留，传第三个参数：

```ts
await client.createSubdomain('m1.example.com', undefined, 'permanent')
```

这个 SDK 只面向你自己部署的实例：
- 第一个参数是你自己的后端地址
- 第二个参数是你在后台设置页生成的 API Key

后端地址的选择顺序：
- 正式环境优先用你自己绑定的 Worker API 自定义域名
- 没绑自定义域名时，用默认 `workers.dev` 地址
