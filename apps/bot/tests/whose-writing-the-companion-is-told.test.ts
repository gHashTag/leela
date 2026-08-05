/**
 * Whose writing the companion is given when somebody asks it a question.
 *
 * `/save` sending a journal to the wrong *place* was the pass before. This is
 * the same leak one level in: not where the answer goes, but whose material the
 * answer is built from. The companion is sent the player's path — every account
 * they have written, oldest first — because *a companion that cannot see the
 * path can only respond to a single square*. At a table that path belongs to one
 * person among several.
 *
 * **The companion is called from three places**, and each assembles the same
 * kind of material for itself: a question asked with `/ask`, a reflection on an
 * account just filed, and a square somebody handed over with `/take`. Each was
 * probed one decision at a time, because a combined mutation that turns a test
 * red reads as *defended* when only half of it is.
 *
 * Nothing held it. Measured before this was written, by putting the defect in:
 * reading `reports.history(room.session.players[0].id)` instead of the asker's
 * leaves **all six hundred and twenty-one** of this package's tests passing, and
 * so does taking the running conversation from the first seat. Bob asks a
 * question and Ada's year of writing goes to a model and comes back to him.
 *
 * The intention is the one of `/ask`'s three that is held, which is what makes
 * this worth writing down rather than assuming: *some* of the handler was
 * defended, so the file read as covered. The reflection on a filed account is
 * the mirror image — its journey is held and **its intention is not**, so an
 * account of Ada's could be answered under the question Bob is playing under.
 * And a handed-over square's path is held against being *another player's* and
 * not against being nobody's: reading a history for an id at no seat assembles
 * an empty journey, and the companion answers a stranger's square blind to
 * everything the taker has ever written, with nothing to say so.
 *
 * Asserted on the wire. `recordingModel` keeps what the model was actually
 * sent, and the property is over the whole of it rather than over a field:
 * **nothing of Ada's is in what the companion is told when Bob asks.** A fourth
 * thing added to the prompt tomorrow is held by that without being named.
 */

import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Guide, recordingModel } from '@leela/ai';
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

const TABLE = -4242;
const ADA = { id: 11, first_name: 'Ada', is_bot: false };
const BOB = { id: 22, first_name: 'Bob', is_bot: false };

/** Strings that appear nowhere else, so finding one means finding whose it is. */
const ADAS = 'the salt marsh at low tide, and what I would not look at';
const ADAS_QUESTION = 'why do I keep arriving at the same shoreline';
const BOBS = 'the hallway light left on all night in an empty flat';
const BOBS_QUESTION = 'what am I keeping the light on for';

let update = 0;

const from = (who: typeof ADA, text: string) => ({
  update_id: (update += 1),
  message: {
    message_id: update,
    date: 1_700_000_000,
    chat: { id: TABLE, type: 'group' as const, title: 'a table' },
    from: who,
    text,
    entities: [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0]!.length }],
  },
});

interface Sent {
  method: string;
  payload: Record<string, unknown>;
}

/**
 * A table of two, played until both are on the board with accounts behind them.
 *
 * The turn passes, so a roll is offered from each in turn and the one whose
 * turn it is not is refused — which costs nothing and saves the fixture from
 * having to read whose turn it is out of a sentence.
 */
