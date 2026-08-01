import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { messageFor } from '@leela/content';
import { Guide, ModelError, fixedModel, recordingModel, type LanguageModel } from '@leela/ai';
import { createBot } from '../src/bot';
import { MemoryReportSink, MemoryRoomStore, type ReportSink } from '../src/store';
import { squareText } from '@leela/journal';

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
async function rollUntilTheGate(
  bot: ReturnType<typeof createBot>,
  sent: Sent[],
  chat: typeof PRIVATE | typeof GROUP = PRIVATE,
) {
  // The question first, because the die will not turn without one — the gate
  // the mini app, the phone and the published app have always had, and the bot
  // was the surface where a whole game could be played without being asked.
  await bot.handleUpdate(message('/intention to see what I keep avoiding', chat));

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const before = sent.length;
    await bot.handleUpdate(message('/roll', chat));
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

  it('is not cleared by somebody who is not sitting at it', async () => {
    /**
     * `/end` asked nothing: not who sent it, not whether there was a table. In
     * a group that is everybody who can write in the chat, so a lurker who
     * never took a seat could wipe six players' hour — the board, whose turn it
     * was, and the companion's memory of every exchange — in one word.
     *
     * The same file had already decided this question twice: `/start` is
     * host-only because starting closes the table on everybody else, and `/new`
     * refuses to discard a session that is not over. Ending it was the door
     * left open beside two locked ones.
     */
    const store = new MemoryRoomStore();
    const { bot, sent } = harness({ store });

    await bot.handleUpdate(message('/new', GROUP, 100));
    await bot.handleUpdate(message('/join', GROUP, 200));
    await bot.handleUpdate(message('/start', GROUP, 100));

    sent.length = 0;
    // 900 has never sent anything to this table.
    await bot.handleUpdate(message('/end', GROUP, 900));

    expect(await store.get(String(GROUP.id)), 'the table survives').not.toBeNull();
    expect(texts(sent).join(' ')).toContain('Only somebody sitting at it may clear it');
  });

  it('is cleared by any of the people playing it, not only the host', async () => {
    // The other half of the rule. A game belongs to the table, not to seat
    // zero — requiring the host would leave five players unable to stop.
    const store = new MemoryRoomStore();
    const { bot } = harness({ store });

    await bot.handleUpdate(message('/new', GROUP, 100));
    await bot.handleUpdate(message('/join', GROUP, 200));
    await bot.handleUpdate(message('/start', GROUP, 100));
    await bot.handleUpdate(message('/end', GROUP, 200));

    expect(await store.get(String(GROUP.id))).toBeNull();
  });

  it('is cleared by anybody while there is nothing at stake in it', async () => {
    /**
     * Before it starts and after it is over there is nothing to lose, and
     * `/new` will not replace a session that is not over — so if `/end` needed
     * a seat in every case, a table nobody had started would hold the chat for
     * good. The rule is about play being under way, not about a table existing.
     */
    const store = new MemoryRoomStore();
    const { bot } = harness({ store });

    await bot.handleUpdate(message('/new', GROUP, 100));
    await bot.handleUpdate(message('/end', GROUP, 900));

    expect(await store.get(String(GROUP.id)), 'an unstarted table').toBeNull();
  });

  it('says there is no table rather than reporting that it cleared one', () => {
    // An absence answered as if it were an act — the shape this repository
    // keeps meeting. `/end` in a chat that never had a table replied *the table
    // is cleared*, which is a sentence about something that did not happen.
    const { bot, sent } = harness();

    return (async () => {
      await bot.handleUpdate(message('/end', PRIVATE));

      const said = texts(sent).join(' ');
      expect(said, 'no table').toContain('No table here yet');
      expect(said).not.toContain('The table is cleared');
    })();
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

  it('tells the player, and the operator, rather than going quiet', async () => {
    // This used to let the exception out of the middleware, on the grounds that
    // a webhook deployment should not find out from a silence. The player found
    // out from one instead: nothing was said to them at all, and silence is
    // indistinguishable from a broken bot — which is how this one first looked.
    //
    // Both, then. The player is told the turn was not kept; the operator's log
    // carries the error that caused it.
    const logged: string[] = [];
    const { bot, sent } = harness({
      store: brokenStore(),
      log: (line: string) => logged.push(line),
    });

    await expect(bot.handleUpdate(message('/new', PRIVATE))).resolves.toBeUndefined();

    expect(texts(sent).join(' ')).toMatch(/could not keep/i);
    expect(logged.join(' ')).toMatch(/the database went away/);
  });

  it('describes nothing that was not kept', async () => {
    // The die is deterministic from the seed and the count of rolls, both of
    // which live in the room that was not saved — so the same command sent
    // again makes the same throw. Describing one that did not survive would be
    // the bot telling a player about a game it does not have.
    const store = new MemoryRoomStore();
    const { bot, sent } = harness({ store, reports: new MemoryReportSink() });

    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));

    store.save = async () => {
      throw new Error('the database went away');
    };

    const before = sent.length;
    await bot.handleUpdate(message('/roll', PRIVATE));

    const said = texts(sent.slice(before)).join(' ');
    expect(said).toMatch(/could not keep/i);
    expect(said, 'no throw is described').not.toMatch(/throws \d/);
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

  it('answers a document that never arrives, rather than waiting for it', async () => {
    // The other way a download fails, and the only one the careful reply above
    // does not cover: not a rejection but a silence. Node's `fetch` has no
    // timeout of its own, so a phone that lost its signal mid-upload leaves the
    // handler awaiting a promise that will not settle — and the sentence saying
    // the file could not be read sits there, written, unsent.
    const { bot, sent } = harness({
      reports: new MemoryReportSink(),
      readFile: () => new Promise<string>(() => {}),
      fileTimeoutMs: 20,
    });

    await bot.handleUpdate(document(64));
    expect(texts(sent).join(' ')).toMatch(/could not fetch/i);
  }, 5_000);

  it('does not blame the file for a download that failed', async () => {
    // Found by writing the test above: both causes shared one sentence, and
    // for one of them it was false. "That is not a path written by Leela" is
    // about a file that arrived; a file that never arrived cannot be judged.
    const { bot, sent } = harness({
      reports: new MemoryReportSink(),
      readFile: async () => {
        throw new Error('no Telegram here');
      },
    });

    await bot.handleUpdate(document(64));
    const said = texts(sent).join(' ');

    expect(said).toMatch(/could not fetch/i);
    expect(said, 'nothing is known about a file that never arrived').not.toMatch(/not a path/i);
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

  /** The same game every run: the die is seeded from `(chatId, now())`. */
  const FIXED_CLOCK = () => 1_700_000_000_000;

  const arrivalOf = (messages: { role: string; content: string }[]) =>
    messages.find((message) => message.role === 'system')?.content ?? '';

  it('tells it how the player arrived, whatever the arrival was', async () => {
    const recorder = recordingModel('a reflection');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const { bot, sent } = harness({ guide, reports: new MemoryReportSink() });

    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));

    // The die will not turn without one, here as on every other surface.
    await bot.handleUpdate(message('/intention to see what I keep avoiding', PRIVATE));

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

  /**
   * Every arrival of one whole game, rather than one throw's worth.
   *
   * The die is seeded from `(chatId, now())`, so a test that reads the clock
   * plays a different game every run and an assertion about *the* second
   * arrival is a coin toss — this file already learned that once, and I lost
   * the toss on CI having won it eight times here. The clock is fixed and the
   * rule is stated over every arrival the game produced.
   */
  async function arrivalsOfAGame(rolls: number) {
    const recorder = recordingModel('a reflection');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const { bot, sent } = harness({ guide, reports: new MemoryReportSink(), now: FIXED_CLOCK });

    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));
    await bot.handleUpdate(message('/intention to see what I keep avoiding', PRIVATE));

    const arrivals: string[] = [];
    for (let roll = 0; roll < rolls; roll += 1) {
      const before = sent.length;
      await bot.handleUpdate(message('/roll', PRIVATE));

      // The gate: it asks for an account before the game will go on, and the
      // account is what makes the companion be asked at all.
      if (texts(sent.slice(before)).join(' ').includes('before you move on')) {
        await bot.handleUpdate(message('/report a reflection long enough to count', PRIVATE));
        arrivals.push(arrivalOf(recorder.calls.at(-1)?.messages ?? []));
      }
    }

    return arrivals;
  }

  it('tells it where they came from, when that is somewhere else', async () => {
    const arrivals = await arrivalsOfAGame(40);

    // The guard on the sample: without a move in it the rule below is vacuous.
    const moves = arrivals.filter((prompt) => /They came from plan \d+\./.test(prompt));
    expect(moves.length, 'arrivals that name a square they came from').toBeGreaterThan(0);

    for (const prompt of moves) {
      expect(prompt, 'a move is not also an entry').not.toContain('have just entered the game');
    }
  });

  it('does not read the parking square as somewhere they came from', async () => {
    /**
     * The first report of **every game**. Found by playing one and printing the
     * prompt the model actually received: *They walked here one square at a
     * time. They came from plan 68.* — about a player who had been off the
     * board entirely. A player waiting to enter is parked on `WIN_LOKA`, and
     * nothing moves off it, so a previous plan of 68 on any other square is the
     * parking space and not an origin. Ninth sighting of the 68 ambiguity, and
     * the first inside a model's instructions.
     *
     * Over every arrival of the game, because the claim is that this sentence
     * is never produced — not that it was absent from one throw.
     */
    const arrivals = await arrivalsOfAGame(40);

    expect(arrivals.length, 'reports filed in this game').toBeGreaterThan(1);
    for (const prompt of arrivals) {
      expect(prompt, 'the parking square is never an origin').not.toMatch(/came from plan 68/);
    }

    const entry = arrivals[0] ?? '';
    expect(entry, 'and what did happen is said').toContain('They have just entered the game');
    expect(entry, 'no move is claimed either').not.toMatch(/They walked here|brought down|carried up/);
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

describe('asking the companion', () => {
  /**
   * `Guide.answer` and its `history` were written when the companion was, and
   * nothing had ever called either. A player could be answered about a report
   * and could not ask a question — while the published app has exactly that: a
   * chat screen with the last few messages replayed.
   */

  const promptOf = (calls: { messages: { role: string; content: string }[] }[]) =>
    calls.at(-1)?.messages ?? [];

  async function seated(guide?: Guide) {
    const harnessed = harness({ guide, reports: new MemoryReportSink() });
    await harnessed.bot.handleUpdate(message('/new', PRIVATE));
    await harnessed.bot.handleUpdate(message('/start', PRIVATE));
    await rollUntilTheGate(harnessed.bot, harnessed.sent);
    return harnessed;
  }

  it('answers a question about the square the player stands on', async () => {
    const recorder = recordingModel('an answer');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const { bot, sent } = await seated(guide);

    await bot.handleUpdate(message('/ask what does this plan ask of me?', PRIVATE));

    expect(texts(sent)).toContain('an answer');
    const asked = promptOf(recorder.calls);
    expect(asked.at(-1)).toEqual({ role: 'user', content: 'what does this plan ask of me?' });
    expect(asked[0]?.content).toMatch(/The player is on plan \d+/);
  });

  it('carries the conversation, in the order it happened', async () => {
    // The point of a history, and the thing the published app gets wrong: it
    // sends all the questions and then all the answers.
    const recorder = recordingModel('an answer');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const { bot } = await seated(guide);

    await bot.handleUpdate(message('/ask first', PRIVATE));
    await bot.handleUpdate(message('/ask second', PRIVATE));

    const asked = promptOf(recorder.calls);
    const roles = asked.map((entry) => entry.role);

    expect(roles).toEqual(['system', 'user', 'assistant', 'user']);
    expect(asked[1]?.content).toBe('first');
    expect(asked[3]?.content).toBe('second');
  });

  it('asks for a question when none was given', async () => {
    const guide = new Guide({ model: fixedModel('an answer'), log: () => undefined });
    const { bot, sent } = await seated(guide);

    await bot.handleUpdate(message('/ask', PRIVATE));
    expect(texts(sent).at(-1)).toMatch(/Ask what/i);
  });

  it('says so when there is no companion, rather than going quiet', async () => {
    // The bot runs without a key on purpose; a command that answered nothing
    // would read as broken.
    const { bot, sent } = await seated();

    await bot.handleUpdate(message('/ask anything', PRIVATE));
    expect(texts(sent).at(-1)).toMatch(/not answering/i);
  });

  it('does not remember an answer the model did not give', async () => {
    // The fallback sentence is what a player sees when the companion is down.
    // Replaying it as the companion's own words would teach the model that
    // this is how it talks.
    const seen: Array<{ role: string; content: string }[]> = [];
    const refusing: LanguageModel = {
      id: 'refusing',
      async complete(messages) {
        seen.push(messages as Array<{ role: string; content: string }>);
        throw new ModelError('no balance', 402);
      },
    };

    const guide = new Guide({ model: refusing, log: () => undefined, silenceMs: 0 });
    const { bot } = await seated(guide);

    await bot.handleUpdate(message('/ask first', PRIVATE));
    await bot.handleUpdate(message('/ask second', PRIVATE));

    expect(seen.length).toBeGreaterThan(0);
    for (const messages of seen) {
      expect(messages.filter((entry) => entry.role === 'assistant')).toHaveLength(0);
    }
  });
});

describe('asking in a group', () => {
  /**
   * A reflection on your own report is private, and so is an answer to your own
   * question. `/ask` goes through `deliver`, which decides where a reply
   * belongs — but a command added later inherits that only if it was written to
   * go through it, and the way to find out is to ask in a group.
   */

  it('answers privately, not to the table', async () => {
    const recorder = recordingModel('a private answer');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const { bot, sent } = harness({ guide, reports: new MemoryReportSink() });

    await bot.handleUpdate(message('/new', GROUP));
    await bot.handleUpdate(message('/ask what does this ask of me?', GROUP));

    const toGroup = sent.filter(
      (entry) => entry.method === 'sendMessage' && String(entry.payload.chat_id) === String(GROUP.id),
    );
    expect(toGroup.some((entry) => String(entry.payload.text).includes('a private answer'))).toBe(
      false,
    );
  });

  it('is answerable from a private chat while the table is in a group', async () => {
    // The answer is private, so a private chat is where a thoughtful player
    // asks — and there is no table there. This used to reply "take a seat
    // first" to somebody holding a seat.
    const recorder = recordingModel('an answer');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const { bot, sent } = harness({ guide, reports: new MemoryReportSink() });

    await bot.handleUpdate(message('/new', GROUP));
    await bot.handleUpdate(message('/start', GROUP));
    // On the board before asking. The companion answers from the text of the
    // square the player stands on, and until a six there is no such square —
    // which the bot now says rather than pretending they are on 68.
    await rollUntilTheGate(bot, sent, GROUP);

    const before = sent.length;
    await bot.handleUpdate(message('/ask what does this plan ask of me?', PRIVATE));

    expect(texts(sent.slice(before))).toContain('an answer');
  });

  it('says where the answer went, rather than going quiet', async () => {
    // A player who asked in a chat and saw nothing would think the bot broke.
    const recorder = recordingModel('a private answer');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const { bot, sent, blocking } = harness({ guide, reports: new MemoryReportSink() });
    // Telegram refuses a bot that has never been started by this person.
    blocking.add('100');

    await bot.handleUpdate(message('/new', GROUP));
    const before = sent.length;
    await bot.handleUpdate(message('/ask what does this ask of me?', GROUP));

    expect(texts(sent.slice(before)).length).toBeGreaterThan(0);

    expect(texts(sent).length).toBeGreaterThan(0);
  });
});

describe('asking before the first six', () => {
  /**
   * The companion answers from the text of the square the player stands on —
   * *"It is the source; you are not"* — and a player who has not entered stands
   * on none. The engine parks them on `WIN_LOKA` until a six moves them, so
   * `/ask` used to hand the model **plan 68, Cosmic Consciousness**, and every
   * answer before the first throw rested on the last square of the board.
   *
   * The eighth time the 68 ambiguity has turned up here, and the third command
   * caught by it.
   */

  it('never tells the companion the player is on the winning square', () => {
    // The shape rather than the sentence: whatever the bot says, it must not
    // have asked the model about a square nobody is standing on.
    const recorder = recordingModel('an answer');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const { bot } = harness({ guide, reports: new MemoryReportSink() });

    return (async () => {
      await bot.handleUpdate(message('/new', PRIVATE));
      await bot.handleUpdate(message('/start', PRIVATE));
      await bot.handleUpdate(message('/ask what is this game?', PRIVATE));

      expect(recorder.calls).toHaveLength(0);
    })();
  });

  it('says why, and points at something a player can actually read', () => {
    const recorder = recordingModel('an answer');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const { bot, sent } = harness({ guide, reports: new MemoryReportSink() });

    return (async () => {
      await bot.handleUpdate(message('/new', PRIVATE));
      await bot.handleUpdate(message('/start', PRIVATE));

      const before = sent.length;
      await bot.handleUpdate(message('/ask what is this game?', PRIVATE));

      const said = texts(sent.slice(before)).join(' ');
      expect(said).toMatch(/not on the board/i);
      expect(said).toContain('/rules');
    })();
  });

  it('answers once the player is on a square, as it always did', () => {
    const recorder = recordingModel('an answer');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const { bot, sent } = harness({ guide, reports: new MemoryReportSink() });

    return (async () => {
      await bot.handleUpdate(message('/new', PRIVATE));
      await bot.handleUpdate(message('/start', PRIVATE));
      await rollUntilTheGate(bot, sent);

      const before = sent.length;
      await bot.handleUpdate(message('/ask what does this ask of me?', PRIVATE));

      expect(texts(sent.slice(before))).toContain('an answer');
      expect(recorder.calls.length).toBeGreaterThan(0);
    })();
  });
});

describe('a question sees what a report sees', () => {
  /**
   * The same companion, two ways in, and only one of them could see the path.
   *
   * The report gate has passed the player's whole history since it was written;
   * `/ask` passed none. Since the eighty-eighth pass that gap is wider than it
   * looks: the prompt puts what the player wrote *the last times they stood on
   * this very square* ahead of everything else, and a question about that square
   * was the one place it could not reach.
   */

  it('carries what the player wrote before, when they ask about a square', () => {
    /**
     * The account has to be about a square they have *left*. Written on the
     * square they are standing on, it is not path — it is this arrival, and the
     * test below is what happens when it is passed as though it were.
     */
    const recorder = recordingModel('an answer');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const reports = new MemoryReportSink();
    const { bot, sent } = harness({ guide, reports });

    return (async () => {
      await bot.handleUpdate(message('/new', PRIVATE));
      await bot.handleUpdate(message('/start', PRIVATE));
      await rollUntilTheGate(bot, sent);
      await bot.handleUpdate(
        message('/report the first account, long enough to count as one', PRIVATE),
      );
      // And on, so that the account is behind them.
      await bot.handleUpdate(message('/roll', PRIVATE));

      await bot.handleUpdate(message('/ask what does this ask of me?', PRIVATE));

      const prompt = String(recorder.calls.at(-1)?.messages?.[0]?.content ?? '');
      expect(prompt).toContain('the first account');
    })();
  });

  it('does not offer this arrival\'s own account as a return', () => {
    /**
     * Found by reading the prompt of a real game. The report gate and the
     * handed-over square both take out the words they are about to answer —
     * *so the companion is not handed the words it is about to answer as
     * though they were already history* — and `/ask` took none out.
     *
     * So a player who arrived on a square, wrote about it because the game
     * requires that before anything else, and then asked a question, had their
     * own minutes-old account announced to the model as **They have stood here
     * before, and wrote:** — under a paragraph asking it to notice *what
     * changed between the tellings*, of which there was one.
     */
    const recorder = recordingModel('an answer');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const { bot, sent } = harness({ guide, reports: new MemoryReportSink() });

    return (async () => {
      await bot.handleUpdate(message('/new', PRIVATE));
      await bot.handleUpdate(message('/start', PRIVATE));
      await rollUntilTheGate(bot, sent);
      await bot.handleUpdate(
        message('/report the account of this very arrival, long enough to count', PRIVATE),
      );

      await bot.handleUpdate(message('/ask what does this ask of me?', PRIVATE));

      const prompt = String(recorder.calls.at(-1)?.messages?.[0]?.content ?? '');

      expect(prompt, 'a first visit is not a return').not.toContain('stood here before');
      expect(prompt, "and this arrival's words are not path").not.toContain(
        'the account of this very arrival',
      );
      expect(prompt, 'the square itself is still what the answer rests on').toMatch(
        /The player is on plan \d+/,
      );
    })();
  });

  it('still offers a real return, when this arrival has not been written about', () => {
    /**
     * The other half. What comes out is the account for *this* arrival, and
     * only once the gate says there is one — so a player who lands on a square
     * they have stood on before and asks **before** writing must still be met
     * with what they said last time. That is the whole reason the returns
     * section exists: the eight-most-recent window cannot see it.
     */
    const recorder = recordingModel('an answer');
    const guide = new Guide({ model: recorder, log: () => undefined });

    /**
     * A clock the test moves rather than one it reads.
     *
     * The die is seeded from `(chatId, now())`. Reading the real clock played a
     * different game every run, and whether a square came back inside the bound
     * was then a draw: this failed about one run in twelve, on CI first. A
     * player can also *finish* — after that no throw moves anybody, and the
     * remaining turns are spent on a board nobody is on.
     *
     * So: fixed games, played in order, until one of them returns somebody to a
     * square they have written about. Deterministic, and not one lucky sample.
     */
    let clock = 1_700_000_000_000;

    const { bot, sent } = harness({
      guide,
      reports: new MemoryReportSink(),
      now: () => clock,
    });

    return (async () => {
      for (let game = 0; game < 6; game += 1) {
        // A different seed, the same one on every run.
        clock += 60_000;
        await bot.handleUpdate(message('/new', PRIVATE));
        await bot.handleUpdate(message('/start', PRIVATE));
        // The die will not turn without one.
        await bot.handleUpdate(message('/intention to see what I keep avoiding', PRIVATE));

        const written = new Map<number, string>();

        for (let turn = 0; turn < 120; turn += 1) {
          const before = sent.length;
          await bot.handleUpdate(message('/roll', PRIVATE));
          const said = texts(sent.slice(before)).join(' ');

          const standing = /standing on (\d+)\./.exec(said);
          if (!standing) continue;

          const plan = Number(standing[1]);
          const earlier = written.get(plan);

          if (earlier) {
            // Back on a square already written about, and nothing filed yet for
            // this arrival.
            await bot.handleUpdate(message('/ask what has changed?', PRIVATE));
            const prompt = String(recorder.calls.at(-1)?.messages?.[0]?.content ?? '');

            expect(prompt, 'the earlier account is what a return is').toContain(earlier);
            expect(prompt).toContain('stood here before');
            return;
          }

          const account = `the account of plan ${plan}, long enough to count as one`;
          written.set(plan, account);
          await bot.handleUpdate(message(`/report ${account}`, PRIVATE));
        }
      }

      throw new Error('no square came back in six games');
    })();
  });

  it('carries nothing when there is nothing written yet', () => {
    // An empty path is not a path of one blank entry: the prompt should simply
    // not claim they have been anywhere.
    const recorder = recordingModel('an answer');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const { bot, sent } = harness({ guide, reports: new MemoryReportSink() });

    return (async () => {
      await bot.handleUpdate(message('/new', PRIVATE));
      await bot.handleUpdate(message('/start', PRIVATE));
      await rollUntilTheGate(bot, sent);
      await bot.handleUpdate(message('/ask what does this ask of me?', PRIVATE));

      const prompt = String(recorder.calls.at(-1)?.messages?.[0]?.content ?? '');
      expect(prompt).not.toContain('Where they have been');
      expect(prompt).not.toContain('stood here before');
    })();
  });
});

/** What a mini app hands over when it is opened from a keyboard button. */
function handedOver(data: string, chat: { id: number; type: 'private' | 'group' }, from = 100) {
  updateId += 1;
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: chat.id, type: chat.type, title: 'A table' },
      from: { id: from, is_bot: false, first_name: `P${from}` },
      web_app_data: { data, button_text: '📝' },
    },
  } as never;
}

describe('a square handed over by the mini app', () => {
  /**
   * The mini app has the plans, the returns and the whole path — everything the
   * companion is given except the companion. It is a static page: a model needs
   * a key, and a key in a browser bundle is a key given away.
   *
   * So the half of the product that was missing was never the reflection. It
   * was the bridge, and Telegram has one: a mini app opened from a keyboard
   * button may `sendData`, and the bot receives it. What arrives is the square
   * format both surfaces already read and write.
   */
  const square = squareText(41, 'The human plane', 'What it asked of me.', 'to stop hurrying');

  it('keeps the account and answers it', async () => {
    const recorder = recordingModel('a reflection');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const reports = new MemoryReportSink();
    const { bot, sent } = harness({ guide, reports });

    const before = sent.length;
    await bot.handleUpdate(handedOver(square, PRIVATE));

    const said = texts(sent.slice(before)).join(' ');
    expect(said).toContain('41');
    expect(said).toContain('a reflection');
    expect(await reports.history('100')).toHaveLength(1);
  });

  it('keeps it even when the companion cannot be reached', async () => {
    // The account is the thing that must not be lost to a model being slow or
    // absent, so it is filed first and answered second.
    const guide = new Guide({
      model: {
        id: 'absent',
        async complete() {
          throw new ModelError('no key');
        },
      } as LanguageModel,
      log: () => undefined,
    });
    const reports = new MemoryReportSink();
    const { bot, sent } = harness({ guide, reports });

    const before = sent.length;
    await bot.handleUpdate(handedOver(square, PRIVATE));

    expect(await reports.history('100')).toHaveLength(1);
    expect(texts(sent.slice(before)).length).toBeGreaterThan(0);
  });

  it('keeps it with no companion configured at all', async () => {
    const reports = new MemoryReportSink();
    const { bot } = harness({ reports });

    await bot.handleUpdate(handedOver(square, PRIVATE));

    expect(await reports.history('100')).toHaveLength(1);
  });

  it('takes the same square twice as one, as every other way in does', async () => {
    // A shared square carries no time, so it is stamped on arrival — and two
    // arrivals of one square would invent a return to a square nobody left.
    const reports = new MemoryReportSink();
    const { bot, sent } = harness({ reports });

    await bot.handleUpdate(handedOver(square, PRIVATE));
    const before = sent.length;
    await bot.handleUpdate(handedOver(square, PRIVATE));

    expect(await reports.history('100')).toHaveLength(1);
    expect(texts(sent.slice(before)).join(' ')).toMatch(/already have/i);
  });

  it('refuses what is not a square rather than filing something wrong', async () => {
    const reports = new MemoryReportSink();
    const { bot, sent } = harness({ reports });

    const before = sent.length;
    await bot.handleUpdate(handedOver('hello', PRIVATE));

    expect(await reports.history('100')).toHaveLength(0);
    expect(texts(sent.slice(before)).join(' ')).toMatch(/does not read as a square/i);
  });

  it('says so when there is nowhere to keep it', async () => {
    const { bot, sent } = harness({});

    const before = sent.length;
    await bot.handleUpdate(handedOver(square, PRIVATE));

    expect(texts(sent.slice(before)).join(' ')).toMatch(/not keeping reports/i);
  });
});

describe('a write a turn asked for, that did not happen', () => {
  /**
   * Two kinds of effect went through one `catch` with one sentence attached:
   * *a history that fails to write must not stop the game — the move has
   * already happened, and the board is the record that matters.*
   *
   * True of a move, which is bookkeeping about a board already saved in the
   * room. Not true of a report, which **is** the record the game is played to
   * produce — and the gate saying one was written lives in that same saved
   * room. So a sink that threw left the player told "has reported, you may
   * throw", the gate open, and their words gone with nothing anywhere saying
   * so. The mini app had exactly this at a full quota; the pass that hardened
   * the room did not reach past it.
   *
   * The rule is therefore about the kind of loss rather than about these two
   * effects: **what the player wrote is never lost quietly; what the game can
   * reconstruct may be.** A third kind of effect has to answer that question.
   */
  // The die is seeded from `(chatId, now())`, so a test that reads the clock
  // gets a different game every run — and an assertion on the words of a throw
  // is then a coin toss. Found by one: "throws 3" one run, "throws a six and
  // enters the game" the next.
  const FIXED = () => 1_700_000_000_000;

  const failing = (kind: 'report' | 'move') => {
    const reports = new MemoryReportSink();
    const steps = { record: async () => undefined };
    if (kind === 'report') {
      reports.record = async () => {
        throw new Error('the database went away');
      };
    } else {
      steps.record = async () => {
        throw new Error('the database went away');
      };
    }
    return { reports, steps };
  };

  it('is said out loud when it was the player’s own words', async () => {
    const { reports, steps } = failing('report');
    const { bot, sent } = harness({ reports, steps, now: FIXED });

    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));
    await rollUntilTheGate(bot, sent);

    const before = sent.length;
    await bot.handleUpdate(message('/report an account I would rather not lose', PRIVATE));
    const said = texts(sent.slice(before)).join(' ');

    expect(said, 'the loss is named').toMatch(/could not keep/i);
    expect(await reports.history?.('100'), 'and it really was lost').toEqual([]);
  });

  it('is not said when the game can reconstruct it', async () => {
    // A move that failed to file is a line missing from a history nobody reads
    // in the moment, about a board that is saved. Saying so would train a
    // player to ignore the sentence that matters.
    const { reports, steps } = failing('move');
    const { bot, sent } = harness({ reports, steps, now: FIXED });

    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));
    await bot.handleUpdate(message('/intention to see what I keep avoiding', PRIVATE));

    const before = sent.length;
    await bot.handleUpdate(message('/roll', PRIVATE));
    const said = texts(sent.slice(before)).join(' ');

    expect(said, 'the throw is described as it always was').toMatch(/throws/i);
    expect(said).not.toMatch(/could not keep/i);
  });

  it('leaves the throw standing, because they did write it', async () => {
    // The other half, and the same decision the mini app made: a database that
    // is full is not the player's doing, and shutting a gate they have earned
    // would charge them for it. The game goes on and the loss is admitted.
    const { reports, steps } = failing('report');
    const { bot, sent } = harness({ reports, steps, now: FIXED });

    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));
    await rollUntilTheGate(bot, sent);
    await bot.handleUpdate(message('/report an account I would rather not lose', PRIVATE));

    const before = sent.length;
    await bot.handleUpdate(message('/roll', PRIVATE));

    expect(texts(sent.slice(before)).join(' '), 'still playing').toMatch(/throws/i);
  });

  it('never describes a report as kept when it was not', async () => {
    // The exact sentence that did the damage. It is still sent — the gate is
    // open and that is true — so the test is that it never stands alone.
    const { reports, steps } = failing('report');
    const { bot, sent } = harness({ reports, steps, now: FIXED });

    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));
    await rollUntilTheGate(bot, sent);

    const before = sent.length;
    await bot.handleUpdate(message('/report an account I would rather not lose', PRIVATE));
    const said = texts(sent.slice(before));

    const claimsKept = said.some((line) => /has reported|you may throw/i.test(line));
    const admits = said.some((line) => /could not keep/i.test(line));
    expect(claimsKept && !admits, 'kept, said without the correction').toBe(false);
  });
});

