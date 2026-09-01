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
  loadEveryLanguage,
  loadedLanguages,
  messageFor,
  messageCoverage,
  messageIssues,
  translatedLanguages,
} from '@leela/content';
import { currentPlayer, hasWon, isWaitingToEnter } from '@leela/engine';
import { createBot, miniAppUrl } from './bot';
import { accessFor } from './access';
import { PAID_COMMANDS, menuFor, roll as rollCommand } from './commands';
import { attributeConversion } from './conversions';
import { DirectChannels } from './delivery';
import { createInitiative, lastWordSaid, nudgeHour } from './initiative';
import { serveAsk, type StreamAsk, type Streamed } from './serve';
import { offering, operatorIds, whyNoOperators, whyNothingIsSold } from './stars';
import { openStorage, remembering } from './storage';
import { asReport, keep } from './take-in';
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
/**
 * Every language's plan text, before the bot answers anything.
 *
 * Twenty-one of the twenty-two are loaded on demand now, because the web board
 * was carrying all of them to a reader of one. A server is the opposite case:
 * it serves whichever language the table is played in, cannot await inside a
 * command, and has no download to save — so it takes them all, once, here,
 * before a single update is polled. `plansFor` says so in a log if this is
 * ever missed, but a Russian table reading English is not a thing to find out
 * from a log.
 */
await loadEveryLanguage();

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
// One allow-list for the transport and the initiative both: a 403 either meets
// is a send the other must not spend. See `BotOptions.channels`.
const channels = new DirectChannels();

/**
 * Whether anything is sold here, decided once and in one place.
 *
 * `offering` answers `null` unless a price is named, and `null` is the whole
 * feature off — no `/pro`, no menu entry, no invoice, nothing said about
 * money. Read here rather than inside `createBot` so that the startup line
 * below and the bot itself cannot disagree about which deployment this is.
 */
const stars = offering(process.env);

