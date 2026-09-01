/**
 * A question nobody bounded, and a balance that belongs to everybody.
 *
 * `/ask` is the only surface in this bot that spends money with nothing at all
 * standing in its way. Everything else that reaches the companion is bounded by
 * the game itself: a reflection costs one model call per arrival, and the turn
 * and the report gate bound arrivals — five report messages on one arrival
 * produce one call. A question is bounded by how fast somebody can type.
 *
 * **Measured before the bound was written.** `createBot(...).handleUpdate`,
 * driven with a counting model: one player, fifty `/ask` updates, the clock
 * never advanced — fifty calls, no cooldown, no cap.
 *
 * The donor bot had a bound and it was a paywall —
 * `leela-chakra-bot/src/index.ts` refuses the roll once a player is past their
 * first request and has not subscribed, with three Telegram Stars tiers behind
 * it — and the rewrite took the companion and left the paywall. The obvious
 * next sentence, *so the donor rate-limited the model and we dropped that too*,
 * is **false**, and that is worth more than the sentence: the donor's own
 * `isLimitAi`, a three-a-day AI cap in `core/supabase/payments.ts`, is called
 * from nowhere. Neither codebase ever bounded the model. A grep of `apps/bot`
 * and `packages/ai` for cost, abuse, spam, bill and budget finds nothing — this
 * was never considered and rejected; it was never considered.
 *
 * And the failure is **shared**. Also measured: with the model answering 402,
 * one player's single `/ask` puts `Guide` into its half-hour silence, and a
 * second player who has done nothing gets the fallback with the model never
 * called. The silence lives in `packages/ai` and is left exactly where it is.
 * A per-player bound does not make it per-player; it slows how fast one player
 * can reach it.
 *
 * **What is asserted here is the shape, not a list of bad sequences.** Over a
 * grid of {how many questions, how far apart, which player}, the model calls
 * attributable to one player inside any window of `ASK_WINDOW_MS` are at most
 * `ASK_ALLOWANCE`, whatever the questions are — and a second player's share is
 * untouched by the first exhausting theirs. The one assertion that names a
 * number names a *measurement*: a burst of forty and a burst of twenty cost the
 * same, which is what saturating means and is what goes red the moment the
 * bound is a no-op.
 *
 * Not a `RuleSet` change, and it must not become one. The precedent is written
 * in `asked.test.ts`: the intention gate *lives in the surfaces and not in
 * `@leela/engine`*. Reports, rolls and the report gate are bounded already and
 * are deliberately left alone.
 */

import { describe, expect, it } from 'vitest';
import { Guide, type LanguageModel } from '@leela/ai';
import { messageFor } from '@leela/content';
import { currentPlayer, isWaitingToEnter } from '@leela/engine';
import { ASK_ALLOWANCE, ASK_WINDOW_MS, createBot } from '../src/bot';
import { join, openRoom, report, roll, start, type Room } from '../src/commands';
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

const CHAT = -9001;
const NOW = 1_700_000_000_000;

const ADA = { id: 11, first_name: 'Ada', is_bot: false };
const BOB = { id: 22, first_name: 'Bob', is_bot: false };

/**
 * A word each, appearing nowhere else in the game or the catalogue.
 *
 * A prompt is attributed to whoever asked by looking for their word in it. That
 * is sound because everything the companion is handed is already per-player —
 * the running conversation, the journey, the intention — which is the property
 * `whose-writing-the-companion-is-told.test.ts` holds. If it ever stops being
 * true this file starts miscounting, and that file goes red first.
 */
const ADAS = 'zephyr';
const BOBS = 'quokka';

let update = 0;

const from = (who: typeof ADA, text: string, language = 'en') => ({
  update_id: (update += 1),
  message: {
    message_id: update,
    date: 1_700_000_000,
    chat: { id: CHAT, type: 'group' as const, title: 'a table' },
    from: { ...who, language_code: language },
    text,
    entities: [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0]!.length }],
  },
});

/**
 * A table of two, played only until both are standing on a square.
 *
 * The companion refuses a question from a player who has not entered — there is
 * no square to answer about — so the fixture has to get past the first six.
 * Played through `commands` rather than through the bot: the model must be
 * called by the questions this file asks and by nothing else, and a reflection
 * on a report is a call like any other.
 */
function onTheBoard(): Room {
  let room = openRoom(String(CHAT), { id: String(ADA.id), name: 'Ada' }, 4242).room as Room;
  room = join(room, { id: String(BOB.id), name: 'Bob' }).room as Room;
  room = start(room, String(ADA.id)).room as Room;

  const asked = { intention: 'to see what I keep avoiding' };

  for (let turn = 0; turn < 500; turn += 1) {
    if (room.session.players.every((seat) => !isWaitingToEnter(seat.state))) break;

    const thrown = roll(room, currentPlayer(room.session).id, NOW + turn * 1_000, asked);
    if (thrown.room) room = thrown.room;

    // The gate: a seat that owes an account cannot throw again, and a fixture
    // that skips this spins five hundred times and gives up.
    for (const seat of room.session.players) {
      if (seat.reportSubmitted) continue;
      const filed = report(room, seat.id, `about ${seat.state.loka}`, NOW + turn * 1_000 + 1);
      if (filed.room) room = filed.room;
    }
  }

  return room;
}