describe('an update never ends in silence', () => {
  /**
   * Each surface that can fail has been given its own sentence, one at a time,
   * and each was found by going looking: a room that would not save, a report
   * that was not kept, a file that never arrived. The **reads** were not. About
   * thirty of them — `/path`, `/returns`, `/save`, the journey handed to the
   * companion — every one assuming a store that answers.
   *
   * A sink that throws on `history` took `/path` out of the middleware and left
   * the player looking at nothing. Guarding thirty call sites would guard
   * thirty of them, and the thirty-first would be found the same way.
   *
   * So the assertion is over the whole surface rather than over the sites
   * anybody thought of: **every command the bot registers, against a store and
   * a sink that refuse everything, still says something.** `registered()` reads
   * `bot.ts`, so a command added tomorrow is covered the day it is added.
   */
  const hostile = () => {
    const no = async () => {
      throw new Error('the database went away');
    };
    return {
      store: { get: no, save: no, delete: no, roomOf: no } as never,
      reports: { record: no, history: no, intention: no, setIntention: no } as never,
      steps: { record: no } as never,
    };
  };

  for (const command of registered()) {
    it(`answers ${command}`, async () => {
      const { bot, sent } = harness({ ...hostile(), now: () => 1_700_000_000_000 });

      await expect(bot.handleUpdate(message(command, PRIVATE))).resolves.toBeUndefined();
      expect(texts(sent).join(' '), 'something was said').not.toBe('');
    });
  }

  it('says something for plain text too, which is the commonest update of all', async () => {
    // A player who owes a report writes without a command. That path reads the
    // room, the sink and the journal before it says a word.
    const { bot, sent } = harness({ ...hostile(), now: () => 1_700_000_000_000 });

    await expect(
      bot.handleUpdate(message('an account of standing here', PRIVATE)),
    ).resolves.toBeUndefined();
    expect(texts(sent).join(' ')).not.toBe('');
  });

  it('does not throw when it cannot even say so', async () => {
    // The floor's own failure: Telegram refusing the apology. There is nothing
    // to be done about it, and an unhandled rejection is not it.
    const { bot } = harness({ ...hostile(), now: () => 1_700_000_000_000 });
    bot.api.config.use(async () => {
      throw new Error('Telegram is unreachable');
    });

    await expect(bot.handleUpdate(message('/path', PRIVATE))).resolves.toBeUndefined();
  });
});