async function atATableOfTwo() {
  const storage = openStorage({
    path: join(mkdtempSync(join(tmpdir(), 'leela-whose-')), 'leela.db'),
    log: () => undefined,
  });

  const model = recordingModel('a reflection from the model');
  const guide = new Guide({ model, log: () => undefined });
  const sent: Sent[] = [];

  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: () => undefined,
    store: storage.store,
    reports: storage.reports,
    steps: storage.steps,
    guide,
  });

  bot.api.config.use(async (_next, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: { message_id: 1 } } as never;
  });

  const said = (start: number) =>
    sent
      .slice(start)
      .filter((one) => one.method === 'sendMessage')
      .map((one) => String(one.payload.text))
      .join('\n');

  const tell = async (who: typeof ADA, text: string) => {
    const start = sent.length;
    await bot.handleUpdate(from(who, text) as never);
    return said(start);
  };

  // `/join` before `/start`: a seat taken after the game begins is refused with
  // *this game has already begun*, and the fixture then played a table of one
  // while looking like a table of two.
  await tell(ADA, '/new');
  await tell(BOB, '/join');
  await tell(ADA, '/start');
  await tell(ADA, `/intention ${ADAS_QUESTION}`);
  await tell(BOB, `/intention ${BOBS_QUESTION}`);

  // Both on the board with something written behind them. An account is offered
  // after every throw rather than when a sentence looks like the gate: the
  // words differ by how the square was reached — *before you move on* after an
  // ordinary landing, *once you have written* after a six — and reading a state
  // out of prose is how this repository has misread its own gate before. One
  // that is not owed is refused, which costs a message and nothing else.
  const words = new Map([
    [ADA.id, ADAS],
    [BOB.id, BOBS],
  ]);
  const wrote = new Map([
    [ADA.id, 0],
    [BOB.id, 0],
  ]);

  /**
   * One round of the table: a throw and an account offered from each seat.
   *
   * **Both seats, always.** A round that only rolls for one of them stops the
   * turn dead the first time it belongs to the other, and a loop waiting for an
   * account then spins five hundred times and gives up. Written that way first.
   */
  const round = async (nth: number) => {
    for (const who of [ADA, BOB]) {
      await tell(who, '/roll');
      const answer = await tell(who, `/report ${words.get(who.id)}, on the ${nth}th square`);

      if (/has reported/i.test(answer)) wrote.set(who.id, (wrote.get(who.id) ?? 0) + 1);
    }
  };

  /**
   * **Two accounts each, not one.**
   *
   * `behind` takes out the newest account on the square the player is standing
   * on, because the companion must not be handed the words it is about to
   * answer as though they were already history. With exactly one account that
   * is the whole path, and the prompt came out empty — which reads like a leak
   * and is a fixture that did not play far enough.
   */
  for (let nth = 0; nth < 500 && Math.min(...wrote.values()) < 2; nth += 1) {
    await round(nth);
  }

  /**
   * Throw and write until one account is actually accepted.
   *
   * A single `/roll` then `/report` is not enough and the die is the reason: it
   * may not be this player's turn, or the throw may not have moved them onto a
   * square that owes anything. Written as one throw first, and it passed alone
   * and produced an **empty prompt** under the full run, which reads like a
   * leak and is a fixture that did not play far enough.
   */
  const writeOnce = async (who: typeof ADA, text: string) => {
    for (let tries = 0; tries < 500; tries += 1) {
      // Through a whole round, so the turn keeps moving. Only this seat's words
      // are the ones being watched for; the other's keep the game going.
      await tell(who, '/roll');

      // Taken **immediately before** the account is filed, so what comes back
      // is the window this one report opened. Measured over everything since
      // the test began instead, and the other seat's reflection — asked for by
      // this very loop, to move the turn — was in it: the check reported a leak
      // that was the instrument reading its own noise.
      const from = model.calls.length;
      if (/has reported/i.test(await tell(who, `/report ${text}`))) return { filed: true, from };

      await tell(who === ADA ? BOB : ADA, '/roll');
      await tell(who === ADA ? BOB : ADA, `/report ${words.get(who === ADA ? BOB.id : ADA.id)}`);
    }

    return { filed: false, from: model.calls.length };
  };

  return { bot, sent, said, model, storage, tell, wrote, writeOnce };
}

/** Everything the model was told, across every call, as one piece of text. */
const toldTheModel = (
  model: { calls: Array<{ messages: Array<{ content: string }> }> },
  start: number,
): string =>
  model.calls
    .slice(start)
    .flatMap((call) => call.messages.map((message) => message.content))
    .join('\n');

describe('a question asked at a table of two', () => {
  it('is answered from the asker’s own path and nobody else’s', async () => {
    const table = await atATableOfTwo();
    expect(Math.min(...table.wrote.values()), 'both players wrote more than once').toBeGreaterThan(1);

    const start = table.model.calls.length;
    await table.tell(BOB, '/ask what is this square asking of me');
    table.storage.stopPruning?.();

    const told = toldTheModel(table.model, start);

    expect(table.model.calls.length, 'the companion was asked at all').toBeGreaterThan(start);
    // The property. Not "the journey field holds Bob's entries" — anything of
    // Ada's, anywhere in what the model was sent.
    expect(told, 'nothing Ada wrote').not.toContain(ADAS);
    expect(told, 'and not the question she is playing under').not.toContain(ADAS_QUESTION);
  });

  it('carries the asker’s own writing, so this is not an empty prompt', async () => {
    // A check that Ada's words are absent is worth nothing if Bob's are absent
    // too — that would pass with no journey assembled at all.
    const table = await atATableOfTwo();

    const start = table.model.calls.length;
    await table.tell(BOB, '/ask what is this square asking of me');
    table.storage.stopPruning?.();

    expect(toldTheModel(table.model, start)).toContain(BOBS);
  });

  it('keeps one player’s conversation with the companion out of another’s', async () => {
    // The running conversation is the other thing the prompt is built from, and
    // it was unguarded the same way. What Ada asked, and what she was told, is
    // hers.
    const table = await atATableOfTwo();

    await table.tell(ADA, `/ask ${ADAS_QUESTION}`);

    const start = table.model.calls.length;
    await table.tell(BOB, '/ask what is this square asking of me');
    table.storage.stopPruning?.();

    expect(toldTheModel(table.model, start)).not.toContain(ADAS_QUESTION);
  });
});

