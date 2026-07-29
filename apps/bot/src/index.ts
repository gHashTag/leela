/**
 * Entry point.
 *
 * Reads the token from the environment and nowhere else — no token is ever
 * committed, and the process refuses to start without one rather than failing
 * halfway through the first update.
 *
 *   BOT_TOKEN=... bun run src/index.ts
 */

import { createBot } from './bot';
import { MemoryRoomStore } from './store';

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error(
    'BOT_TOKEN is not set.\n' +
      'Get one from @BotFather, then: BOT_TOKEN=... bun run src/index.ts',
  );
  process.exit(1);
}

const store = new MemoryRoomStore();
const bot = createBot({ token, store });

// Rooms live in memory, so say so plainly rather than losing games quietly.
console.log('Leela bot starting. Rooms are held in memory and will not survive a restart.');

const stop = () => {
  console.log('\nStopping.');
  void bot.stop();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

await bot.start({
  onStart: (info) => console.log(`Listening as @${info.username}.`),
});