describe('a new game is a new conversation', () => {
  /**
   * `Conversations.clear` says so in its own comment and had no caller
   * anywhere, so the sentence was true of nothing. A player who ended a table
   * and opened another went on being answered in the light of the one before
   * it — and the map holding those exchanges never gave a single one back, in a
   * process that is meant to run for months.
   *
   * Asserted where it shows: what the model is handed. The conversation is not
   * kept anywhere a player can see, so the only honest place to look is the
   * prompt.
   */
  const asked = (recorder: ReturnType<typeof recordingModel>) =>
    (recorder.calls.at(-1)?.messages ?? []).filter((message) => message.role === 'user');

  it('hands the model nothing from the game before', async () => {
    const recorder = recordingModel('an answer');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const reports = new MemoryReportSink();
    const { bot, sent } = harness({ guide, reports });

    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));
    await bot.handleUpdate(message('/intention to see what I keep avoiding', PRIVATE));
    // A player waiting to enter stands on no square, and `/ask` says so rather
    // than asking about one. The die has to land first.
    await rollUntilTheGate(bot, sent);
    await bot.handleUpdate(message('/ask what does this square want from me', PRIVATE));
    await bot.handleUpdate(message('/ask and what am I meant to do with that', PRIVATE));

    expect(asked(recorder).length, 'the second question carried the first').toBeGreaterThan(1);

    await bot.handleUpdate(message('/end', PRIVATE));
    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/start', PRIVATE));
    await rollUntilTheGate(bot, sent);
    await bot.handleUpdate(message('/ask a question in a new game', PRIVATE));

    const carried = asked(recorder).map((message) => message.content).join(' ');
    expect(carried).toContain('a question in a new game');
    // The questions, not the intention: what a player is playing for belongs to
    // them and survives a table, which is why it is kept by player and not by
    // room. The exchanges are the game's.
    expect(carried, 'nothing asked at the last table').not.toMatch(/meant to do with that/);
    expect(carried).not.toMatch(/what does this square want from me/);
  });

  it('leaves a player at another table alone', async () => {
    // The room being ended knows who was sitting at it, and nobody else. A
    // conversation is per player, and one player ending their game is not a
    // reason to forget somebody else's.
    const recorder = recordingModel('an answer');
    const guide = new Guide({ model: recorder, log: () => undefined });
    const { bot, sent } = harness({ guide, reports: new MemoryReportSink() });

    // Somebody else's table, played by somebody else. `rollUntilTheGate` throws
    // from the default sender, who is not seated here.
    await bot.handleUpdate(message('/new', GROUP, 200));
    await bot.handleUpdate(message('/start', GROUP, 200));
    await bot.handleUpdate(message('/intention to see what I keep avoiding', GROUP, 200));
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const before = sent.length;
      await bot.handleUpdate(message('/roll', GROUP, 200));
      if (texts(sent.slice(before)).join(' ').includes('before you move on')) break;
    }
    await bot.handleUpdate(message('/ask something at the group table', GROUP, 200));

    // A different player ends a different table.
    await bot.handleUpdate(message('/new', PRIVATE));
    await bot.handleUpdate(message('/end', PRIVATE));

    await bot.handleUpdate(message('/ask and a second one here', GROUP, 200));

    const carried = asked(recorder).map((message) => message.content).join(' ');
    expect(carried).toContain('something at the group table');
  });
});
