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
  DEFAULT_ZAI_BASE_URL,
  DEFAULT_ZAI_MODEL,
  Guide,
  ModelError,
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
import { serveAsk, type StreamAsk, type Streamed } from './serve';
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
// The same 16000-token ceiling the ask route pays, for the same reason: a
// reasoning model spends the default 800 on thought and returns empty text.
const guide = model ? new Guide({ model, completion: { maxTokens: 16_000 } }) : undefined;

/**
 * What the bot is built with, named rather than written inline.
 *
 * Named because the startup line below reads this object, and not
 * `storage.durable`. The two answer different questions and can disagree, and
 * when they disagree the operator is the one who is lied to: `storage.durable`
 * says the SQLite file opened, which stays true when the durable sinks never
 * reach the bot at all.
 *
 * MEASURED, not supposed. With `reports:` deleted from this object every report
 * went to `discardReports` while this process printed *"Games and reports are
 * kept in /data/leela.db"*, `tsc` and the whole 681-case suite stayed green,
 * and the container smoke test in CI — which greps for exactly that sentence —
 * produced byte-identical output. The player typing `/path` was told the truth
 * and the operator was not.
 *
 * So the line is derived from what was handed over, against what storage
 * offered. A sink swapped for a memory one makes the comparison false and the
 * sentence honest; a field deleted outright no longer compiles, because
 * `built.reports` is then a property that is not there.
 */
const built = {
  token,
  store: storage.store,
  reports: storage.reports,
  steps: storage.steps,
  guide,
};

const bot = createBot(built);

/**
 * Whether this process keeps anything, as opposed to whether a file opened.
 *
 * Rooms live in memory unless a database was opened. `DatabaseRoomStore` in
 * persistence.ts is the durable one — it needs a `RoomQueries` implementation
 * and a database, so wiring it is a deployment decision rather than a default.
 * Say plainly what this process does rather than losing games quietly.
 */
const keeping =
  storage.durable &&
  built.store === storage.store &&
  built.reports === storage.reports &&
  built.steps === storage.steps;

console.log(
  keeping
    ? `Leela bot starting. Games and reports are kept in ${databasePath}.`
    : storage.failure
      ? `Leela bot starting. ${storage.failure} — games are held in memory and will not survive a restart.`
      : storage.durable
        ? // The case the smoke job could not see, and the reason this line was
          // rewritten: the file opened and the bot was built without it. Nothing
          // reaches this today, and an operator who ever does read it is being
          // told the one thing the old line hid from them.
          `Leela bot starting. ${databasePath} was opened, but the bot was not built with it — ` +
          'games and reports are held in memory and will not survive a restart.'
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

// The 3D board asks its questions over HTTP while the bot polls Telegram: two
// listeners, one process, one key. Beside the supervisor rather than inside
// it — a dropped poll must not take the ask route down with it. The same
// `model` the guide answers with is what answers the board, so one key in one
// variable serves both surfaces or neither.
/**
 * The board's answers as deltas, when the key is Z.AI's.
 *
 * `LanguageModel.complete` waits for the whole reply, and with a model that
 * reasons before it speaks the page watched a spinner for half a minute while
 * the phone app showed the thinking. This speaks to the same host the zAI
 * factory does, with `stream: true` and `thinking` enabled — the dev route's
 * request (`apps/webgl/server/ask.ts`), whose wire the board is built against
 * — and hands the deltas to the route to forward. Providers other than Z.AI
 * keep the whole-answer path: their reasoning fields differ, and a guess about
 * them belongs next to a measurement, not here.
 */
function zaiStream(apiKey: string): StreamAsk {
  const baseUrl = process.env.ZAI_PLAN === 'coding' ? ZAI_CODING_BASE_URL : DEFAULT_ZAI_BASE_URL;
  const model = process.env.ZAI_MODEL ?? DEFAULT_ZAI_MODEL;

  return async ({ system, question, maxTokens, signal }) => {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: question },
        ],
        // One budget pays for the thinking and the answer both; the dev
        // route's measured price.
        max_tokens: maxTokens,
        temperature: 0.6,
        stream: true,
        thinking: { type: 'enabled' },
      }),
      signal,
    });

    if (!upstream.ok || !upstream.body) {
      const detail = upstream.ok ? 'no body' : await upstream.text().catch(() => '');
      throw new ModelError(
        `the model refused the request (${upstream.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        upstream.status,
      );
    }

    return deltasOf(upstream.body);
  };
}

/** The provider's SSE, reduced to the two fields the board shows. */
async function* deltasOf(body: ReadableStream<Uint8Array>): AsyncIterable<Streamed> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let cut = buffer.indexOf('\n\n');
      while (cut !== -1) {
        const frame = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);
        cut = buffer.indexOf('\n\n');

        const data = frame
          .split('\n')
          .filter((row) => row.startsWith('data:'))
          .map((row) => row.slice(5).trim())
          .join('');
        if (!data || data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.reasoning_content) yield { thinking: delta.reasoning_content };
          if (delta?.content) yield { text: delta.content };
        } catch {
          // A half-delivered frame is not an error; the next read completes it.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

const asking = serveAsk({
  model,
  stream: process.env.ZAI_API_KEY ? zaiStream(process.env.ZAI_API_KEY) : undefined,
});

await supervise({
  start: async () => {
    if (stopping) return;
    await bot.start({
      onStart: (info) => console.log(`Listening as @${info.username}.`),
    });
  },
});

// The poller has stopped — cleanly or by giving up — and a listener held open
// would keep alive a process that can no longer play. Let it exit; the
// platform's restart is the recovery.
asking.stop();
