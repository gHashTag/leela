import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { messageFor } from '@leela/content';
import { Guide, ModelError, fixedModel, recordingModel, type LanguageModel } from '@leela/ai';
import { createBot } from '../src/bot';
import { MemoryReportSink, MemoryRoomStore, type ReportSink } from '../src/store';

/**
 * The transport, driven without a network.
 *
 * `bot.ts` was the one file with no test harness. Everything in it — who a
 * reply is sent to, whether a button appears, whether a callback is answered,
 * whether plain text is taken as a report — existed only as code that had been
 * read, and one of those things had already been found broken by a player
 * rather than by a test.
 *
 * grammY needs `getMe` before it will handle anything; `botInfo` is what lets
 * it be told instead of asking. From there `handleUpdate` is the whole surface
 * and `api.config.use` catches everything that would have left the process.
 */

const BOT_INFO = {
  id: 1,
  is_bot: true as const,
  first_name: 'Leela',
  username: 'leela_test_bot',
  can_join_groups: true as const,
  can_read_all_group_messages: false as const,
  supports_inline_queries: false as const,
  can_connect_to_business: false as const,
  has_main_web_app: false as const,
  has_topics_enabled: false as const,
  allows_users_to_create_topics: false as const,
  can_manage_bots: false as const,
  supports_join_request_queries: false as const,
};

interface Sent {
  method: string;
  payload: Record<string, unknown>;
}

/** Anything the transport would have sent, and nothing actually sent. */
function harness(options: Parameters<typeof createBot>[0] extends infer O ? Partial<O> : never = {}) {
  const sent: Sent[] = [];
  /** Chat ids that refuse a direct message, as Telegram refuses a stranger. */
  const blocking = new Set<string>();

  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: () => undefined,
    ...options,
  });

  bot.api.config.use(async (_prev, method, payload) => {
    const record = payload as Record<string, unknown>;
    sent.push({ method, payload: record });

    if (method === 'sendMessage' && blocking.has(String(record.chat_id))) {
      return {
        ok: false,
        error_code: 403,
        description: 'Forbidden: bot can’t initiate conversation with a user',
      } as never;
    }

    return { ok: true, result: method === 'answerCallbackQuery' ? true : { message_id: 1 } } as never;
  });

  return { bot, sent, blocking };
}

let updateId = 0;

function message(text: string, chat: { id: number; type: 'private' | 'group' } , from = 100) {
  updateId += 1;
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: chat.id, type: chat.type, title: 'A table' },
      from: { id: from, is_bot: false, first_name: `P${from}` },
      text,
      entities: text.startsWith('/')
        ? [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0].length }]
        : undefined,
    },
  } as never;
}

function callback(data: string, chat: { id: number; type: 'private' | 'group' }, from = 100) {
  updateId += 1;
  return {
    update_id: updateId,
    callback_query: {
      id: String(updateId),
      from: { id: from, is_bot: false, first_name: `P${from}` },
      chat_instance: 'x',
      data,
      message: {
        message_id: updateId,
        date: 0,
        chat: { id: chat.id, type: chat.type },
        from: { id: 1, is_bot: true, first_name: 'Leela' },
        text: 'previous',
      },
    },
  } as never;
}

const PRIVATE = { id: 500, type: 'private' as const };
const GROUP = { id: -500, type: 'group' as const };

/** The text of every message the transport tried to send. */
const texts = (sent: Sent[]) =>
  sent.filter((s) => s.method === 'sendMessage').map((s) => String(s.payload.text));

/**
 * Throw until the report gate is owed.
 *
 * The die is seeded from the chat id, so how many throws entry takes is fixed
 * but not known here. Stopping on the gate's own words rather than on a guess
 * is what keeps this from silently testing nothing when the count is wrong.
 */
async function rollUntilTheGate(bot: ReturnType<typeof createBot>, sent: Sent[]) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const before = sent.length;
    await bot.handleUpdate(message('/roll', PRIVATE));
    const said = texts(sent.slice(before)).join(' ');
    if (said.includes('before you move on')) return;
  }
  throw new Error('never reached the report gate');
}

/**
 * The commands the help message names.
 *
 * Derived rather than listed: the hand-written list this replaced was missing
 * `/save` the day it was added, and the help was missing `/end` for longer than
 * that. A list kept by hand beside the thing it describes is the fourth of
 * those to go wrong in this repository.
 */
