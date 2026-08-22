/**
 * Asking where a private answer may go **before** paying a model to write one.
 *
 * A reflection and an answer are both private: at a table they go to the
 * player, not into the room. Telegram will not let a bot write to somebody who
 * has never opened a chat with it, and there is no way to ask in advance — the
 * only way to know is to try, which is why `DirectChannels` exists and
 * remembers the 403. So after the first refusal the outcome of the next one is
 * **known**, and every route in `bot.ts` went on calling the model anyway:
 * `deliver` asked `destinationFor` at the end, got `chat-fallback`, and dropped
 * the answer it had just paid for.
 *
 * **Measured on the round-8 survey, before this was written.** `/ask` five
 * times from a player at a table who had never started a private chat: five
 * model calls, one direct-message attempt, zero answers delivered, five
 * identical nudges in the group. The report gate twice: two model calls, zero
 * reflections delivered, four nudges — two per command, because the sentence
 * was emitted once per undeliverable reply and a gate produces two.
 *
 * Only the first call is unavoidable. Everything after it bought nothing, and
 * the model bill is the cheaper half of what it cost: `ASK_ALLOWANCE` is twelve
 * an hour and each discarded answer spent one, so a player at a table could
 * burn the hour on nothing and then be told to wait an hour.
 *
 * The rule was already written in this file for the *cheaper* case. `/save`
 * consults `destinationFor` before sending and its comment names the cost —
 * *without it a blocked player costs a failed API call on every `/save` they
 * type*. A free Telegram call was guarded and a paid model call was not, and
 * the doc-comment over the allowance claimed *everything above refuses without
 * touching the model*, which was false below the line for exactly the player it
 * was written to protect.
 *
 * **What is asserted here is the shape, not two route names.** The surfaces are
 * read out of `bot.ts` itself — every `bot.command(...)` and `bot.on(...)` it
 * registers — and a surface with no driver in this file fails the first test
 * rather than being quietly skipped. Which of them reach the companion is
 * *measured*, by driving each one against a counting model, and not listed. The
 * property is then asked of whatever that measurement returned:
 *
 *   - **no model call happens after a refusal has been recorded** — not "at
 *     most one per route", which a route driven once satisfies by accident;
 *   - **one nudge per command, never two**;
 *   - **what the player wrote is kept, byte for byte, whether or not there was
 *     anywhere to send an answer** — the reports were kept before this change
 *     and nothing of theirs may be lost to it;
 *   - and the inverse, so the fix cannot be *never call the model*: with the
 *     refusal removed, every companion route calls it exactly once.
 *
 * **What the measurement returned, on the day this was written.** Six of the
 * twenty-four registered surfaces reach the companion: `/report`, `/ask`, a
 * command carried in a caption, the mini app's hand-over, a plain caption and
 * plain words. With an open channel each calls the model exactly once. With the
 * channel refused, the whole run — twenty-four surfaces, three commands each —
 * makes **one** direct-message attempt and **no** model calls whatever, because
 * the refusal is earned by an ordinary private reply before any of the six is
 * reached. It was five calls for five questions.
 *
 * The last cell is the one that took two attempts to get right. A guard keyed
 * on a remembered refusal is a guard that can never let go: `DirectChannels`
 * only forgot a refusal by retrying and succeeding, and the retrying is exactly
 * what this change removes. A player refused in March who opens a chat with the
 * bot in April would have been told, forever, to open a chat with the bot. So
 * `deliver` now takes a successful send *into that player's own chat* as the
 * proof it is, and the last test here is the nudge's own advice, followed.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript. `callsTo` balances
// parentheses; a regular expression over this file reads `bot.command('plan')`
// out of the comment that explains it.
import { blank, callsTo } from '../../../scripts/lib/source.mjs';
import { Guide, type LanguageModel } from '@leela/ai';
import { messageFor } from '@leela/content';
import { toDocument } from '@leela/journal';
import { currentPlayer, isWaitingToEnter, owesReport } from '@leela/engine';
import { ASK_ALLOWANCE, createBot } from '../src/bot';
import { openRoom, roll, start, type Room } from '../src/commands';
import { nudgeToPrivate } from '../src/delivery';
import { MemoryEntitlementStore, MemoryReportSink, MemoryRoomStore } from '../src/store';

const SOURCE = readFileSync(resolve(__dirname, '../src/bot.ts'), 'utf8');

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
const ADA = { id: 11, first_name: 'Ada', is_bot: false, language_code: 'en' };

/** A word appearing nowhere else, so finding it means finding her writing. */
const HERS = 'zephyr';

