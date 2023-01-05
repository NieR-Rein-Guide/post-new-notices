import snoowrap from 'snoowrap';
import { env } from "../env";

const r = new snoowrap({
  userAgent: 'NieRReincarnation Notices v0.0.1',
  clientId: env.REDDIT_CLIENT_ID,
  clientSecret: env.REDDIT_CLIENT_SECRET,
  refreshToken: env.REDDIT_REFRESH_TOKEN,
});

export {
  r
}