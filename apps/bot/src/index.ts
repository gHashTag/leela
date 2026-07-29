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
import { DatabaseRoomStore } from './persistence';
import { MemoryReportSink, MemoryRoomStore, type ReportSink, type RoomStore } from './store';
import { SqliteRoomQueries, sqliteReportSink } from './sqlite';
import { supervise } from './supervisor';

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error(
    'BOT_TOKEN is not set.\n' +
      'Get one from @BotFather, then: BOT_TOKEN=... bun run src/index.ts',
  );
  process.exit(1);
}

/**
 * Where games live.
 *
 * With LEELA_DB set they survive a restart; without it they do not, and the
 * process says which it is rather than losing them quietly.
 */
const databasePath = process.env.LEELA_DB;

let store: RoomStore;
let reports: ReportSink;
let durable = false;

/** How long a finished table is kept before it is forgotten. */
const KEEP_FINISHED_MS = 7 * 24 * 60 * 60 * 1000;

if (databasePath) {
  const queries = new SqliteRoomQueries({ path: databasePath });
  store = new DatabaseRoomStore(queries);
  reports = sqliteReportSink(queries);
  durable = true;

  // Nothing deleted a finished game, so every table ever opened stayed. Done
  // at startup rather than on a timer: a bot that is never restarted is not
  // accumulating tables either.
  const forgotten = queries.pruneFinished(KEEP_FINISHED_MS);
  if (forgotten > 0) {
    console.log(`Forgot ${forgotten} finished table(s) older than a week. Reports kept.`);
  }
} else {
  store = new MemoryRoomStore();
  reports = new MemoryReportSink();
}

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
console.log(
  durable
    ? `Leela bot starting. Games and reports are kept in ${databasePath}.`
    : 'Leela bot starting. Games and reports are held in memory and will not survive a restart.\n' +
        'Set LEELA_DB to a file path to keep them.',
);
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