/**
 * The stable half of the nudge, taken from the catalogue rather than typed out.
 *
 * A test that spells the English sentence goes red when a translator improves
 * it, which is how a check comes to be deleted rather than obeyed.
 */
const NUDGE = nudgeToPrivate('en', '{{c}}').split('{{c}}')[0] ?? '';

/**
 * The same, for *ask again in n minutes* — the sentence a player reads when
 * their allowance is gone. Taken apart at the first substitution, because the
 * number in it is the thing this file is arguing about.
 */
const TOO_SOON =
  messageFor('en', 'ask.tooSoon', { count: '{{n}}', allowed: '{{n}}' }).split('{{n}}')[0] ?? '';

/**
 * Every surface the bot registers, read out of the bot.
 *
 * The point of reading rather than listing: a route added tomorrow that reaches
 * the companion is held by this file the day it is written. If it is not driven
 * here the first test says so by name.
 */
function registrations(source: string): string[] {
  const seen: string[] = [];

  for (const call of [...callsTo(source, 'bot.command'), ...callsTo(source, 'bot.on')]) {
    const named = /^\s*(['"])([^'"]+)\1/.exec(call.args);
    // A registration whose surface is computed would be invisible to this, so
    // say so rather than passing over it.
    if (!named) throw new Error(`a surface registered without a literal name: ${call.whole.slice(0, 60)}`);
    if (!seen.includes(named[2] as string)) seen.push(named[2] as string);
  }

  return seen;
}

let update = 0;

const message = (fields: Record<string, unknown>) => ({
  update_id: (update += 1),
  message: {
    message_id: update,
    date: 1_700_000_000,
    chat: { id: CHAT, type: 'group' as const, title: 'a table' },
    from: ADA,
    ...fields,
  },
});

/** A slash command, with the entity Telegram puts on one. */
const command = (text: string) =>
  message({
    text,
    entities: [{ type: 'bot_command' as const, offset: 0, length: (text.split(/[\s\n]/)[0] ?? '').length }],
  });

/** The same, in her own chat with the bot, where nothing is private from anyone. */
const alone = (text: string) => ({
  update_id: (update += 1),
  message: {
    message_id: update,
    date: 1_700_000_000,
    chat: { id: ADA.id, type: 'private' as const },
    from: ADA,
    text,
    entities: [{ type: 'bot_command' as const, offset: 0, length: (text.split(' ')[0] ?? '').length }],
  },
});

/**
 * A square as the mini app writes one: a heading, a blank line, the words.
 * `parseSquare` requires the body, and a one-line square reads as unreadable.
 */
const square = (words: string) => `12. a square\n\n${words}`;

/**
 * One update per surface, keyed by the name the bot registers it under.
 *
 * Every one of these is checked against the registrations above, so this table
 * cannot fall behind the file it drives.
 */
const DRIVERS: Record<string, (words: string) => Array<Record<string, unknown>>> = {
  // A command in a caption: the middleware that rewrites the update so the
  // command handlers can see it. It reaches the report gate the long way round.
  'message::bot_command': (words) => [
    message({
      photo: [{ file_id: 'p', file_unique_id: 'p', width: 1, height: 1 }],
      caption: `/report ${words}`,
      caption_entities: [{ type: 'bot_command' as const, offset: 0, length: 7 }],
    }),
  ],
  start: () => [command('/start')],
  help: () => [command('/help')],
  new: () => [command('/new')],
  end: () => [command('/end')],
  'message:migrate_from_chat_id': () => [message({ migrate_from_chat_id: -1 })],
  'message:migrate_to_chat_id': () => [message({ migrate_to_chat_id: -1002 })],
  join: () => [command('/join')],
  roll: () => [command('/roll')],
  path: () => [command('/path')],
  take: (words) => [command(`/take ${square(words)}`)],
  'message:web_app_data': (words) => [
    message({ web_app_data: { button_text: 'send', data: square(words) } }),
  ],
  returns: () => [command('/returns')],
  board: () => [command('/board')],
  report: (words) => [command(`/report ${words}`)],
  rules: () => [command('/rules')],
  intention: (words) => [command(`/intention to find out what ${words} is`)],
  // The daily word's opt-out. It never reaches the companion; it is here
  // because every registered surface is, so a model call added to it tomorrow
  // is caught the day it is written.
  quiet: () => [command('/quiet')],
  /**
   * The four surfaces of the Telegram Stars rail.
   *
   * None of them reaches the companion and none of them may: a payment must
   * not cost a model call, and an answer to a pre-checkout query has ten
   * seconds to leave. They are here for the reason `/quiet` is — every
   * registered surface is driven, so the day one of them grows a model call it
   * is caught — and because a bot that could be made to pay for a reflection
   * by *sending it an invoice update* would be a surface nobody was watching.
   *
   * The bot under this harness is built with prices, so all four are really
   * registered; a dark bot registers none of them and this table would be
   * driving nothing. See `dark-until-a-price-is-named.test.ts` for that half.
   */
  pro: () => [command('/pro')],
  refund: () => [command('/refund no-such-charge')],
  pre_checkout_query: () => [
    {
      update_id: (update += 1),
      pre_checkout_query: {
        id: String(update),
        from: ADA,
        currency: 'XTR',
        total_amount: 150,
        invoice_payload: 'leela:pro:month:v1',
      },
    },
  ],
  'message:successful_payment': () => [
    message({
      successful_payment: {
        currency: 'XTR',
        total_amount: 150,
        invoice_payload: 'leela:pro:month:v1',
        telegram_payment_charge_id: 'charge-in-the-drive',
        provider_payment_charge_id: 'provider-charge',
      },
    }),
  ],
  ask: (words) => [command(`/ask what does ${words} keep coming back to`)],
  plan: () => [command('/plan 5')],
  'callback_query:data': () => [
    {
      update_id: (update += 1),
      callback_query: {
        id: String(update),
        from: ADA,
        chat_instance: '1',
        data: 'roll',
        message: {
          message_id: update,
          date: 1_700_000_000,
          chat: { id: CHAT, type: 'group' as const, title: 'a table' },
        },
      },
    },
  ],
  save: () => [command('/save')],
  // Words carried as a caption are still words, and still a report.
  'message:caption': (words) => [
    message({
      photo: [{ file_id: 'p', file_unique_id: 'p', width: 1, height: 1 }],
      caption: words,
    }),
  ],
  'message:document': () => [
    message({ document: { file_id: 'd', file_unique_id: 'd', file_name: 'path.json', file_size: 128 } }),
  ],
  'message:text': (words) => [message({ text: words })],
};

/**
 * A table where Ada is on the board and owes an account of where she landed.
 *
 * Rebuilt before every drive, so a route that ends the game or opens a new
 * table cannot change what the next route is asked about. What must *not* be
 * rebuilt between drives is the bot: the refusal it remembers is the subject.
 */
function owing(): Room {
  let room = openRoom(String(CHAT), { id: String(ADA.id), name: 'Ada' }, 4242).room as Room;
  room = start(room, String(ADA.id)).room as Room;

  for (let turn = 0; turn < 500; turn += 1) {
    const seat = room.session.players[0];
    if (!seat) throw new Error('a table with nobody at it');

    if (
      !isWaitingToEnter(seat.state) &&
      owesReport(seat.state, room.session.rules) &&
      !seat.reportSubmitted
    ) {
      return room;
    }

    const thrown = roll(room, currentPlayer(room.session).id, NOW + turn * 1_000, {
      intention: 'to see it through to the end',
    });
    if (!thrown.room) throw new Error('the die would not turn');
    room = thrown.room;
  }

  throw new Error('no table where an account is owed');
}

interface Call {
  /** Which surface was being driven when the model was called. */
  route: string;
  /** How many refusals the bot had already been handed. Must be zero. */
  refusalsBefore: number;
}

interface Drive {
  route: string;
  nth: number;
  calls: number;
  nudges: number;
}

/**
 * Drive every registered surface, `times` each, against one bot.
 *
 * One bot on purpose: what the bot remembers between commands is the whole
 * subject. The store is reset before each drive; the `DirectChannels` inside
 * the bot is not.
 */
async function driveEverything({ blocked, times }: { blocked: boolean; times: number }) {
  const store = new MemoryRoomStore();
  const sink = new MemoryReportSink(() => NOW);
  await sink.setIntention(String(ADA.id), 'to see it through to the end');

  const calls: Call[] = [];
  const sent: Array<{ route: string; method: string; to: string; text: string }> = [];
  let route = '(setting up)';
  let refusals = 0;
  let carried = '';

  const model: LanguageModel = {
    id: 'counting',
    async complete() {
      calls.push({ route, refusalsBefore: refusals });
      return 'a reflection from the model';
    },
  };

  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: () => undefined,
    store,
    reports: sink,
    guide: new Guide({ model, log: () => undefined, now: () => NOW }),
    now: () => NOW,
    // The document route, without the network. A real path, so the words in it
    // are kept and the "nothing of hers is lost" assertion has something to see.
    readFile: async () =>
      JSON.stringify(toDocument([{ plan: 9, text: `${HERS} in a file ${carried}`, at: NOW }])),
    // Priced, so the Stars rail's four surfaces are registered and this file
    // really drives them. Ada is named an operator for the same reason: an
    // unnamed sender falls through `/refund` to the ordinary unknown-command
    // answer, which would drive the guard rather than the command.
    stars: [{ id: 'month', stars: 150, days: 30 }],
    operators: [String(ADA.id)],
    entitlements: new MemoryEntitlementStore(),
  });

  bot.api.config.use(async (_next, method, payload) => {
    const to = String((payload as { chat_id?: unknown }).chat_id ?? '');
    sent.push({ route, method, to, text: String((payload as { text?: unknown }).text ?? '') });

    // Telegram's real answer to a message addressed to somebody who has never
    // started a chat with the bot, or who has blocked it.
    if (blocked && to === String(ADA.id)) {
      refusals += 1;
      throw Object.assign(new Error('Forbidden: bot was blocked by the user'), {
        error_code: 403,
        description: 'Forbidden: bot was blocked by the user',
      });
    }

    return { ok: true, result: { message_id: 1, file_path: 'files/path.json' } } as never;
  });

  const drives: Drive[] = [];

  for (const name of registrations(SOURCE)) {
    const driver = DRIVERS[name];
    if (!driver) continue; // The first test is what fails for this, by name.

    for (let nth = 1; nth <= times; nth += 1) {
      await store.save(owing());

      route = name;
      carried = `${HERS} ${name} ${nth}`;
      const from = { calls: calls.length, sent: sent.length };

      for (const one of driver(carried)) await bot.handleUpdate(one as never);

      drives.push({
        route: name,
        nth,
        calls: calls.length - from.calls,
        nudges: sent
          .slice(from.sent)
          .filter((s) => s.method === 'sendMessage' && s.to === String(CHAT) && s.text.startsWith(NUDGE))
          .length,
      });
    }
  }

  return { drives, calls, sent, kept: sink.reports.map((r) => `${r.plan} ${r.text}`).sort() };
}