function documented(): string[] {
  return [...messageFor('en', 'help').matchAll(/^\/([a-z]+)/gm)].map(([, name]) => `/${name}`);
}

/** The commands `bot.ts` actually registers, read from the file. */
function registered(): string[] {
  const source = readFileSync(resolve(process.cwd(), 'src/bot.ts'), 'utf8');
  return [...source.matchAll(/bot\.command\('([a-z]+)'/g)].map(([, name]) => `/${name}`);
}

describe('the help message is the whole surface', () => {
  /**
   * `/help` is not in its own list, deliberately: a line telling a reader how
   * to read the message they are reading is noise. Everything else that
   * answers must be there — the bot tells people to "send /end" in another
   * message while never mentioning it here.
   */
  const EXEMPT = ['/help'];

  it('names every command the bot answers', () => {
    const missing = registered()
      .filter((command) => !EXEMPT.includes(command))
      .filter((command) => !documented().includes(command));

    expect(missing).toEqual([]);
  });

  it('names nothing the bot does not answer', () => {
    // The other direction: a help that promises a command which does nothing
    // is worse than one that leaves it out.
    const phantom = documented().filter((command) => !registered().includes(command));
    expect(phantom).toEqual([]);
  });

  it('finds commands at all, so an empty list cannot pass', () => {
    expect(documented().length).toBeGreaterThan(5);
    expect(registered().length).toBeGreaterThan(5);
  });
});

describe('every command answers', () => {
  // "Silence is indistinguishable from a broken bot, and that is how this one
  // first looked" is a comment in bot.ts. It was not a test until now, and it
  // is asserted over the whole command surface rather than over one command.
  const COMMANDS = [
    ...documented(),
    '/plan 41',
    '/report something',
    '/help',
    '/nonsense',
    'plain text with no slash',
  ];

  it.each(COMMANDS)('says something to %s on an empty chat', async (text) => {
    const { bot, sent } = harness();
    await bot.handleUpdate(message(text, PRIVATE));
    expect(texts(sent).length).toBeGreaterThan(0);
    expect(texts(sent).every((t) => t.trim().length > 0)).toBe(true);
  });

  it.each(COMMANDS)('says something to %s at a running table', async (text) => {
    const { bot, sent } = harness();
    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));
    const before = sent.length;
    await bot.handleUpdate(message(text, PRIVATE));
    expect(sent.slice(before).filter((s) => s.method === 'sendMessage').length).toBeGreaterThan(0);
  });
});

describe('a button press is answered before anything else', () => {
  // Telegram leaves a spinner on the button until `answerCallbackQuery` is
  // called. An action that does nothing must still stop the spinner.
  const ACTIONS = ['new', 'join', 'start', 'roll', 'board', 'plan', 'help', 'nonsense'];

  it.each(ACTIONS)('answers the callback for %s', async (action) => {
    const { bot, sent } = harness();
    await bot.handleUpdate(callback(action, PRIVATE));
    expect(sent.some((s) => s.method === 'answerCallbackQuery')).toBe(true);
  });

  it('answers it even when there is no table for the action to work on', async () => {
    const { bot, sent } = harness();
    await bot.handleUpdate(callback('roll', PRIVATE));
    const answered = sent.findIndex((s) => s.method === 'answerCallbackQuery');
    expect(answered).toBe(0);
  });
});

describe('who a reply is addressed to', () => {
  it('sends a private answer directly, not into the group', async () => {
    const { bot, sent } = harness();
    await bot.handleUpdate(message('/new', GROUP));
    await bot.handleUpdate(message('/start', GROUP));
    sent.length = 0;

    // `/plan` is one player's reading, not the table's.
    await bot.handleUpdate(message('/plan 41', GROUP));

    const destinations = sent.filter((s) => s.method === 'sendMessage').map((s) => s.payload.chat_id);
    // The user id, as a string: `sendMessage` to a person, not to the table.
    expect(destinations).toContain('100');
    expect(destinations).not.toContain(GROUP.id);
  });

  it('says where to go when it cannot message someone directly', async () => {
    const { bot, sent, blocking } = harness();
    blocking.add('100');

    await bot.handleUpdate(message('/new', GROUP));
    await bot.handleUpdate(message('/start', GROUP));
    sent.length = 0;
    await bot.handleUpdate(message('/plan 41', GROUP));

    const toGroup = sent
      .filter((s) => s.method === 'sendMessage' && s.payload.chat_id === GROUP.id)
      .map((s) => String(s.payload.text));

    expect(toGroup.length).toBe(1);
    expect(toGroup[0]).toContain('/start');
    // The point of the nudge: it must not read out what was private.
    expect(toGroup[0]).not.toContain('41.');
  });

  it('does not go looking for a private channel in a private chat', async () => {
    const { bot, sent } = harness();
    await bot.handleUpdate(message('/help', PRIVATE));
    expect(sent.every((s) => s.payload.chat_id === PRIVATE.id)).toBe(true);
  });
});

