import prisma from "./libs/prisma"
import { EmbedBuilder, Colors } from "discord.js"
import cron from 'node-cron'
import Turndown from 'turndown';
import { notification } from "@prisma/client";
const turndown = new Turndown();
import { r } from './libs/reddit'
import { webhookClient } from './libs/discord'
import axios from 'axios'
import { IEvent, IStrapiResponse } from "..";
import { format, intervalToDuration } from "date-fns";

const cache = new Map();

async function getEndingEvents() {
  console.log('Searching for ending events...')
  const { data: events } = await axios.get<IStrapiResponse<IEvent>>(`https://strapi.nierrein.guide/api/events?sort[0]=end_date:asc&populate=*&pagination[pageSize]=20&filters[start_date][$lte]=${new Date().toISOString()}&filters[end_date][$gte]=${new Date().toISOString()}`)

  const endingEvents = events.data.filter((event) => {
    const interval = intervalToDuration({
      start: new Date(),
      end: new Date(event.attributes.end_date)
    })

    if (interval.days === 3 && !cache.has(event.id)) {
      return true
    }

    return false
  })

  console.log(`Found ${endingEvents.length} events.`)

  for (const event of endingEvents) {
    const interval = intervalToDuration({
      start: new Date(),
      end: new Date(event.attributes.end_date)
    })
    const entry = event.attributes

    const embed = new EmbedBuilder()
      .setTitle(`Event ending soon: ${entry.title}`)
      .setURL(`https://nierrein.guide/event/${entry.slug}`)
      .setImage(entry.image.data.attributes.url)
      .setColor(Colors.Red)

    const startDate = format(new Date(entry.start_date), 'd MMM yyyy')
    const endDate = format(new Date(entry.end_date), 'd MMM yyyy')
    let description = `:warning: Event ending in ${interval.days} days!\nEvent period: ${startDate} - ${endDate}`

    if (entry.gems > 0) {
      description += `\nTotal gems obtainable: <:gem:1069908865891704842> ${entry.gems}`
    }

    embed.setDescription(description)

    await webhookClient.send({
      embeds: [embed]
    })

    cache.set(event.id, event)

    console.log(`[Discord] Published "${event.attributes.title}"`)

    await wait(10000);
  }

  console.log(cache)
}

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

    await wait(10000)
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

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  })
}

// Every 10 minutes
cron.schedule('0 */10 * * * *', getNotices).start();

// Every hour
cron.schedule('0 0 * * * *', getEndingEvents).start();

getNotices();
getEndingEvents();