describe('every surface this bot registers', () => {
  it('is driven by this file, so a new one cannot slip past the property', () => {
    const registered = registrations(SOURCE);
    const driven = Object.keys(DRIVERS);

    expect(registered.filter((name) => !driven.includes(name)), 'registered and not driven').toEqual([]);
    expect(driven.filter((name) => !registered.includes(name)), 'driven and not registered').toEqual([]);
    // A guard on the guard: `callsTo` returning nothing would make the two
    // lists agree by both being empty.
    expect(registered.length).toBeGreaterThan(20);
  });

  it('is a surface the file registers and not a name in a comment', () => {
    // `blank` is why: `bot.command('report')` appears in a comment explaining
    // how a caption reaches the command handlers, and a regular expression over
    // the raw file counts it as a registration.
    expect(blank(SOURCE)).not.toContain("bot.command('report') is");
  });
});

describe('with somewhere to put the answer', () => {
  it('calls the companion exactly once per command, on every route that reaches it', async () => {
    // The inverse cell. Without it the whole property is satisfied by a bot
    // that never calls a model at all.
    const open = await driveEverything({ blocked: false, times: 1 });
    const reaching = open.drives.filter((one) => one.calls > 0);

    expect(reaching.length, 'more than one route reaches the companion').toBeGreaterThan(2);
    expect(
      open.drives.filter((one) => one.calls > 1).map((one) => one.route),
      'no route calls the model twice for one command',
    ).toEqual([]);
    expect(open.calls.every((one) => one.refusalsBefore === 0)).toBe(true);
  });
});