describe('buttons', () => {
  it('puts them under the last message only', async () => {
    // Repeating a keyboard under every message of a burst leaves several live
    // sets of buttons in the chat, all but one of them stale.
    const { bot, sent } = harness();
    await bot.handleUpdate(message('/new', PRIVATE));

    const messages = sent.filter((s) => s.method === 'sendMessage');
    const withKeyboard = messages.filter((s) => s.payload.reply_markup !== undefined);
    expect(messages.length).toBeGreaterThan(0);
    expect(withKeyboard.length).toBeLessThanOrEqual(1);
    if (withKeyboard.length === 1) {
      expect(messages[messages.length - 1]).toBe(withKeyboard[0]);
    }
  });
});

describe('plain text', () => {
  it('is taken as the report a player owes, without the command', async () => {
    const reports = new MemoryReportSink();
    const { bot, sent } = harness({ reports });

    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));
    await rollUntilTheGate(bot, sent);
    await bot.handleUpdate(message('what this brings up', PRIVATE));

    const kept = await reports.history?.('100');
    expect(kept?.some((entry) => entry.text === 'what this brings up')).toBe(true);
  });

  it('is not taken as a report when none is owed', async () => {
    const reports = new MemoryReportSink();
    const { bot } = harness({ reports });
    await bot.handleUpdate(message('hello?', PRIVATE));
    expect(await reports.history?.('100')).toEqual([]);
  });
});

describe('the companion', () => {
  /** A model that refuses the way an unpaid account does. */
  function unpaid(): { model: LanguageModel; calls: () => number } {
    let calls = 0;
    return {
      calls: () => calls,
      model: {
        id: 'unpaid',
        async complete() {
          calls += 1;
          throw new ModelError('no balance', 402);
        },
      },
    };
  }

  /** Counts how often the player's whole history is read back. */
  function countingReports(): ReportSink & { reads: () => number } {
    const inner = new MemoryReportSink();
    let reads = 0;
    return {
      reads: () => reads,
      record: (entry) => inner.record(entry),
      history: async (userId: string) => {
        reads += 1;
        return (await inner.history?.(userId)) ?? [];
      },
    };
  }

  /** Play until the report gate is owed, then file one. */
  async function reportOnce(
    bot: ReturnType<typeof createBot>,
    sent: Sent[],
    text = 'a reflection',
  ) {
    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));
    await rollUntilTheGate(bot, sent);
    await bot.handleUpdate(message(`/report ${text}`, PRIVATE));
  }

  it('answers a report when it can', async () => {
    const guide = new Guide({ model: fixedModel('a reflection from the model'), log: () => undefined });
    const { bot, sent } = harness({ guide, reports: new MemoryReportSink() });
    await reportOnce(bot, sent);
    expect(texts(sent)).toContain('a reflection from the model');
  });

  it('still answers the player when the model refuses', async () => {
    const refuser = unpaid();
    const guide = new Guide({ model: refuser.model, log: () => undefined });
    const { bot, sent } = harness({ guide, reports: new MemoryReportSink() });
    await reportOnce(bot, sent);
    // The fallback names the plan; the player is not left with nothing.
    expect(texts(sent).some((t) => t.includes('plan') || t.includes('план'))).toBe(true);
  });

  it('does not assemble a journey for a call it is not going to make', async () => {
    // With the companion silenced by a 402, reading the player's whole report
    // history is a full pass over everything they have ever written, for a
    // prompt that will be thrown away. This was the gap left by the pass that
    // introduced the silence.
    const refuser = unpaid();
    const reports = countingReports();
    const guide = new Guide({ model: refuser.model, log: () => undefined });
    const { bot, sent } = harness({ guide, reports });

    await reportOnce(bot, sent, 'first');
    const afterFirst = reports.reads();

    // The first report is what silences it; every later one must read nothing.
    await bot.handleUpdate(message('/roll', PRIVATE));
    await bot.handleUpdate(message('/report second', PRIVATE));
    await bot.handleUpdate(message('/roll', PRIVATE));
    await bot.handleUpdate(message('/report third', PRIVATE));

    expect(refuser.calls()).toBe(1);
    expect(reports.reads()).toBe(afterFirst);
  });

  it('keeps the report even when nothing can respond to it', async () => {
    const reports = new MemoryReportSink();
    const { bot, sent } = harness({ reports });
    await reportOnce(bot, sent, 'kept anyway');
    const kept = await reports.history?.('100');
    expect(kept?.some((entry) => entry.text === 'kept anyway')).toBe(true);
  });
});

