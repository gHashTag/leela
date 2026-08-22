/**
 * Plain words in a private chat reach the companion instead of a canned line.
 *
 * `answerInWords` had two dead ends. A player alone with the bot and no table
 * who asked *how does this game work?* read *No table here yet* — a refusal,
 * to somebody who had just asked the companion a question. A seated player who
 * had filed their account and typed a follow-up read the `/roll`-`/board`
 * hint, while `/ask` with the identical words was answered in full. Both are
 * the same defect: the conversation existed one command away, and plain words
 * — the way a person actually talks — could not reach it.
 *
 * What must NOT move is everything around those two cells. A group chat is
 * table talk, not a conversation with the bot, so both canned answers stand
 * there. A player who owes a report is writing it, and their words stay the
 * report. Words leading with `/` are still a command nobody registered. And
 * the seated case must be `/ask` — the same function, not a lookalike — which
 * is pinned here at the strongest point available: the model is handed
 * byte-identical prompts for identical questions, whichever way they arrived.
 */

import { describe, expect, it } from 'vitest';
import { Guide, ModelError, type LanguageModel, type Message } from '@leela/ai';
import { messageFor } from '@leela/content';
import { isWaitingToEnter } from '@leela/engine';
import { ASK_ALLOWANCE, ASK_WINDOW_MS, createBot, rulesText } from '../src/bot';
import { openRoom, report, roll, start, type Room } from '../src/commands';
import { MemoryReportSink, MemoryRoomStore } from '../src/store';

const BOT_INFO = {
  id: 1,
  is_bot: true,
  first_name: 'Leela',
  username: 'leela_test_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business_account: false,
  has_main_web_app: false,
} as never;

const NOW = 1_700_000_000_000;
const ADA = { id: 100, first_name: 'Ada', is_bot: false, language_code: 'en' };
const PRIVATE = { id: 100, type: 'private' as const };
const GROUP = { id: -9001, type: 'group' as const, title: 'a table' };

let update = 0;

const messageIn = (chat: typeof PRIVATE | typeof GROUP, text: string) => ({
  update_id: (update += 1),
  message: {
    message_id: update,
    date: 1_700_000_000,
    chat: { ...chat },
    from: ADA,
    text,
    entities: text.startsWith('/')
      ? [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0]!.length }]
      : undefined,
  },
});

/** A model that answers from a list, then keeps repeating the last entry. */
function answering(...replies: string[]) {
  const calls: Message[][] = [];
  const model: LanguageModel = {
    id: 'answering',
    async complete(messages) {
      calls.push(messages);
      return replies[Math.min(calls.length - 1, replies.length - 1)] ?? '';
    },
  };
  return { model, calls };
}

/**
 * A table of one, played until Ada stands on a square with her account filed.
 *
 * Built through `commands` rather than the bot, so the fixture spends nothing
 * of the model or the allowance. The die is seeded, so where she stands is
 * fixed — but read off the room rather than written here, because the seed is
 * not this test's to know.
 */
function onTheBoard(chatId: string): Room {
  let room = openRoom(chatId, { id: String(ADA.id), name: 'Ada' }, 4242).room as Room;
  room = start(room, String(ADA.id)).room as Room;

  const asked = { intention: 'to see what I keep avoiding' };

  for (let turn = 0; turn < 500; turn += 1) {
    const seat = room.session.players[0]!;
    if (!isWaitingToEnter(seat.state) && seat.reportSubmitted) return room;

    const thrown = roll(room, String(ADA.id), NOW + turn * 1_000, asked);
    if (thrown.room) room = thrown.room;

    const owing = room.session.players[0]!;
    if (!owing.reportSubmitted) {
      const filed = report(room, String(ADA.id), `about ${owing.state.loka}`, NOW + turn * 1_000 + 1);
      if (filed.room) room = filed.room;
    }
  }

  throw new Error('the fixture never reached a filed account');
}

/** The same table, stopped at the moment an account is owed. */
function owingAnAccount(chatId: string): Room {
  let room = openRoom(chatId, { id: String(ADA.id), name: 'Ada' }, 4242).room as Room;
  room = start(room, String(ADA.id)).room as Room;

  const asked = { intention: 'to see what I keep avoiding' };

  for (let turn = 0; turn < 500; turn += 1) {
    const seat = room.session.players[0]!;
    if (!isWaitingToEnter(seat.state) && !seat.reportSubmitted) return room;

    const thrown = roll(room, String(ADA.id), NOW + turn * 1_000, asked);
    if (thrown.room) room = thrown.room;
  }

  throw new Error('the fixture never came to owe an account');
}