const built = {
  token,
  store: storage.store,
  reports: storage.reports,
  steps: storage.steps,
  nudges: storage.nudges,
  entitlements: storage.entitlements,
  channels,
  guide,
  stars,
  operators: operatorIds(process.env),
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
  built.steps === storage.steps &&
  built.nudges === storage.nudges &&
  built.entitlements === storage.entitlements;

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
 * Whether this deployment sells anything, said out loud.
 *
 * The dark case is the ordinary one and is still worth a line: a price with a
 * typo in it is otherwise invisible — the bot runs, `/pro` is absent, and the
 * person who set the variable has no way to tell that from the rail being off
 * on purpose. `whyNothingIsSold` is the reason, from the same reader the gate
 * itself uses, so the sentence cannot describe a different decision from the
 * one that was made.
 */
console.log(
  stars
    ? `Telegram Stars: ${stars.map((tier) => `${tier.id} ${tier.stars}XTR`).join(', ')}. ` +
      'The first three successful moves are free; a live subscription opens the rest.'
    : `Telegram Stars: nothing is sold — ${whyNothingIsSold(process.env) ?? ''}.`,
);
console.log(
  built.operators.length > 0
    ? `${built.operators.length} operator(s) may /refund a payment.`
    : `Refunds: ${whyNoOperators(process.env) ?? ''}.`,
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

/**
 * And whether that sentence is true, which is now a question worth asking.
 *
 * The plan text is loaded on demand since the web board stopped carrying
 * twenty-two languages to a reader of one, so the line above is only true if
 * `loadEveryLanguage` above finished. An assertion that depends on an await
 * somewhere else is a sentence waiting to be wrong, so this measures instead
 * of asserting — and, as a side effect, it is how an operator reading
 * `railway logs` can tell which release is deployed: a bot that predates the
 * loading prints no such line at all.
 */
/**
 * What the last daily word did, said at startup.
 *
 * The tick logs its own line at 06:00 UTC and that line is unchanged — but it
 * lives in a stream that resets, and in six attempts to read it the container
 * had restarted past it five times. This is the same fact, kept, for the
 * reader who arrived after.
 */
console.log(lastWordSaid(storage.lastTick?.() ?? null));

const withText = loadedLanguages();
console.log(
  withText.length === LANGUAGES.length
    ? `Plan text: all ${withText.length} languages are in memory.`
    : `Plan text: only ${withText.length} of ${LANGUAGES.length} languages are in memory. ` +
      `The rest will be served ${FALLBACK_LANGUAGE} — the startup load did not finish.`,
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
      // `alsoOffered` in `bot.ts` is the same question asked of the same
      // `stars`, so the menu and the help cannot describe two different bots:
      // a deployment with no price publishes exactly the menu it published
      // before the Stars rail was written.
      await bot.api.setMyCommands(menuFor(language, stars ? PAID_COMMANDS : []), {
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
  token,
  staticRoot: process.env.LEELA_WEB_ROOT,
  /**
   * One player's own game, for `/api/game` — `specs/009`, which the owner
   * settled on 2026-08-28 with «да 3D поле везде!».
   *
   * The id is the one `vouched.ts` got out of a signature, and it is used as a
   * CHAT id: in a private chat Telegram makes the two the same number, so a
   * player who opened the board from their own chat with the bot is asking for
   * that chat's table. A group's table is not reachable this way and should not
   * be — the id in a signed launch is a person, never a room.
   *
   * `hasWon` and `isWaitingToEnter` rather than a comparison written here. The
   * first principle names this exact square: 68 means *waiting to enter* or
   * *has won* depending on how you arrived, and every place that re-derived the
   * difference instead of asking got it wrong — the leaderboard, `/new`, the
   * mini app's header, the trail marker.
   */
  gameOf: async (userId) => {
    /*
     * **`roomOf`, not `get`.** A room is keyed by the CHAT it lives in, and this
     * is handed a PLAYER — the two are the same number only in a private chat
     * with the bot, and nowhere else. A player seated at a table in a group
     * asked this route for their game and was told there is none.
     *
     * `/ask` learned this first and `roomOf` was written for it: *the table this
     * player is seated at, wherever it is.* The board is the second caller with
     * a player in hand and no chat, and it made the same mistake — because the
     * mistake looks correct in the one chat a developer tests in.
     *
     * `get(userId)` stays as the fallback for a store that has no `roomOf`,
     * which is the convention the interface already documents.
     */
    const room = (await storage.store.roomOf?.(userId)) ?? (await storage.store.get(userId));
    const seat = room?.session.players.find((player) => player.id === userId);
    if (seat === undefined || room === null || room === undefined) return null;
    const access = await accessFor({
      userId,
      stars,
      entitlements: storage.entitlements,
      steps: storage.steps,
      now: Date.now(),
    });

    return {
      plan: seat.state.loka,
      waiting: isWaitingToEnter(seat.state),
      won: hasWon(seat.state),
      language: room.language,
      // The whole state, so the board can BE this game rather than describe it
      // — `specs/009` step 4, adopt. See `Standing` in serve.ts for why three
      // fields could not be played on.
      state: seat.state,
      // Asked of the session rather than compared here. `/roll` in the chat and
      // the die on the board must agree about whose throw it is, and the only
      // way they agree is by asking the same function.
      yourTurn: currentPlayer(room.session).id === userId,
      moved: access.moved,
      entitled: access.entitled,
      canSubscribe: stars !== null,
    };
  },
  /**
   * One throw of the chat's die, on the board's behalf — `specs/009` step 4.
   *
   * **`rollCommand` is the function `/roll` runs.** Not a copy of it: the die
   * is seeded per room and advanced by `rollsTaken`, a third six sends the
   * player back, a report may be owed first, and every one of those rules lives
   * in `commands.ts`. A second implementation here would agree on the day it
   * was written and drift on the first rule that changed — which is the defect
   * this repository was assembled out of twenty-five repositories to end.
   *
   * The result is STORED before it is answered. A board told it rolled a six,
   * on a game the bot then forgot, is the two surfaces disagreeing again with
   * an extra step.
   */
  rollFor: async (userId) => {
    // The same lookup as `gameOf`, and it must stay the same: a board that can
    // READ a game it cannot ROLL in is worse than one that can do neither.
    const room = (await storage.store.roomOf?.(userId)) ?? (await storage.store.get(userId));
    if (room === null || room === undefined) return null;
    if (room.session.players.find((player) => player.id === userId) === undefined) return null;

    const beforeAccess = await accessFor({
      userId,
      stars,
      entitlements: storage.entitlements,
      steps: storage.steps,
      now: Date.now(),
    });
    if (!beforeAccess.mayMove) {
      return { refused: messageFor(room.language, 'app.tollDue') };
    }

    const before = room.rollsTaken;
    const outcome = rollCommand(room, userId, Date.now());
    const after = outcome.room;

    // `roll` answers a refusal as a reply on an UNCHANGED room — not started,
    // not your turn, a report owed. The roll count is what says the die turned,
    // and it is read rather than the reply text, which is a sentence in
    // twenty-two languages and would make this a translation check.
    if (after === null || after.rollsTaken === before) {
      return { refused: outcome.replies[0]?.text ?? 'the die did not turn' };
    }

    // Stored BEFORE it is answered. A board told it rolled a six, on a game the
    // bot then forgot, is the two surfaces disagreeing again with an extra step.
    await storage.store.save(after);

    const seat = after.session.players.find((player) => player.id === userId);
    if (seat === undefined) return null;

    const moved = (outcome.effects ?? []).find((effect) => effect.kind === 'move');
    if (moved?.kind === 'move') {
      await attributeConversion({
        nudges: storage.nudges,
        userId,
        kind: 'roll',
        at: Date.now(),
        log: console.log,
      });
      await storage.steps.record({
        userId: moved.userId,
        event: moved.event,
        ruleset: moved.ruleset,
      });
    }
    const access = await accessFor({
      userId,
      stars,
      entitlements: storage.entitlements,
      steps: storage.steps,
      now: Date.now(),
    });

    return {
      roll: moved?.event.roll ?? 0,
      rollsAgain: currentPlayer(after.session).id === userId,
      standing: {
        plan: seat.state.loka,
        waiting: isWaitingToEnter(seat.state),
        won: hasWon(seat.state),
        language: after.language,
        state: seat.state,
        yourTurn: currentPlayer(after.session).id === userId,
        moved: access.moved,
        entitled: access.entitled,
        canSubscribe: stars !== null,
      },
    };
  },
  /**
   * A player's path, for `/api/reports` — `specs/001-shared-reports` P1.
   *
   * `asReport` and `keep` are `take-in.ts`'s, which is the point: a path
   * arriving over HTTP and a path arriving as a file are merged and stored by
   * one rule, not two that agree today.
   *
   * `of` answers null when nothing is kept, which the route turns into a 503 —
   * a deployment that discards reports must not accept a path and forget it,
   * while telling the player it took it.
   *
   * Asked of the SINK rather than of `storage.durable`: `history` is optional
   * on `ReportSink` precisely because a sink that discards has nothing to
   * return, and its own doc-comment says the caller must say so rather than
   * show an empty history that looks like the player never wrote anything.
   * `durable` answers a different question — whether a file opened — and the
   * two have disagreed here before.
   */
  reports: {
    of: async (userId) =>
      storage.reports.history ? (await storage.reports.history(userId)).map(asReport) : null,
    keep: async (userId, added) => keep(storage.reports, userId, added),
  },
});

/**
 * The companion's initiative: the daily word, on a fixed UTC hour.
 *
 * Built beside `serveAsk` and armed only once polling has actually begun —
 * a bot that cannot receive `/quiet` must not be writing first. `start` is
 * idempotent, because the supervisor restarts polling after a dropped socket
 * and each restart says so. `LEELA_NUDGE_HOUR` moves the hour; the default is
 * 6, which on Railway's UTC clock is 09:00 in Moscow.
 */
const initiative = createInitiative({
  api: bot.api,
  store: storage.store,
  nudges: storage.nudges,
  companion: guide,
  channels,
  launchUrl: miniAppUrl(),
  hour: nudgeHour(),
  log: console.log,
  previous: storage.lastTick,
  // Kept only where keeping means something: an in-memory deployment would
  // forget it at the same moment it forgets the games. The adapter lives in
  // storage.ts so a test can reach it — inline here, nothing could.
  remember: remembering(storage),
});

/**
 * Polling has begun: say so, and only now arm the daily word — a bot that
 * cannot yet receive `/quiet` must not be writing first. Named because the
 * supervisor may start polling more than once; `initiative.start` is
 * idempotent and this is its one caller.
 */
function listening(username: string): void {
  console.log(`Listening as @${username}.`);
  initiative.start();
}

await supervise({
  start: async () => {
    if (stopping) return;
    await bot.start({
      onStart: (info) => listening(info.username),
    });
  },
});

// The poller has stopped — cleanly or by giving up — and a listener held open
// would keep alive a process that can no longer play. Let it exit; the
// platform's restart is the recovery. The initiative stops with it: a bot no
// longer listening must not go on speaking first.
asking.stop();
initiative.stop();