describe('a reflection on an account just filed', () => {
  // Bob's account, not Ada's, and the reason is the defect's own shape: Ada
  // opened the table, so she *is* `players[0]`, and a handler reading the first
  // seat by mistake would hand her own question back and show nothing. The
  // wrong-seat mutation is only visible from the seat that is not first.
  it('is framed by the question its author is playing under, and nobody else’s', async () => {
    // The mirror of `/ask`: here the journey is defended and the intention was
    // not. A reflection is shown privately to the player who wrote the account,
    // so what leaks is not what they see but what shaped it — Bob's question,
    // up to eight hundred characters of his own writing, sent to a model to
    // frame Ada's answer.
    const table = await atATableOfTwo();
    expect(Math.min(...table.wrote.values()), 'both players wrote more than once').toBeGreaterThan(1);

    const written = await table.writeOnce(BOB, `${BOBS}, and once more at the end`);
    table.storage.stopPruning?.();

    const told = toldTheModel(table.model, written.from);

    expect(written.filed, 'an account was filed').toBe(true);
    expect(table.model.calls.length, 'the companion was asked at all').toBeGreaterThan(written.from);
    expect(told, 'nothing of Ada’s').not.toContain(ADAS);
    expect(told, 'and not the question she is playing under').not.toContain(ADAS_QUESTION);
  });

  it('carries what its author has written before, so the path is there to read', async () => {
    // The positive half, and the one that keeps the check above from passing
    // over an empty prompt.
    const table = await atATableOfTwo();

    const written = await table.writeOnce(BOB, `${BOBS}, and once more at the end`);
    table.storage.stopPruning?.();

    expect(written.filed, 'an account was filed').toBe(true);
    expect(toldTheModel(table.model, written.from)).toContain(BOBS);
  });
});

describe('a square handed over from the mini app', () => {
  /**
   * A square as `squareText` writes one, from a player at another table.
   *
   * Handed over rather than pasted: `/take` in a chat files the same square and
   * deliberately does **not** call the companion — the hand-over is the path
   * that does, because it comes from the player's own app rather than from a
   * message anybody could paste. The first version of this test asked `/take`
   * and found no call at all, which is the handler behaving exactly as its
   * neighbour documents.
   */
  const handed = [
    '41. Ignorance (avidya)',
    '',
    'a square written somewhere else, by somebody at another table entirely',
  ].join('\n');

  const fromTheApp = (who: typeof ADA, data: string) => ({
    update_id: (update += 1),
    message: {
      message_id: update,
      date: 1_700_000_000,
      chat: { id: TABLE, type: 'group' as const, title: 'a table' },
      from: who,
      web_app_data: { data, button_text: '📝' },
    },
  });

  it('is answered with the taker’s own path behind it', async () => {
    // Held against being *another player's* path and not against being
    // nobody's: reading a history for an id at no seat assembles an empty
    // journey, and the companion then answers a stranger's square knowing
    // nothing of the taker — which is the state `journey` exists to end.
    const table = await atATableOfTwo();
    expect(Math.min(...table.wrote.values()), 'both players wrote more than once').toBeGreaterThan(1);

    const start = table.model.calls.length;
    await table.bot.handleUpdate(fromTheApp(ADA, handed) as never);
    table.storage.stopPruning?.();

    const told = toldTheModel(table.model, start);

    expect(table.model.calls.length, 'the companion was asked at all').toBeGreaterThan(start);
    expect(told, 'what Ada has written is behind it').toContain(ADAS);
    expect(told, 'and Bob’s is not').not.toContain(BOBS);
  });
});