describe('with nowhere to put the answer', () => {
  it('never calls the companion once a refusal has been recorded', async () => {
    // The property, and the reason this file exists. Not "at most one call per
    // route": a route driven once satisfies that by accident. Every route is
    // driven three times, and every model call is stamped with how many
    // refusals the bot had already been handed when it was made.
    const shut = await driveEverything({ blocked: true, times: 3 });
    const late = shut.calls.filter((one) => one.refusalsBefore > 0);
    const attempts = shut.sent.filter((one) => one.to === String(ADA.id));

    expect(
      late.map((one) => `${one.route} (after ${one.refusalsBefore} refusals)`),
      'model calls made after the answer was known to be undeliverable',
    ).toEqual([]);

    // **The run has to have earned a refusal**, or the assertion above is a
    // sentence about an empty list. One attempt, in seventy-odd commands: the
    // refusal is learned once, by a send that fails, and no route pays for it
    // again.
    expect(attempts.map((one) => `${one.route}/${one.method}`)).toHaveLength(1);

    // Measured, and worth writing down because it is stronger than the property
    // asked for: the first refusal here is earned by a *reply*, not by a
    // reflection, so across every surface this bot has, a player at a table who
    // has never opened a private chat costs the companion nothing at all.
    expect(shut.calls).toEqual([]);
  });

  it('says where to go once per command, and never twice', async () => {
    const shut = await driveEverything({ blocked: true, times: 3 });

    expect(
      shut.drives.filter((one) => one.nudges > 1).map((one) => `${one.route} said it ${one.nudges} times`),
      'the same sentence, twice, into the same group',
    ).toEqual([]);

    // And it is said: a bot that answers nothing at all also never says it
    // twice.
    expect(shut.drives.filter((one) => one.nudges === 1).length).toBeGreaterThan(3);
  });

  it('keeps every word she wrote, exactly as it keeps them when it can answer', async () => {
    // Nothing of the player's may be lost to this change. The reports were kept
    // before it — the account is filed and the reflection is a separate,
    // optional thing — and the strongest way to say so is that the two runs
    // leave the same writing behind, whatever happened to the answers.
    const open = await driveEverything({ blocked: false, times: 3 });
    const shut = await driveEverything({ blocked: true, times: 3 });

    expect(shut.kept.length, 'she wrote something worth losing').toBeGreaterThan(3);
    expect(shut.kept).toEqual(open.kept);
    expect(shut.kept.join('\n')).toContain(HERS);
  });
});

