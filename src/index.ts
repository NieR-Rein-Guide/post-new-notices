import prisma from "./libs/prisma"
import { EmbedBuilder, Colors } from "discord.js"
import cron from 'node-cron'
import Turndown from 'turndown';
import { notification } from "@prisma/client";
const turndown = new Turndown();
import { r } from './libs/reddit'
import { webhookClient } from './libs/discord'

async function getNotices() {
  console.log('Searching for new notices...')
  const savedNotices = await prisma.nrg.notification.findMany({
    orderBy: {
      release_time: 'desc',
    }
  })

  /**
   * Database is being updated at the same time, cancel the operation
  */
 if (savedNotices.length === 0) {
   return console.warn('[ABORT] Database is being updated.')
  }

  const newNotices = await prisma.dump.notification.findMany({
    where: {
      notification_id: {
        notIn: savedNotices.map((notice) => notice.notification_id)
      }
    },
    orderBy: {
      release_time: 'desc',
    }
  })

  if (newNotices.length === 0) {
    return console.log('No new notices.')
  }

  for (const notice of newNotices) {
    try {
      await publishOnReddit(notice)
      await publishOnDiscord(notice)

      await prisma.nrg.notification.create({
        data: notice
      })
    } catch (error) {
      console.log('Could not send notice', notice, error)
    }
  }

  console.log(`Published ${newNotices.length} notices.`)
}

/**
 * Publish notice on Discord webhook channel
 *
 * @param notice {notification}
 */
async function publishOnDiscord(notice: notification) {
  const thumbnailUrl = notice.thumbnail_path?.replace(
    "/images/",
    "https://web.app.nierreincarnation.com/images/"
  )

  const files: {
    attachment: string;
    name: string;
  }[] = []

  const embed = new EmbedBuilder()
    .setTitle(notice.title)
    .setURL(`https://nierrein.guide/notice/${notice.notification_id}`)
    .setTimestamp(notice.release_time)
    .setColor(Colors.Blurple)

  if (thumbnailUrl) {
    embed.setThumbnail(thumbnailUrl)
    files.push({
      attachment: thumbnailUrl,
      name: 'thumbnail.jpg'
    })
  }

  await webhookClient.send({
    embeds: [embed],
    files
  })

  console.log(`[Discord] Published "${notice.notification_id}" (date: ${notice.release_time}).`)
}

/**
 * Publish a notice on Reddit
 * Try posting again if rate limited
 *
 * @param notice {notification}
 */
async function publishOnReddit(notice: notification) {
  // 15 min delay if rate limited
  let delay = 900000;

  const markdown = turndown.turndown(notice.body?.replace(
    /images/g,
    "https://web.app.nierreincarnation.com/images"
  ) ?? 'Empty notice.')

  try {
    // @ts-expect-error
    await r.submitSelfpost({
      subredditName: 'r/NieRReincarnation',
      text: markdown,
      title: `[NOTICE] ${notice.title}`,
    })
    console.log(`[REDDIT] Published post ${notice.notification_id}. (date: ${notice.release_time}).`)
  } catch (error) {
    setTimeout(async () => {
      // @ts-expect-error
      await r.submitSelfpost({
        subredditName: 'r/NieRReincarnation',
        text: markdown,
        title: `[NOTICE] ${notice.title}`,
      }).catch((err) => console.error('[REDDIT] Error while resubmitting post.', err))

      console.log(`[REDDIT] Retried: Published post ${notice.notification_id}.`)
    }, delay);

    delay += 900000
  }
}


cron.schedule('0 0 * * * *', getNotices).start();

getNotices();