describe('a table that is already running', () => {
  /**
   * `/new` threw away a table where nobody had entered yet.
   *
   * The guard read `players.every((p) => p.state.is_finished)` as "the game is
   * over". A player waiting to enter sits on 68 with `is_finished` set, so a
   * table that had just been opened counted as finished and was silently
   * replaced, seats and all. The third time that 68 means two things has cost
   * something — `hasWon` and `standings` were the first two.
   *
   * The assertion is over the states a table can be in, not over the one that
   * broke: a table is lost to `/new` only once its game is genuinely over.
   */
  it('is not lost while nobody has entered', async () => {
    const store = new MemoryRoomStore();
    const { bot, sent } = harness({ store });
    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));
    const opened = await store.get(String(PRIVATE.id));

    sent.length = 0;
    await bot.handleUpdate(message('/new', PRIVATE));

    expect(await store.get(String(PRIVATE.id))).toEqual(opened);
    expect(texts(sent).join(' ')).toContain('/end');
  });

  it('is not lost while it is still filling up', async () => {
    const store = new MemoryRoomStore();
    const { bot, sent } = harness({ store });
    await bot.handleUpdate(message('/new', PRIVATE));
    const opened = await store.get(String(PRIVATE.id));

    sent.length = 0;
    await bot.handleUpdate(message('/new', PRIVATE));

    expect(await store.get(String(PRIVATE.id))).toEqual(opened);
    // Not "a game is already running" — it is not running yet, and saying so
    // sends the host looking for a game they have not started.
    const said = texts(sent).join(' ');
    expect(said).toContain('/join');
    expect(said).toContain('/end');
  });

  it('says which of the two it is', async () => {
    const running = harness();
    await running.bot.handleUpdate(message('/new', PRIVATE));
    await running.bot.handleUpdate(message('/start', PRIVATE));
    running.sent.length = 0;
    await running.bot.handleUpdate(message('/new', PRIVATE));

    const filling = harness();
    await filling.bot.handleUpdate(message('/new', PRIVATE));
    filling.sent.length = 0;
    await filling.bot.handleUpdate(message('/new', PRIVATE));

    expect(texts(running.sent)[0]).not.toBe(texts(filling.sent)[0]);
  });

  it('is replaced once its game is over', async () => {
    // /end is the only way today; the point is that the guard is about the
    // game being over, not about a table existing.
    const store = new MemoryRoomStore();
    const { bot } = harness({ store });
    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/end', PRIVATE));
    await bot.handleUpdate(message('/new', PRIVATE));
    expect(await store.get(String(PRIVATE.id))).not.toBeNull();
  });

  it('is not replaced by /new', async () => {
    const { bot, sent } = harness();
    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));
    sent.length = 0;
    await bot.handleUpdate(message('/new', PRIVATE));
    expect(texts(sent).join(' ')).toContain('/end');
  });

  it('is gone after /end', async () => {
    const store = new MemoryRoomStore();
    const { bot } = harness({ store });
    await bot.handleUpdate(message('/new', PRIVATE));
    expect(await store.get(String(PRIVATE.id))).not.toBeNull();
    await bot.handleUpdate(message('/end', PRIVATE));
    expect(await store.get(String(PRIVATE.id))).toBeNull();
  });
});

