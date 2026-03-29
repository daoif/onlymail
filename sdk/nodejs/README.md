# Node.js SDK

## 安装

主推荐方式是用 `pnpm` 直接从 GitHub 仓库安装子目录包。

```bash
pnpm add "git+https://github.com/<owner>/<repo>.git#master&path:/sdk/nodejs"
```

如果你要固定到某个 tag、分支或 commit，把 `master` 换成对应引用即可：

```bash
pnpm add "git+https://github.com/<owner>/<repo>.git#<ref>&path:/sdk/nodejs"
```

这条路径要求你的项目用 `pnpm`。  
`npm` 官方文档只保证 Git 依赖直接指向仓库根目录里的包，不保证这种子目录安装方式。

如果你想把依赖直接写进 `package.json`：

```json
{
  "dependencies": {
    "@mails/sdk-nodejs": "git+https://github.com/<owner>/<repo>.git#master&path:/sdk/nodejs"
  }
}
```

## 用法

```ts
import { MailsClient } from '@mails/sdk-nodejs'

const client = new MailsClient('https://your-worker.your-account.workers.dev', process.env.MAILS_API_KEY!)
const created = await client.createAddress('demo@m1.example.com', 'demo', 24)
const mail = await client.waitForMail(created.data.address.name, 60_000, 3_000)
console.log(mail.subject)
```

这个 SDK 只面向你自己部署的实例：
- 第一个参数是你自己的后端地址
- 第二个参数是你在后台设置页生成的 API Key

后端地址的选择顺序：
- 正式环境优先用你自己绑定的 Worker API 自定义域名
- 没绑自定义域名时，用默认 `workers.dev` 地址
