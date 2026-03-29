import type { AppBindings } from './types'

import { findAddressByName, touchAddress } from './services/address'
import { saveIncomingMail } from './services/mail'

export async function handleEmail(message: ForwardableEmailMessage, env: AppBindings, ctx: ExecutionContext) {
  const recipient = message.to.trim().toLowerCase()
  const address = await findAddressByName(env, recipient)
  if (!address) {
    return
  }

  await saveIncomingMail(env, recipient, message)
  ctx.waitUntil(touchAddress(env, recipient))
}
