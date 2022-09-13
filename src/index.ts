import prisma from "./libs/prisma"
import { WebhookClient } from "discord.js"
import { convert } from 'html-to-text'
import { env } from "./env";
import cron from 'node-cron'


const webhookClient = new WebhookClient({
  url: env.WEBHOOK_URL
})

async function getNotices() {
  console.log('Searching for new notices...')
  let existsCount = 0;
  let publishedCount = 0;
  const notices = await prisma.dump.notification.findMany()

  /**
   * Database is being updated at the same time, cancel the operation
   */
  if (notices.length === 0) {
    return console.warn('Database is empty. Canceled operation.')
  }

  const existsFetches = notices.map(async (notice) => {
    const isExists = await prisma.nrg.notification.findUnique({
      where: {
        notification_id: notice.notification_id,
      }
    })

    return {
      isExists: !!isExists,
      notice
    }
  })

  const existsNotices = await Promise.all(existsFetches)

  const noticesToPublish = existsNotices
    .filter((notice) => !notice.isExists)

  console.log(noticesToPublish)


  for (const notification of noticesToPublish) {
    const { notice } = notification
    /**
     * Post on Discord
     */
    const text = convert(notice.body as string, {
      wordwrap: 130,

    })

    const thumbnailUrl = notice.thumbnail_path?.replace(
      "/images/",
      "https://web.app.nierreincarnation.com/images/"
    )

    const files: {
      attachment: string;
      name: string;
    }[] = []

    if (thumbnailUrl) {
      files.push({
        attachment: thumbnailUrl,
        name: 'thumbnail.jpg'
      })
    }

    try {
      await webhookClient.send({
        content: text,
        files,
      })
      console.log(`Published "${notice.notification_id}" (date: ${notice.release_time}).`)

      await prisma.nrg.notification.create({
        data: notice
      })
      console.log('Added to db')
    } catch (error) {
      console.error(error)
    }

    publishedCount++
  }

  if (publishedCount > 0) {
    console.log(`Published ${publishedCount} notices.`)
  } else {
    console.log('Nothing to publish.')
  }
}


cron.schedule('0 0 * * * *', getNotices).start();