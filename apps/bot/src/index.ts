/**
 * Entry point.
 *
 * Reads the token from the environment and nowhere else — no token is ever
 * committed, and the process refuses to start without one rather than failing
 * halfway through the first update.
 *
 *   BOT_TOKEN=... bun run src/index.ts
 */

import { Guide, deepSeek, openAI, openRouter, type LanguageModel } from '@leela/ai';
import { LANGUAGES, messageCoverage, messageIssues, translatedLanguages } from '@leela/content';
import { createBot } from './bot';
import { DatabaseRoomStore } from './persistence';
import {
  MemoryReportSink,
  MemoryRoomStore,
  type ReportSink,
  type RoomStore,
  type StepSink,
} from './store';
import { SqliteRoomQueries, sqliteReportSink, sqliteStepSink } from './sqlite';
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
let steps: StepSink | undefined;
let durable = false;

/** How long a finished table is kept before it is forgotten. */
const KEEP_FINISHED_MS = 7 * 24 * 60 * 60 * 1000;

if (databasePath) {
  const queries = new SqliteRoomQueries({ path: databasePath });
  store = new DatabaseRoomStore(queries);
  reports = sqliteReportSink(queries);
  steps = sqliteStepSink(queries);
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

/**
 * Which provider, when more than one key is set.
 *
 * The first key present wins, in the order below, and the startup line names
 * what was chosen — so a key in the wrong variable shows up on the first line
 * rather than at the first report. All three speak the same wire format, so
 * this is a choice of host, not of code.
 */
const PROVIDERS: Array<{ key: string; model: () => LanguageModel }> = [
  {
    key: 'OPENAI_API_KEY',
    model: () =>
      openAI({ apiKey: process.env.OPENAI_API_KEY as string, model: process.env.OPENAI_MODEL }),
  },
  {
    key: 'DEEPSEEK_API_KEY',
    model: () =>
      deepSeek({
        apiKey: process.env.DEEPSEEK_API_KEY as string,
        model: process.env.DEEPSEEK_MODEL,
      }),
  },
  {
    key: 'OPENROUTER_API_KEY',
    model: () =>
      openRouter({
        apiKey: process.env.OPENROUTER_API_KEY as string,
        model: process.env.OPENROUTER_MODEL,
        referer: 'https://github.com/gHashTag/leela',
        title: 'Leela',
      }),
  },
];

function configuredModel(): LanguageModel | undefined {
  return PROVIDERS.find((provider) => process.env[provider.key])?.model();
}

const model = configuredModel();
const guide = model ? new Guide({ model }) : undefined;

const bot = createBot({ token, store, reports, steps, guide });

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
  model
    ? // The id names the provider and the model, so a log says which of the
      // two keys was picked up rather than only that one was.
      `A companion is configured (${model.id}) and will respond to reports.`
    : `No ${PROVIDERS.map((p) => p.key).join(', ')}: ` +
      'reports are kept, but nothing responds to them.',
);

/**
 * Say which languages the bot actually speaks.
 *
 * The plans are in 22 languages and the bot's own sentences are in two, with
 * the rest falling back to English. That gap is a fact about the deployment,
 * so an operator should read it on startup rather than hear it from a player.
 */
const spoken = translatedLanguages();
console.log(
  `Speaking ${spoken.join(', ')}; the other ${LANGUAGES.length - spoken.length} ` +
    'languages get the plans in their own language and the rest in English.',
);
for (const { language, translated, total } of messageCoverage()) {
  if (translated < total) {
    console.log(`  ${language}: ${translated}/${total} sentences translated.`);
  }
}
// A catalogue defect — a dropped placeholder, a missing plural form — is
// invisible until a player hits the one sentence that has it. Say it here.
for (const issue of messageIssues()) {
  console.warn(`  catalogue: ${issue.language} "${issue.key}" ${issue.problem}`);
}

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