/** The bot over a given room (or none), with everything it says captured. */
async function botWith({
  room,
  model,
  guide,
}: {
  room?: Room;
  model?: LanguageModel;
  guide?: Guide;
} = {}) {
  const store = new MemoryRoomStore();
  if (room) await store.save(room);

  const reports = new MemoryReportSink();
  const said: string[] = [];

  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: () => undefined,
    store,
    reports,
    now: () => NOW,
    guide:
      guide ?? (model ? new Guide({ model, log: () => undefined, now: () => NOW }) : undefined),
  });

  bot.api.config.use(async (_next, method, payload) => {
    if (method === 'sendMessage') said.push(String((payload as { text?: string }).text ?? ''));
    return { ok: true, result: { message_id: 1 } } as never;
  });

  /** One update in, and whatever the bot said back. */
  const tell = async (chat: typeof PRIVATE | typeof GROUP, text: string) => {
    const before = said.length;
    await bot.handleUpdate(messageIn(chat, text) as never);
    return said.slice(before).join('\n');
  };

  return { bot, store, reports, said, tell };
}

describe('a private chat with no table', () => {
  it('answers plain words from the model, resting on the board’s rules', async () => {
    const { model, calls } = answering('a six is what enters — shall I say more?');
    const table = await botWith({ model });

    const answered = await table.tell(PRIVATE, 'how does this game work?');

    expect(answered).toContain('a six is what enters');
    expect(answered, 'and not the dead end').not.toContain(
      messageFor('en', 'chat.noTableHelp'),
    );

    const system = calls[0]?.[0]?.content ?? '';
    expect(system, 'the whole board, from the engine').toContain(rulesText());
    expect(system, 'the way onto a table is the prompt’s to offer').toContain(
      '/new opens a table',
    );
    expect(calls[0]?.at(-1)?.content).toBe('how does this game work?');
  });

  it('keeps the old sentence exactly when there is no guide at all', async () => {
    const table = await botWith();
    expect(await table.tell(PRIVATE, 'how does this game work?')).toBe(
      messageFor('en', 'chat.noTableHelp'),
    );
  });

  it('keeps it when the model fails, and when the silence that follows holds', async () => {
    // A 402 answers the first question and silences the companion; the second
    // question must read the same sentence as today without a model call —
    // the silence is `Guide`'s, and this route must not be a way around it.
    let calls = 0;
    const refusing: LanguageModel = {
      id: 'refusing',
      async complete() {
        calls += 1;
        throw new ModelError('no balance', 402);
      },
    };
    const table = await botWith({
      guide: new Guide({
        model: refusing,
        log: () => undefined,
        now: () => NOW,
      }),
    });

    expect(await table.tell(PRIVATE, 'how do I start?')).toBe(
      messageFor('en', 'chat.noTableHelp'),
    );
    expect(await table.tell(PRIVATE, 'anyone there?')).toBe(
      messageFor('en', 'chat.noTableHelp'),
    );
    expect(calls, 'the silence was honoured').toBe(1);
  });

  it('spends the same allowance a /ask spends, and says so when it is gone', async () => {
    // Without this the no-table chat would be the one surface that reaches
    // the model with nothing standing in the way — the exact defect
    // `a-question-nobody-bounded.test.ts` measured `/ask` into a bound over.
    const { model, calls } = answering('answered');
    const table = await botWith({ model });

    for (let nth = 0; nth < ASK_ALLOWANCE + 3; nth += 1) {
      await table.tell(PRIVATE, `question number ${nth}`);
    }

    expect(calls.length, 'the model saw the allowance and no more').toBe(ASK_ALLOWANCE);
    expect(table.said.at(-1)).toContain(
      messageFor('en', 'ask.tooSoon', {
        count: Math.ceil(ASK_WINDOW_MS / 60_000),
        allowed: ASK_ALLOWANCE,
      }),
    );
  });

  it('remembers only what the model really said', async () => {
    // fromModel-only, on the new path: the first answer is empty — delivered
    // as the dead-end sentence — and must not be replayed as history, or the
    // companion is taught that refusing is how it talks.
    const { model, calls } = answering('', 'a real answer', 'noted');
    const table = await botWith({ model });

    expect(await table.tell(PRIVATE, 'first question')).toBe(
      messageFor('en', 'chat.noTableHelp'),
    );

    await table.tell(PRIVATE, 'second question');
    expect(calls[1], 'nothing worth remembering yet').toHaveLength(2);

    await table.tell(PRIVATE, 'third question');
    const replayed = (calls[2] ?? []).map((m) => m.content).join('\n');
    expect(replayed).toContain('second question');
    expect(replayed).toContain('a real answer');
    expect(replayed).not.toContain('first question');
  });
});

