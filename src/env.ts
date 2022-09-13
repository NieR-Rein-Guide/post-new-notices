import { envsafe, str } from "envsafe";

export const env = envsafe({
  NODE_ENV: str({
    devDefault: 'development',
    choices: ['development', 'production']
  }),
  WEBHOOK_URL: str({
    desc: 'The Discord webhook URL you want to post notices to.',
  }),
  DATABASE_URL: str({
    desc: 'Dump database (weapons, costumes...)',
  }),
  NIERREINGUIDE_DATABASE_URL: str({
    desc: 'Main database (loadouts...)'
  }),
})