describe('a failing update', () => {
  // A store that throws is the shape of a database going away mid-game.
  function brokenStore() {
    const store = new MemoryRoomStore();
    store.save = async () => {
      throw new Error('the database went away');
    };
    return store;
  }

  it('leaves nothing half-written', async () => {
    // Commands are pure and the write is the last thing that happens, so a
    // failed save means the table was never opened — not opened and empty.
    const store = brokenStore();
    const { bot } = harness({ store });
    await bot.handleUpdate(message('/new', PRIVATE)).catch(() => undefined);
    expect(await store.get(String(PRIVATE.id))).toBeNull();
  });

  it('does not stop the next update from being handled', async () => {
    const { bot, sent } = harness({ store: brokenStore() });
    await bot.handleUpdate(message('/new', PRIVATE)).catch(() => undefined);
    sent.length = 0;
    await bot.handleUpdate(message('/help', PRIVATE));
    expect(texts(sent).length).toBeGreaterThan(0);
  });

  it('surfaces the failure rather than swallowing it', async () => {
    // `bot.catch` covers the polling loop, which is how this bot runs. It does
    // not cover `handleUpdate` — a webhook deployment would have to catch for
    // itself, and finding that out from a silent failure would be worse than
    // this assertion being here.
    const { bot } = harness({ store: brokenStore() });
    await expect(bot.handleUpdate(message('/new', PRIVATE))).rejects.toThrow(
      /the database went away/,
    );
  });
});

describe('a path leaving and arriving as a file', () => {
  /**
   * Two new handlers went into the transport with only their pure halves
   * tested. `/save` sends a document and `message:document` reads one, and
   * neither had ever been driven — which is how the last defect in this file
   * was found, and how a fourth would have been missed.
   */
  const document = (bytes: number, fileId = 'f1') => {
    updateId += 1;
    return {
      update_id: updateId,
      message: {
        message_id: updateId,
        date: 0,
        chat: { id: PRIVATE.id, type: 'private' },
        from: { id: 100, is_bot: false, first_name: 'P100' },
        document: { file_id: fileId, file_unique_id: 'u1', file_size: bytes, file_name: 'p.json' },
      },
    } as never;
  };

  it('sends nothing but a sentence when nothing has been written', async () => {
    const { bot, sent } = harness({ reports: new MemoryReportSink() });
    await bot.handleUpdate(message('/save', PRIVATE));

    expect(sent.some((s) => s.method === 'sendDocument')).toBe(false);
    expect(texts(sent).join(' ')).toMatch(/written anything/i);
  });

  it('sends a document once there is a path', async () => {
    const reports = new MemoryReportSink();
    const { bot, sent } = harness({ reports });
    await reports.record({ userId: '100', plan: 6, text: 'the first thing' });

    await bot.handleUpdate(message('/save', PRIVATE));

    const files = sent.filter((s) => s.method === 'sendDocument');
    expect(files).toHaveLength(1);
    expect(String(files[0]?.payload.caption)).toContain('1');
  });

  it('says there is nowhere to keep a path when the store keeps nothing', async () => {
    // `discardReports` has no `history`, which is the shape of a bot running
    // without storage.
    const { bot, sent } = harness();
    await bot.handleUpdate(message('/save', PRIVATE));
    expect(sent.some((s) => s.method === 'sendDocument')).toBe(false);
    expect(texts(sent).length).toBeGreaterThan(0);
  });

  it('refuses a file too large to be a path without fetching it', async () => {
    const { bot, sent } = harness({ reports: new MemoryReportSink() });
    await bot.handleUpdate(document(50 * 1024 * 1024));

    // Nothing was downloaded: no getFile call was made.
    expect(sent.some((s) => s.method === 'getFile')).toBe(false);
    expect(texts(sent).length).toBeGreaterThan(0);
  });

  it('answers a document it cannot read, rather than going quiet', async () => {
    // The reading is injected, so "the file cannot be fetched" is a decision
    // this test makes. It used to be a real `fetch` failing against
    // api.telegram.org: three seconds of DNS, the slowest thing in the package
    // by two orders of magnitude, and an assertion about the network rather
    // than about the bot.
    const { bot, sent } = harness({
      reports: new MemoryReportSink(),
      readFile: async () => {
        throw new Error('no Telegram here');
      },
    });

    await bot.handleUpdate(document(64));
    expect(texts(sent).length).toBeGreaterThan(0);
  });

  it('takes a path that arrives as a file', async () => {
    // The path that had never run: the fetch always failed, so a file has
    // never been *received* in a test. The bytes are the mini app's own,
    // captured from its download and kept in tests/fixtures.
    const file = readFileSync(resolve(process.cwd(), 'tests/fixtures/miniapp-export.json'), 'utf8');
    const reports = new MemoryReportSink();
    const { bot, sent } = harness({ reports, readFile: async () => file });

    await bot.handleUpdate(document(file.length));

    expect(texts(sent).join(' ')).toMatch(/2/);
    expect((await reports.history?.('100'))?.map((entry) => entry.plan).sort((a, b) => a - b)).toEqual(
      [6, 41],
    );
  });

  it('says so when the same path arrives twice', async () => {
    const file = readFileSync(resolve(process.cwd(), 'tests/fixtures/miniapp-export.json'), 'utf8');
    const reports = new MemoryReportSink();
    const { bot, sent } = harness({ reports, readFile: async () => file });

    await bot.handleUpdate(document(file.length));
    const before = texts(sent).length;
    await bot.handleUpdate(document(file.length));

    expect(texts(sent).length).toBeGreaterThan(before);
    // Nothing was added the second time: the store still holds two.
    expect((await reports.history?.('100'))?.length).toBe(2);
  });
});

