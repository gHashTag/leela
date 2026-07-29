/**
 * Entry point.
 *
 * Reads the token from the environment and nowhere else — no token is ever
 * committed, and the process refuses to start without one rather than failing
 * halfway through the first update.
 *
 *   BOT_TOKEN=... bun run src/index.ts
 */

import { Guide, openRouter } from '@leela/ai';
import { createBot } from './bot';
import { MemoryReportSink, MemoryRoomStore } from './store';
import { supervise } from './supervisor';

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error(
    'BOT_TOKEN is not set.\n' +
      'Get one from @BotFather, then: BOT_TOKEN=... bun run src/index.ts',
  );
  process.exit(1);
}

const store = new MemoryRoomStore();
const reports = new MemoryReportSink();

/**
 * The companion is optional on purpose. Without a key the gate still works and
 * reports are still kept — the reflection is the game, and the companion is a
 * help with it, not a requirement for it.
 */
const openRouterKey = process.env.OPENROUTER_API_KEY;
const guide = openRouterKey
  ? new Guide({
      model: openRouter({
        apiKey: openRouterKey,
        model: process.env.OPENROUTER_MODEL,
        referer: 'https://github.com/gHashTag/leela',
        title: 'Leela',
      }),
    })
  : undefined;

const bot = createBot({ token, store, reports, guide });

// Rooms live in memory here. `DatabaseRoomStore` in persistence.ts is the
// durable one — it needs a `RoomQueries` implementation and a database, so
// wiring it is a deployment decision rather than a default. Say plainly what
// this process does rather than losing games quietly.
console.log('Leela bot starting. Rooms and reports are held in memory and will not survive a restart.');
console.log(
  guide
    ? 'A companion is configured and will respond to reports.'
    : 'No OPENROUTER_API_KEY: reports are kept, but nothing will respond to them.',
);

let stopping = false;
const stop = () => {
  stopping = true;
  console.log('\nStopping.');
  void bot.stop();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

// `bot.catch` handles a failing update; it does not handle a failing poll. A
// dropped socket, or a second process calling getUpdates, throws out of the run
// loop — so the loop is supervised rather than awaited directly.
await supervise({
  start: async () => {
    if (stopping) return;
    await bot.start({
      onStart: (info) => console.log(`Listening as @${info.username}.`),
    });
  },
});
