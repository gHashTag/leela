/**
 * Two ways into the same question, and the one place they answer differently.
 *
 * A player's turn can be asked about from a `players` row — `canPlayerRoll`,
 * which assembles the state, the clock and the ruleset and hands them to the
 * engine — or from a table, `canCurrentPlayerRoll(sessionFromRows(...))`. This
 * repository has had *one database, two readers* go wrong before, over which
 * rows are playable at all; `checkPlayable` was the answer. The verdict is the
 * next question those two readers both take.
 *
 * Measured over the same state written both ways, they agree everywhere except
 * one square: **a winner**. The row says *may roll* and the session says
 * *finished*, and that is not a divergence but two questions.
 *
 * `canRoll`'s winner branch is guarded by `mayReenterAfterWinning`, which
 * `classic` sets true — so a player who has won may begin again, and the row
 * reader says so. `canCurrentPlayerRoll` asks a prior question first: whether a
 * throw can happen in this session at all. It has to, because `advance` throws
 * on a finished session — on the phone, one seat, winning ends it, and the
 * button stayed lit on Cosmic Consciousness until pressing it crashed inside
 * the handler.
 *
 * **`canPlayerRoll` has no caller in the program.** It is exported for a client
 * that is not the bot, and recorded as such in `audit-unread`. So this is
 * written for whoever that client turns out to be: the row answers about a
 * player, and a client asking *may a throw happen here* has to ask the session
 * too, or it will meet the crash the session guard was written for.
 */

import { describe, expect, it } from 'vitest';
import { CLASSIC, LEGACY_MOBILE, canCurrentPlayerRoll } from '@leela/engine';
import { canPlayerRoll, sessionFromRows } from '../src/index';

const NOW = 2_000_000_000_000;

interface Standing {
  plan: number;
  previous: number;
  sixes: number;
  before: number;
  finished: boolean;
  owes: boolean;
}

/** The same standing, as the row a lone player is kept in. */
const asPlayer = (standing: Standing) => ({
  id: 'p1',
  telegramId: '1',
  ruleset: 'classic',
  plan: standing.plan,
  previous_plan: standing.previous,
  consecutiveSixes: standing.sixes,
  positionBeforeThreeSixes: standing.before,
  isFinished: standing.finished,
  needsReport: standing.owes,
  lastRollAt: null,
  lastReportAt: null,
});

/** The same standing, as a seat at a table. */
const asSeat = (standing: Standing) => ({
  id: 1,
  session_id: 's1',
  user_id: 'p1',
  seat: 0,
  name: 'A',
  plan: standing.plan,
  previous_plan: standing.previous,
  consecutive_sixes: standing.sixes,
  position_before_three_sixes: standing.before,
  is_finished: standing.finished,
  direction: 'step 🚶🏼',
  last_roll_at: null,
  last_report_at: null,
  report_submitted: !standing.owes,
});

const atATable = (standing: Standing) =>
  canCurrentPlayerRoll(
    sessionFromRows({ id: 's1', turn_index: 0, roll_count: 0, ruleset: 'classic' }, [
      asSeat(standing),
    ]),
    NOW,
  );

const playing: Standing = {
  plan: 41,
  previous: 35,
  sixes: 0,
  before: 0,
  finished: false,
  owes: false,
};

describe('a turn asked from a row and from a table', () => {
  it('is answered the same way in every standing but one', () => {
    const differing: string[] = [];

    const standings: Array<[string, Standing]> = [
      ['playing', playing],
      ['owing an account', { ...playing, owes: true }],
      ['waiting to enter', { ...playing, plan: 68, previous: 68 }],
      ['two sixes into a run', { ...playing, sixes: 2, before: 29 }],
      ['on the first square', { ...playing, plan: 1, previous: 0 }],
    ];

    for (const [what, standing] of standings) {
      const row = canPlayerRoll(asPlayer(standing), NOW);
      const table = atATable(standing);

      if (row.allowed !== table.allowed || (row.reason ?? null) !== (table.reason ?? null)) {
        differing.push(`${what}: row ${row.allowed}/${row.reason} vs table ${table.allowed}/${table.reason}`);
      }
    }

    expect(differing).toEqual([]);
  });

  it('parts company over a winner, and each is right about its own question', () => {
    // The row is asked about a player, and `classic` lets a winner begin again.
    // The table is asked whether a throw can happen at all, and at a table of
    // one it cannot: `advance` throws on a finished session.
    const won: Standing = { ...playing, plan: 68, previous: 62, finished: true };

    expect(CLASSIC.mayReenterAfterWinning).toBe(true);
    expect(canPlayerRoll(asPlayer(won), NOW).allowed).toBe(true);
    expect(atATable(won)).toMatchObject({ allowed: false, reason: 'finished' });
  });

  it('is the ruleset that decides the winner, not either reader', () => {
    // The case above is a fact about `classic`, not a rule of the row reader's
    // own — and `legacy-mobile` proves it: it sets `mayReenterAfterWinning`
    // false, and then the row says `finished` as well and the two readers agree
    // again. Written first against `onchain`, which sets the flag *true* and
    // therefore demonstrated nothing.
    const won: Standing = { ...playing, plan: 68, previous: 62, finished: true };

    expect(LEGACY_MOBILE.mayReenterAfterWinning).toBe(false);
    expect(CLASSIC.mayReenterAfterWinning).toBe(true);

    const strict = canPlayerRoll({ ...asPlayer(won), ruleset: 'legacy-mobile' }, NOW);
    expect(strict).toMatchObject({ allowed: false, reason: 'finished' });
  });
});