describe('a private chat at a table, the account already filed', () => {
  it('answers exactly as /ask answers: byte-identical prompts for identical words', async () => {
    /**
     * The strongest pin available. Not "both mention the plan" — the same
     * store contents, the same seed, the same question, and then the entire
     * message array the model receives compared whole. The day the words path
     * builds its own context, this names the first byte that drifts.
     */
    const question = 'why do I keep arriving at the same shoreline?';
    const room = onTheBoard(String(PRIVATE.id));

    const fixtures = [] as Array<ReturnType<typeof answering>['calls']>;
    for (const asWords of [false, true]) {
      const { model, calls } = answering('noted');
      const table = await botWith({ room, model });
      await table.reports.setIntention(String(ADA.id), 'to see what I keep avoiding');
      await table.reports.record({ userId: String(ADA.id), plan: 6, text: 'the beginning', at: new Date(NOW) });

      await table.tell(PRIVATE, asWords ? question : `/ask ${question}`);
      fixtures.push(calls);
    }

    const [viaAsk, viaWords] = fixtures;
    expect(viaWords?.[0], 'the words reached the companion').toBeDefined();
    expect(viaWords?.[0]).toEqual(viaAsk?.[0]);
  });

  it('sends the words themselves, and the answer back', async () => {
    const { model, calls } = answering('sit with the shoreline a moment longer');
    const table = await botWith({ room: onTheBoard(String(PRIVATE.id)), model });

    const answered = await table.tell(PRIVATE, 'what does this square want from me?');

    expect(calls[0]?.at(-1)?.content).toBe('what does this square want from me?');
    expect(answered).toContain('sit with the shoreline');
    expect(answered).not.toContain(messageFor('en', 'chat.hint'));
  });

  it('falls back exactly as /ask falls back: the plan named, the outage said', async () => {
    const failing: LanguageModel = {
      id: 'failing',
      async complete() {
        throw new Error('fetch failed');
      },
    };
    const room = onTheBoard(String(PRIVATE.id));
    const plan = room.session.players[0]!.state.loka;
    const table = await botWith({ room, model: failing });

    expect(await table.tell(PRIVATE, 'what does this square want?')).toContain(
      messageFor('en', 'companion.unavailable', { plan }),
    );
  });

  it('remembers only what the model really said, on this path too', async () => {
    const { model, calls } = answering('', 'a real answer', 'noted');
    const table = await botWith({ room: onTheBoard(String(PRIVATE.id)), model });

    await table.tell(PRIVATE, 'first question');
    await table.tell(PRIVATE, 'second question');
    expect(calls[1], 'the fallback was not replayed').toHaveLength(2);

    await table.tell(PRIVATE, 'third question');
    const replayed = (calls[2] ?? []).map((m) => m.content).join('\n');
    expect(replayed).toContain('second question');
    expect(replayed).toContain('a real answer');
    expect(replayed).not.toContain('first question');
  });

  it('shares one allowance with /ask rather than opening a second one', async () => {
    const { model, calls } = answering('answered');
    const table = await botWith({ room: onTheBoard(String(PRIVATE.id)), model });

    for (let nth = 0; nth < ASK_ALLOWANCE; nth += 1) {
      await table.tell(
        PRIVATE,
        nth % 2 === 0 ? `question number ${nth}` : `/ask question number ${nth}`,
      );
    }
    expect(calls.length, 'both spellings spent from one share').toBe(ASK_ALLOWANCE);

    expect(await table.tell(PRIVATE, '/ask one more')).toContain(
      messageFor('en', 'ask.tooSoon', {
        count: Math.ceil(ASK_WINDOW_MS / 60_000),
        allowed: ASK_ALLOWANCE,
      }),
    );
  });

  it('still hints a player who is waiting to enter, because the die is the answer', async () => {
    // She stands on no square; `/ask` refuses her for the same reason. The
    // hint — throw the die — is the right sentence already, so it stays.
    let waiting = openRoom(String(PRIVATE.id), { id: String(ADA.id), name: 'Ada' }, 4242)
      .room as Room;
    waiting = start(waiting, String(ADA.id)).room as Room;

    const { model, calls } = answering('never this');
    const table = await botWith({ room: waiting, model });

    expect(await table.tell(PRIVATE, 'is it my turn?')).toBe(messageFor('en', 'chat.hint'));
    expect(calls).toHaveLength(0);
  });
});

describe('what must not move', () => {
  it('a group chat keeps both canned answers, model untouched', async () => {
    const { model, calls } = answering('never this');

    const noTable = await botWith({ model });
    expect(await noTable.tell(GROUP, 'how does this game work?')).toBe(
      messageFor('en', 'chat.noTableHelp'),
    );

    const seated = await botWith({ room: onTheBoard(String(GROUP.id)), model });
    expect(await seated.tell(GROUP, 'what does this square want?')).toBe(
      messageFor('en', 'chat.hint'),
    );

    expect(calls, 'table talk is not a question to the companion').toHaveLength(0);
  });

  it('a player who owes an account is still filing it, not asking', async () => {
    const words = 'the salt marsh at low tide, and what I would not look at';
    const { model, calls } = answering('a reflection on the account');
    const room = owingAnAccount(String(PRIVATE.id));
    const table = await botWith({ room, model });

    const answered = await table.tell(PRIVATE, words);

    expect((await table.reports.history(String(ADA.id)))[0]?.text, 'the words are the report').toBe(
      words,
    );
    expect(answered).not.toContain(messageFor('en', 'chat.hint'));

    // The companion did answer — as a reflection on the account, through the
    // report gate, not as a question about the square.
    expect(calls[0]?.at(-1)?.content).toBe(words);
  });

  it('words leading with a slash are still a command nobody registered', async () => {
    const { model, calls } = answering('never this');
    const table = await botWith({ model });

    expect(await table.tell(PRIVATE, '/frobnicate the board')).toBe(
      messageFor('en', 'chat.unknown'),
    );
    expect(calls).toHaveLength(0);
  });
});
