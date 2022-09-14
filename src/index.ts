import prisma from "./libs/prisma"
import { WebhookClient, EmbedBuilder, Embed } from "discord.js"
import { convert } from 'html-to-text'
import { env } from "./env";
import cron from 'node-cron'
import Splitter from './libs/Splitter';


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


  for (const notification of noticesToPublish) {
    const { notice } = notification
    /**
     * Post on Discord
     */
     const thumbnailUrl = notice.thumbnail_path?.replace(
      "/images/",
      "https://web.app.nierreincarnation.com/images/"
    )

    const text = convert(notice.body as string, {
      wordwrap: 130,
    })

    const messages = Splitter.splitMessage(text)
    const files: {
      attachment: string;
      name: string;
    }[] = []

    const embed = new EmbedBuilder()
      .setTitle(notice.title)
      .setTimestamp(notice.release_time)

      if (thumbnailUrl) {
        embed.setThumbnail(thumbnailUrl)
        files.push({
          attachment: thumbnailUrl,
          name: 'thumbnail.jpg'
        })
      }

    if (messages.length > 1) {
      try {
        await prisma.nrg.notification.create({
          data: notice
        })
        console.log(`${notice.notification_id} added to db.`)

        for (const message of messages) {
          const content = EmbedBuilder.from(embed)
            .setDescription(message)

          await webhookClient.send({
            embeds: [content],
            files
          })
          console.log(`Published "${notice.notification_id}" (date: ${notice.release_time}).`)
        }
      } catch (error) {
        console.error(error)
      }
    } else {
      try {
        await prisma.nrg.notification.create({
          data: notice
        })
        console.log(`${notice.notification_id} added to db.`)

        const content = EmbedBuilder.from(embed)
          .setDescription(messages[0])

        await webhookClient.send({
          embeds: [content],
          files
        })
        console.log(`Published "${notice.notification_id}" (date: ${notice.release_time}).`)

      } catch (error) {
        console.error(error)
      }
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

getNotices();