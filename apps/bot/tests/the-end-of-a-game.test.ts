/**
 * The last thing that happens, played rather than assembled from parts.
 *
 * `sixty-eight.test.ts` holds what the engine leaves behind on the winning
 * square, and `assembled.test.ts` plays a real game — as far as one account.
 * Nothing had ever played one to its end. The win is what the whole thing is
 * for, and every claim about it was a claim about a function.
 *
 * So this throws until somebody reaches Cosmic Consciousness, writing an account
 * whenever the gate closes, and then reads the end of the game:
 *
 * - the throw names the square, and says who reached it;
 * - the winner **still owes an account** — the game does not close without
 *   asking for one, which is the whole argument of the report gate carried to
 *   the last square;
 * - that account is taken, and the game called complete;
 * - it is in the path afterwards, on square 68, because a record that loses the
 *   last thing written is not a record;
 * - and a throw after that is refused in words that say what can still be done.
 *
 * **The bound is twenty thousand throws, and that is not a guess.** Twenty games
 * played here ran from ten throws to two hundred and fifty-seven, median
 * ninety-one; a die and a board of snakes has a long tail, and a test that fails
 * once a year because a game ran long is worse than no test. At about a third of
 * a millisecond a throw, the bound costs nothing to be generous with.
 */

import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBot } from '../src/bot';
import { openStorage } from '../src/storage';

const BOT_INFO = {
  id: 1,
  is_bot: true,
  first_name: 'Leela',
  username: 'leela',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business_account: false,
  has_main_web_app: false,
} as never;

const CHAT = -4242;
let update = 0;

const message = (text: string) => ({
  update_id: (update += 1),
  message: {
    message_id: update,
    date: 1_700_000_000,
    chat: { id: CHAT, type: 'group' as const, title: 'a table' },
    from: { id: 11, first_name: 'Ada', is_bot: false },
    text,
    entities: [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0]!.length }],
  },
});

interface Sent {
  method: string;
  payload: Record<string, unknown>;
}

/** A game played to Cosmic Consciousness, and everything the bot said doing it. */
async function playedToTheEnd() {
  const storage = openStorage({
    path: join(mkdtempSync(join(tmpdir(), 'leela-end-')), 'leela.db'),
    log: () => undefined,
  });
  const sent: Sent[] = [];

  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: () => undefined,
    store: storage.store,
    reports: storage.reports,
    steps: storage.steps,
  });

  bot.api.config.use(async (_next, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: { message_id: 1 } } as never;
  });

  const said = (from: number) =>
    sent
      .slice(from)
      .filter((one) => one.method === 'sendMessage')
      .map((one) => String(one.payload.text));

  await bot.handleUpdate(message('/new'));
  await bot.handleUpdate(message('/start'));
  await bot.handleUpdate(message('/intention to see it through to the end'));

  let winning: string[] = [];

  for (let throws = 0; throws < 20_000 && winning.length === 0; throws += 1) {
    const before = sent.length;
    await bot.handleUpdate(message('/roll'));
    const answer = said(before);
    const together = answer.join(' ');

    if (together.includes('Cosmic Consciousness')) winning = answer;
    else if (/before you move on/i.test(together)) {
      await bot.handleUpdate(message(`/report an account of the ${throws}th square, long enough to count`));
    }
  }

  return { bot, sent, said, storage, winning };
}

describe('a game played to Cosmic Consciousness', () => {
  it('ends with the square named, the winner named, and an account still owed', async () => {
    const { winning, storage } = await playedToTheEnd();
    storage.stopPruning?.();

    const together = winning.join('\n');

    expect(winning.length, 'the game was reached').toBeGreaterThan(0);
    expect(together).toContain('68');
    expect(together).toContain('Cosmic Consciousness');
    expect(together, 'the player who got there is named').toContain('Ada');
    // The gate holds to the last square: the game is not over until the square
    // it was played to reach has been written about.
    expect(together).toMatch(/\/report/);
  });

  it('takes the winner’s account, and says the game is complete', async () => {
    const { bot, sent, said, storage } = await playedToTheEnd();

    const before = sent.length;
    await bot.handleUpdate(message('/report I got here, and it turned out not to be about the square'));
    const answer = said(before).join('\n');
    storage.stopPruning?.();

    expect(answer).toContain('Ada');
    expect(answer.toLowerCase()).toContain('complete');
  });

  it('keeps that account, on the square it was written about', async () => {
    // A record that loses the last thing written is not a record — and the
    // closing message promises this one by name.
    const { bot, sent, said, storage } = await playedToTheEnd();

    await bot.handleUpdate(message('/report the last one, written on the winning square'));

    const before = sent.length;
    await bot.handleUpdate(message('/path'));
    const path = said(before).join('\n');
    storage.stopPruning?.();

    expect(path).toContain('the last one, written on the winning square');
    expect(path, 'filed under the square it belongs to').toMatch(/^68\./m);
  });

  it('refuses another throw, and says what can still be done', async () => {
    const { bot, sent, said, storage } = await playedToTheEnd();

    await bot.handleUpdate(message('/report the last one'));

    const before = sent.length;
    await bot.handleUpdate(message('/roll'));
    const answer = said(before).join('\n');
    storage.stopPruning?.();

    expect(answer.toLowerCase()).toContain('over');
    // A refusal that only refuses leaves a player at a dead end.
    expect(answer).toContain('/new');
    expect(answer).toContain('/path');
  });
});