/** The bot, assembled over that table, with a model that counts and a clock. */
async function atATable() {
  const clock = { at: NOW };
  const calls: Array<{ at: number; prompt: string }> = [];

  const model: LanguageModel = {
    id: 'counting',
    async complete(messages) {
      calls.push({ at: clock.at, prompt: messages.map((one) => one.content).join('\n') });
      return 'a reflection from the model';
    },
  };

  const store = new MemoryRoomStore();
  await store.save(onTheBoard());

  const said: string[] = [];
  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: () => undefined,
    store,
    reports: new MemoryReportSink(),
    guide: new Guide({ model, log: () => undefined, now: () => clock.at }),
    now: () => clock.at,
  });

  bot.api.config.use(async (_next, method, payload) => {
    if (method === 'sendMessage') said.push(String((payload as Record<string, unknown>).text));
    return { ok: true, result: { message_id: 1 } } as never;
  });

  /** One question, and whatever the bot answered it with. */
  const ask = async (who: typeof ADA, word: string, nth: number, language = 'en') => {
    const before = said.length;
    await bot.handleUpdate(
      from(who, `/ask what does ${word} number ${nth} keep coming back to`, language) as never,
    );
    return said.slice(before).join('\n');
  };

  /** Every model call that carries this player's word, in the order it happened. */
  const callsFor = (word: string) => calls.filter((one) => one.prompt.includes(word));

  return { bot, clock, ask, callsFor, said };
}

/**
 * The most calls that fall inside any window of `width`, anywhere in the run.
 *
 * The property is about *every* window and not about the run as a whole: a
 * bound that lets an hour's worth through in a minute and then goes quiet has
 * the right total and is not a bound.
 */
function busiestWindow(times: number[], width: number): number {
  let most = 0;
  for (const start of times) {
    const inside = times.filter((at) => at >= start && at - start < width).length;
    if (inside > most) most = inside;
  }
  return most;
}