describe('the allowance, which is what the discarded answers really cost', () => {
  it('is not spent on answers that have nowhere to go, and the nudge tells the truth', async () => {
    // `ASK_ALLOWANCE` is twelve an hour and the clock does not move here, so a
    // player who spends one per discarded answer is locked out inside a single
    // burst — after which opening a chat with the bot, which is what the nudge
    // tells them to do, buys them a refusal to wait an hour.
    const store = new MemoryRoomStore();
    const sink = new MemoryReportSink(() => NOW);
    await sink.setIntention(String(ADA.id), 'to see it through to the end');
    await store.save(owing());

    let blocked = true;
    let calls = 0;
    const said: string[] = [];

    const bot = createBot({
      token: '1:TEST',
      botInfo: BOT_INFO,
      log: () => undefined,
      store,
      reports: sink,
      guide: new Guide({
        model: {
          id: 'counting',
          async complete() {
            calls += 1;
            return 'a reflection from the model';
          },
        },
        log: () => undefined,
        now: () => NOW,
      }),
      now: () => NOW,
    });

    bot.api.config.use(async (_next, method, payload) => {
      const to = String((payload as { chat_id?: unknown }).chat_id ?? '');
      if (method === 'sendMessage') said.push(String((payload as { text?: unknown }).text ?? ''));

      if (blocked && to === String(ADA.id)) {
        throw Object.assign(new Error('Forbidden: bot was blocked by the user'), {
          error_code: 403,
          description: 'Forbidden: bot was blocked by the user',
        });
      }

      return { ok: true, result: { message_id: 1 } } as never;
    });

    // More questions than the hour holds, every one of them undeliverable.
    for (let nth = 0; nth < ASK_ALLOWANCE + 2; nth += 1) {
      await bot.handleUpdate(command(`/ask what does ${HERS} number ${nth} keep returning to`) as never);
    }

    expect(calls, 'one call to learn it, and none after').toBeLessThanOrEqual(1);

    // She does what she was told: opens a chat with the bot and sends /start.
    // The bot can write to her now, and the proof is the message it just sent
    // into her own chat — so the remembered refusal is out of date.
    blocked = false;
    await bot.handleUpdate(alone('/start') as never);

    const before = calls;
    await bot.handleUpdate(command(`/ask what does ${HERS} keep returning to in the end`) as never);

    expect(calls - before, 'and now the companion answers her').toBe(1);
    expect(
      said.filter((one) => one.startsWith(TOO_SOON)),
      'and she was never told to wait an hour for questions nothing answered',
    ).toEqual([]);
  });
});