describe('what the companion is told about the arrival', () => {
  /**
   * `systemPrompt` has five sentences for how a player reached the square they
   * are writing about — brought down by a snake, carried up by an arrow,
   * walked here one square at a time — and none of them had ever reached a
   * model. `Guide` accepts `direction` and `previousPlan`; the bot's only call
   * site passed the plan and not the move that produced it.
   *
   * So a reflection on plan 8 read the same whether the player climbed to it or
   * was bitten down to it, in a game whose whole subject is what an arrival
   * means. Written, wired at one end, and dead.
   *
   * The assertion is the relation, not one sentence: whatever the state says
   * about the arrival, the prompt says it too.
   */

  const arrivalOf = (messages: { role: string; content: string }[]) =>
    messages.find((message) => message.role === 'system')?.content ?? '';

  it('tells it how the player arrived, whatever the arrival was', async () => {
    const recorder = recordingModel('a reflection');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const { bot, sent } = harness({ guide, reports: new MemoryReportSink() });

    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));

    // Play until several different arrivals have been reported on.
    const seen = new Set<string>();
    for (let turn = 0; turn < 60 && seen.size < 2; turn += 1) {
      await bot.handleUpdate(message('/roll', PRIVATE));
      if (!texts(sent).at(-1)?.includes('/report')) continue;

      await bot.handleUpdate(message('/report a reflection long enough to count', PRIVATE));
      const prompt = arrivalOf(recorder.calls.at(-1)?.messages ?? []);

      // Some sentence about the arrival is always there. Which five sentences
      // exist, and whether they agree with the pronoun, is `packages/ai`'s to
      // assert — this end only has to have passed the direction along.
      expect(prompt, `turn ${turn}`).toMatch(/^They .+\.$/m);
      seen.add(prompt.match(/They [^.]+\./)?.[0] ?? '');
    }

    expect(seen.size).toBeGreaterThan(0);
  });

  it('tells it where they came from, when that is somewhere else', async () => {
    const recorder = recordingModel('a reflection');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const { bot, sent } = harness({ guide, reports: new MemoryReportSink() });

    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));
    await rollUntilTheGate(bot, sent);
    await bot.handleUpdate(message('/report a reflection long enough to count', PRIVATE));

    const prompt = arrivalOf(recorder.calls.at(-1)?.messages ?? []);
    expect(prompt).toMatch(/They came from plan \d+\./);
  });

  it('still answers when there is nothing to say about the arrival', async () => {
    // The companion must not depend on it: a seat the bot cannot find is a
    // reflection without an arrival, not a silence.
    const guide = new Guide({ model: fixedModel('a reflection from the model'), log: () => undefined });
    const { bot, sent } = harness({ guide, reports: new MemoryReportSink() });

    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));
    await rollUntilTheGate(bot, sent);
    await bot.handleUpdate(message('/report a reflection long enough to count', PRIVATE));

    expect(texts(sent)).toContain('a reflection from the model');
  });
});