describe('one player and a balance that is everybody\'s', () => {
  it('never lets one player past the allowance in any window, whatever they ask', async () => {
    // The grid. The counts are written out rather than derived from
    // `ASK_ALLOWANCE`, so that making the allowance boundless is a change to
    // the guard and not a change to the test that measures it.
    for (const questions of [8, 20, 40]) {
      for (const gap of [0, 1_000, 5 * 60_000, 25 * 60_000]) {
        const table = await atATable();

        for (let nth = 0; nth < questions; nth += 1) {
          await table.ask(ADA, ADAS, nth);
          table.clock.at += gap;
        }

        const where = `${questions} questions ${gap}ms apart`;
        expect(busiestWindow(table.callsFor(ADAS).map((one) => one.at), ASK_WINDOW_MS), where)
          .toBeLessThanOrEqual(ASK_ALLOWANCE);
      }
    }
  });

  it('holds the same bound when two players ask into the same window', async () => {
    // Interleaved, because a bound kept in one counter rather than one per
    // player passes every test above and fails this one — and a bound that is
    // per *chat* would be a rule about who may speak at a table.
    const table = await atATable();

    for (let nth = 0; nth < 40; nth += 1) {
      await table.ask(ADA, ADAS, nth);
      await table.ask(BOB, BOBS, nth);
      table.clock.at += 1_000;
    }

    for (const [who, word] of [['Ada', ADAS], ['Bob', BOBS]] as const) {
      expect(busiestWindow(table.callsFor(word).map((one) => one.at), ASK_WINDOW_MS), who)
        .toBeLessThanOrEqual(ASK_ALLOWANCE);
    }
  });

  it('saturates: twice the questions in one burst cost the companion no more', async () => {
    /**
     * The assertion that goes red when the bound is a no-op, and the reason it
     * is phrased as a comparison rather than as `calls <= ASK_ALLOWANCE`.
     *
     * Falsified on purpose: with the allowance returned as `Infinity` the
     * `<=` reads as satisfied by everything and stays green while nothing is
     * bounded at all. Two bursts compared against each other name the counts
     * themselves and cannot be satisfied that way — *expected 40 to be 20*.
     */
    const cost = async (questions: number) => {
      const table = await atATable();
      for (let nth = 0; nth < questions; nth += 1) await table.ask(ADA, ADAS, nth);
      return table.callsFor(ADAS).length;
    };

    const twenty = await cost(20);
    const forty = await cost(40);

    expect(forty, 'a burst of forty reached the model in full').toBeLessThan(40);
    expect(forty, 'twice the questions, twice the spending').toBe(twenty);
  });

  it('leaves a second player everything, whatever the first has spent', async () => {
    // The shared-balance half, which is the whole point: the bound exists so
    // that one player cannot answer for everybody, and a bound that made the
    // second player wait would be the same defect with a smaller number.
    const table = await atATable();

    for (let nth = 0; nth < 40; nth += 1) await table.ask(ADA, ADAS, nth);
    const adasShare = table.callsFor(ADAS).length;
    expect(adasShare, 'Ada spent something').toBeGreaterThan(0);

    for (let nth = 0; nth < adasShare; nth += 1) await table.ask(BOB, BOBS, nth);

    expect(table.callsFor(BOBS).length, 'Bob asked as much as Ada was allowed').toBe(adasShare);
    expect(table.callsFor(ADAS).length, 'and Ada is still where she was').toBe(adasShare);
  });

  it('says why it refused and when they may ask again, moving with the clock', async () => {
    const table = await atATable();
    const start = table.clock.at;

    // Spent in one moment, so the whole allowance falls out of the window
    // together and the wait is arithmetic rather than a guess.
    for (let nth = 0; nth < 40; nth += 1) await table.ask(ADA, ADAS, nth);

    for (const elapsed of [0, 60_000, ASK_WINDOW_MS - 5 * 60_000, ASK_WINDOW_MS - 30_000]) {
      table.clock.at = start + elapsed;
      const answer = await table.ask(ADA, ADAS, 999);
      const minutes = Math.max(1, Math.ceil((ASK_WINDOW_MS - elapsed) / 60_000));

      expect(answer, `${elapsed}ms in`).toContain(
        messageFor('en', 'ask.tooSoon', { count: minutes, allowed: ASK_ALLOWANCE }),
      );
    }
  });

  it('is a wait and not a ban: the window passes and the companion answers', async () => {
    const table = await atATable();
    const start = table.clock.at;

    for (let nth = 0; nth < 40; nth += 1) await table.ask(ADA, ADAS, nth);
    const spent = table.callsFor(ADAS).length;

    table.clock.at = start + ASK_WINDOW_MS;
    await table.ask(ADA, ADAS, 1_000);

    expect(table.callsFor(ADAS).length, 'the window passed and nothing came of it').toBe(spent + 1);
  });

  it('refuses in the language the player is speaking', async () => {
    // The refusal is one of the sentences a player reads at the moment the game
    // is least able to explain itself, and English there would compound a
    // refusal with confusion — the argument `fallbackText` is written under.
    const table = await atATable();
    const start = table.clock.at;

    for (let nth = 0; nth < 40; nth += 1) await table.ask(ADA, ADAS, nth, 'ru');

    // One, two and five minutes: Russian says минуту, минуты and минут, and a
    // catalogue offering only {one, other} prints "5 минуты" for one of them.
    for (const minutes of [1, 2, 5]) {
      table.clock.at = start + ASK_WINDOW_MS - minutes * 60_000;
      const answer = await table.ask(ADA, ADAS, 999, 'ru');

      expect(answer, `${minutes}`).toContain(
        messageFor('ru', 'ask.tooSoon', { count: minutes, allowed: ASK_ALLOWANCE }),
      );
      expect(answer, 'and not in the catalogue\'s language').not.toContain(
        messageFor('en', 'ask.tooSoon', { count: minutes, allowed: ASK_ALLOWANCE }),
      );
    }
  });

  it('spends nothing on the refusals that never reach the model', async () => {
    /**
     * Where the gate sits, asserted rather than assumed.
     *
     * `/ask` with nothing after it, a question from somebody at no seat, a
     * question from somebody not yet on the board: all three are answered
     * without a model call, and an allowance taken above them would let a
     * player lock themselves out of the companion by mistyping. Compared
     * against a fresh table rather than against a number, so this says *the
     * same as if they had not been sent* and cannot be satisfied by a bound
     * that has quietly changed size.
     */
    const untouched = await atATable();
    for (let nth = 0; nth < 40; nth += 1) await untouched.ask(ADA, ADAS, nth);

    const mistyped = await atATable();
    for (let nth = 0; nth < 40; nth += 1) {
      await mistyped.bot.handleUpdate(from(ADA, '/ask') as never);
    }
    expect(mistyped.callsFor(ADAS).length, 'an empty question called the model').toBe(0);

    for (let nth = 0; nth < 40; nth += 1) await mistyped.ask(ADA, ADAS, nth);

    expect(mistyped.callsFor(ADAS).length, 'the mistyping cost her a share').toBe(
      untouched.callsFor(ADAS).length,
    );
  });
});
