# Node.js SDK

```ts
import { MailsClient } from '@mails/sdk-nodejs'

const client = new MailsClient('http://127.0.0.1:8787', process.env.MAILS_API_KEY!)
const created = await client.createAddress('demo@m1.example.com', 'demo', 24)
const mail = await client.waitForMail(created.data.address.name, 60_000, 3_000)
console.log(mail.subject)
```
