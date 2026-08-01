/**
 * Entry point.
 *
 * Reads the token from the environment and nowhere else — no token is ever
 * committed, and the process refuses to start without one rather than failing
 * halfway through the first update.
 *
 *   BOT_TOKEN=... bun run src/index.ts
 */

import {
  Guide,
  ZAI_CODING_BASE_URL,
  deepSeek,
  openAI,
  openRouter,
  zAI,
  type LanguageModel,
} from '@leela/ai';
import {
  FALLBACK_LANGUAGE,
  LANGUAGES,
  messageCoverage,
  messageIssues,
  translatedLanguages,
} from '@leela/content';
import { createBot } from './bot';
import { menuFor } from './commands';
import { openStorage } from './storage';
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
 * Three cases, not two: kept, held in memory on purpose, and held in memory
 * because the path could not be opened. The third used to be a crash into a
 * restart loop — a bot pointed at `/data/leela.db` with no volume mounted.
 */
const databasePath = process.env.LEELA_DB;
const storage = openStorage({ path: databasePath, log: console.error });

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
    key: 'ZAI_API_KEY',
    model: () =>
      zAI({
        apiKey: process.env.ZAI_API_KEY as string,
        model: process.env.ZAI_MODEL,
        // Z.AI sells two kinds of key against two paths. A Coding Plan key sent
        // to the pay-as-you-go host comes back as error 1113, which reads as an
        // expired key and sends whoever holds a good one off to buy another.
        baseUrl: process.env.ZAI_PLAN === 'coding' ? ZAI_CODING_BASE_URL : undefined,
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

const bot = createBot({
  token,
  store: storage.store,
  reports: storage.reports,
  steps: storage.steps,
  guide,
});

// Rooms live in memory here. `DatabaseRoomStore` in persistence.ts is the
// durable one — it needs a `RoomQueries` implementation and a database, so
// wiring it is a deployment decision rather than a default. Say plainly what
// this process does rather than losing games quietly.
console.log(
  storage.durable
    ? `Leela bot starting. Games and reports are kept in ${databasePath}.`
    : storage.failure
      ? `Leela bot starting. ${storage.failure} — games are held in memory and will not survive a restart.`
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
/**
 * The menu behind Telegram's `/` button.
 *
 * Sixteen commands and none of them registered: a player had to know `/help`
 * existed in order to be told about the other fifteen, and `/help` was not
 * discoverable either. `BOT_COMMANDS` is the one list; this is the only place
 * that hands it to Telegram.
 *
 * Registered before the loop starts, and a failure is said rather than thrown:
 * a bot that cannot publish its menu can still play the game, and refusing to
 * start over a popover would be the worse trade.
 */
async function publishMenu(): Promise<void> {
  for (const language of translatedLanguages()) {
    try {
      await bot.api.setMyCommands(menuFor(language), {
        // English is also the default: Telegram falls back to the scopeless
        // list for a client whose language nothing was registered for, and
        // without it the menu is empty for twenty of the twenty-two.
        ...(language === FALLBACK_LANGUAGE ? {} : { language_code: language }),
      });
    } catch (error) {
      console.log(`Could not publish the ${language} command menu: ${String(error)}`);
    }
  }
}

await publishMenu();

await supervise({
  start: async () => {
    if (stopping) return;
    await bot.start({
      onStart: (info) => console.log(`Listening as @${info.username}.`),
    });
  },
});
