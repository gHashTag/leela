/**
 * Whose writing the companion is given when somebody asks it a question.
 *
 * `/save` sending a journal to the wrong *place* was the pass before. This is
 * the same leak one level in: not where the answer goes, but whose material the
 * answer is built from. The companion is sent the asker's path — every account
 * they have written, oldest first — because *a companion that cannot see the
 * path can only respond to a single square*. At a table that path belongs to one
 * person among several.
 *
 * Nothing held it. Measured before this was written, by putting the defect in:
 * reading `reports.history(room.session.players[0].id)` instead of the asker's
 * leaves **all six hundred and twenty-one** of this package's tests passing, and
 * so does taking the running conversation from the first seat. Bob asks a
 * question and Ada's year of writing goes to a model and comes back to him.
 *
 * The intention is the one of the three that is held, which is what makes this
 * worth writing down rather than assuming: *some* of the handler was defended,
 * so the file read as covered.
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
  await tell(BOB, '/intention what am I keeping the light on for');

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
  const wrote = new Set<number>();

  for (let round = 0; round < 500 && wrote.size < 2; round += 1) {
    for (const who of [ADA, BOB]) {
      await tell(who, '/roll');
      const answer = await tell(who, `/report ${words.get(who.id)}, on the ${round}th square`);

      if (/has reported/i.test(answer)) wrote.add(who.id);
    }
  }

  return { bot, sent, said, model, storage, tell, wrote };
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
    expect(table.wrote.size, 'both players wrote something').toBe(2);

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
