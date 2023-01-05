import { WebhookClient } from "discord.js"
import { env } from "../env"

const webhookClient = new WebhookClient({
  url: env.WEBHOOK_URL
})

export {
  webhookClient
}