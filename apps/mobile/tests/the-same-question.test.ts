/**
 * Four places keep a game; one question decides whether it is one.
 *
 * The mini app checks a saved game and a saved table, the database checks a
 * seat row, and this app checks a file. Each had the rule written out by hand,
 * and three of the four agreed. The phone's asked that `state.loka` be a
 * *number* and nothing else — and the phone is the one that ships to a device
 * somebody owns and cannot inspect.
 *
 * Measured through this loader before anything was changed:
 *
 * - plan 999 came back as a game, drew a tile numbered 999, and no throw ever
 *   left it: `stop` forever, with nothing reporting a fault;
 * - plan 41.5 walked on to 47.5, a square the board has no text for;
 * - `is_finished` on plan 41 drew no square at all and still let the player
 *   throw off it, to 47;
 * - a `turnIndex` of 7 at a table of one was accepted here and then thrown by
 *   everything that read it — the tile, the throw gate, the move. On a phone
 *   that is the app failing to open, over a file whose only right answer was to
 *   begin again, which this loader already knew how to do;
 * - and the rule set was taken from the file as an *object*, so a hand-edited
 *   one was played as a variant the engine never defined: a state on a run of
 *   two sixes owes a report under `classic` and does not under `online`, and a
 *   forged `{id: 'online', ...classic flags}` answered `classic`'s question
 *   while calling itself `online`.
 *
 * So the assertion is not those five. It is that this loader and the engine
 * agree: a state the engine will not call playable is a file this app will not
 * open. A sixth way to corrupt a file is covered by the same sentence.
 */

import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  ONLINE,
  TOTAL_PLANS,
  WIN_LOKA,
  isSeatedTable,
  owesReport,
  type GameState,
  type RuleSet,
} from '@leela/engine';
import { loadKeptGame } from '../src/game-store';

const state = (over: Record<string, unknown> = {}) => ({
  loka: 10,
  previous_loka: 4,
  direction: 'step 🚶🏼',
  consecutive_sixes: 0,
  position_before_three_sixes: 0,
  is_finished: false,
  ...over,
});

const seat = (over: Record<string, unknown> = {}) => ({
  id: 'a',
  name: 'A',
  state: state(over),
  lastRollAt: null,
  lastReportAt: null,
  reportSubmitted: true,
});

const table = (over: Record<string, unknown> = {}, seats: unknown[] = [seat()]) => ({
  id: 's',
  players: seats,
  turnIndex: 0,
  rollCount: 3,
  rules: CLASSIC,
  ...over,
});

/** A file holding whatever is given, read the way the app reads it. */
const fileOf = (session: unknown) => ({
  read: async () => JSON.stringify({ seed: 7, rollsTaken: 3, session }),
  write: async () => true,
});

const open = (session: unknown) => loadKeptGame(fileOf(session) as never, CLASSIC);

/** Every field of the table, at and just past the edge of what it may hold. */
function* corruptions(): Generator<[string, unknown]> {
  const plans = [-5, 0, 0.5, 41.5, TOTAL_PLANS + 1, 999];
  for (const loka of plans) yield [`plan ${loka}`, table({}, [seat({ loka })])];
  for (const previous_loka of [-1, TOTAL_PLANS + 1]) {
    yield [`previous plan ${previous_loka}`, table({}, [seat({ previous_loka })])];
  }
  for (const consecutive_sixes of [-1, 3, 7, 1.5]) {
    yield [`${consecutive_sixes} sixes`, table({}, [seat({ consecutive_sixes })])];
  }
  for (const position_before_three_sixes of [-1, TOTAL_PLANS + 1]) {
    yield [`fallback ${position_before_three_sixes}`, table({}, [seat({ position_before_three_sixes })])];
  }
  for (const direction of ['', 'sideways', 'snake', 42, null]) {
    yield [`direction ${JSON.stringify(direction)}`, table({}, [seat({ direction })])];
  }
  for (const loka of [1, 41, WIN_LOKA]) {
    yield [`finished on ${loka}`, table({}, [seat({ loka, is_finished: true })])];
  }
  for (const is_finished of ['yes', 1, null]) {
    yield [`is_finished ${JSON.stringify(is_finished)}`, table({}, [seat({ is_finished })])];
  }
  for (const turnIndex of [-1, 1, 7, 0.5, '0', null]) {
    yield [`turn ${JSON.stringify(turnIndex)} of one`, table({ turnIndex })];
  }
  for (const rollCount of [-5, 1.5, 'many']) {
    yield [`${JSON.stringify(rollCount)} rolls`, table({ rollCount })];
  }
  yield ['no seats', table({}, [])];
  yield ['seven seats', table({}, Array.from({ length: 7 }, () => seat()))];
  yield ['a seat with no id', table({}, [{ ...seat(), id: '' }])];
  yield ['a seat that is not a player', table({}, [42])];
  yield ['a seat that never reported either way', table({}, [{ ...seat(), reportSubmitted: 'no' }])];
}

describe('the file on the phone, and the engine that has to play it', () => {
  it('opens exactly what the engine calls a game', async () => {
    const disagreed: string[] = [];

    for (const [name, session] of corruptions()) {
      const playable = isSeatedTable(session);
      const opened = (await open(session)) !== null;

      if (playable !== opened) {
        disagreed.push(
          `${name}: the engine says ${playable ? 'yes' : 'no'}, the phone says ${opened ? 'yes' : 'no'}`,
        );
      }
    }

    expect(disagreed).toEqual([]);
  });

  it('still opens a game somebody was in the middle of', async () => {
    // The grid above is worth nothing if the loader has simply stopped opening
    // files: a check that refuses everything would pass it.
    const game = await open(table());

    expect(game).not.toBeNull();
    expect(game?.session.players[0]?.state.loka).toBe(10);
    expect(game?.rollsTaken).toBe(3);
  });

  it('plays the variant the file names, not the one it carries', async () => {
    // `keepGame` writes the rule set whole, so the file holds an *object*. A
    // hand-edited one would otherwise be played as a variant the engine never
    // defined — a saved game quietly changing the rules of the game.
    const forged = { ...CLASSIC, id: ONLINE.id, threeSixesReset: false, entryOnSix: false };
    const game = await open(table({ rules: forged }));

    expect(game?.session.rules).toEqual(ONLINE);
  });

  it('will not open a file naming a variant nobody defines', async () => {
    // Falling back to a default would change the rules of a game in progress,
    // which is the one thing this repository exists to have stopped.
    expect(await open(table({ rules: { id: 'housebound' } }))).toBeNull();
    expect(await open(table({ rules: {} }))).toBeNull();
    expect(await open(table({ rules: undefined }))).toBeNull();
  });

  it('answers the named variant\'s question, not the forged one', async () => {
    // The variant is not cosmetic. On a run of two sixes a player owes a report
    // under `classic` and does not under `online`; a file naming `online` while
    // carrying `classic`'s flags used to answer `classic`.
    const onARun = state({ loka: 30, previous_loka: 24, consecutive_sixes: 2, position_before_three_sixes: 18 });
    const forged = { ...CLASSIC, id: ONLINE.id };

    const game = await open(table({ rules: forged }, [{ ...seat(), state: onARun }]));
    expect(game).not.toBeNull();

    expect(owesReport(onARun as GameState, forged as RuleSet)).toBe(true);
    expect(owesReport(onARun as GameState, game?.session.rules as RuleSet)).toBe(false);
  });
});
