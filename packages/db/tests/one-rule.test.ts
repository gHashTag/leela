/**
 * One database, two readers, one rule.
 *
 * `sessionFromRows` refuses a seat that no game could have reached, and says
 * why it must: *a database is as writable by hand as `localStorage`, and it is
 * read by everyone at the table*. The same columns, for a player who is not at
 * a table, are read by `stateFromPlayer` — and it refused nothing at all.
 *
 * What that let through was measured, not imagined. Plan 999 gave a player who
 * may roll forever and never moves, every throw refused as `stop`, no fault
 * reported anywhere. Plan 41.5 walked on to 47.5 and 53.5, squares the board
 * has no text for. `is_finished` on plan 41 — the row the seat reader names in
 * its own message as *not a game* — let the player stroll off to 47.
 *
 * So the assertion is not a list of those four. It is that the two readers
 * agree, over a grid of rows built from the edges of every column: whatever one
 * of them calls impossible, the other does too. A fifth way to write a bad row
 * is covered by the same sentence.
 */

import { describe, expect, it } from 'vitest';
import { TOTAL_PLANS, WIN_LOKA } from '@leela/engine';
import { StoredRowsError, sessionFromRows, stateFromPlayer } from '../src/index';

/** Values around every boundary the columns have, plus a few impossible ones. */
const PLANS = [-5, 0, 1, 2, 41, 41.5, WIN_LOKA, TOTAL_PLANS, TOTAL_PLANS + 1, 999];
const SIXES = [0, 1, 2, 3, 5];

interface Row {
  plan: number;
  previous_plan: number;
  consecutive_sixes: number;
  position_before_three_sixes: number;
  is_finished: boolean;
}

function* rows(): Generator<Row> {
  for (const plan of PLANS) {
    for (const previous of [0, 1, plan, TOTAL_PLANS + 1]) {
      for (const sixes of SIXES) {
        for (const finished of [false, true]) {
          yield {
            plan,
            previous_plan: previous,
            consecutive_sixes: sixes,
            position_before_three_sixes: 0,
            is_finished: finished,
          };
        }
      }
    }
  }
}

/** What the seat reader makes of a row, as a yes or a no. */
function seatedReaderAccepts(row: Row): boolean {
  try {
    sessionFromRows(
      { id: 's', turn_index: 0, roll_count: 0, ruleset: 'classic' },
      [
        {
          session_id: 's',
          user_id: 'a',
          seat: 0,
          name: null,
          direction: 'step 🚶🏼',
          last_roll_at: null,
          last_report_at: null,
          report_submitted: true,
          ...row,
        } as never,
      ],
    );
    return true;
  } catch (error) {
    if (error instanceof StoredRowsError) return false;
    throw error;
  }
}

/** What the lone-row reader makes of the same values. */
function loneReaderAccepts(row: Row): boolean {
  try {
    stateFromPlayer({
      plan: row.plan,
      previous_plan: row.previous_plan,
      consecutiveSixes: row.consecutive_sixes,
      positionBeforeThreeSixes: row.position_before_three_sixes,
      isFinished: row.is_finished,
    } as never);
    return true;
  } catch (error) {
    if (error instanceof StoredRowsError) return false;
    throw error;
  }
}

const asLine = (row: Row) =>
  `plan ${row.plan}, previous ${row.previous_plan}, ${row.consecutive_sixes} sixes` +
  (row.is_finished ? ', finished' : '');

describe('a stored game, read two ways', () => {
  it('is refused by both readers or by neither', () => {
    const disagreed: string[] = [];

    for (const row of rows()) {
      const seated = seatedReaderAccepts(row);
      const lone = loneReaderAccepts(row);
      if (seated !== lone) {
        disagreed.push(
          `${asLine(row)}: seated says ${seated ? 'yes' : 'no'}, lone says ${lone ? 'yes' : 'no'}`,
        );
      }
    }

    expect(disagreed).toEqual([]);
  });

  it('reads a game the engine could have reached', () => {
    // The grid is only worth something if it holds real games too: a rule that
    // refuses everything would pass the test above.
    const accepted = [...rows()].filter(loneReaderAccepts);

    expect(accepted.length).toBeGreaterThan(0);
    expect(accepted.every((row) => seatedReaderAccepts(row))).toBe(true);
  });

  it('names the value it refuses, so the row can be found', () => {
    // A refusal that does not say which column is one an operator cannot act
    // on, and these rows are read from a database nobody is watching.
    expect(() => stateFromPlayer({ plan: 999, previous_plan: 1 } as never)).toThrow(/999/);
    expect(() => stateFromPlayer({ plan: 41, isFinished: true } as never)).toThrow(/win square/);
  });

  it('takes a null column as unwritten, not as impossible', () => {
    // Every column of a row inserted before it had defaults reads back null.
    // That is the opening state, and refusing it would refuse a new player.
    expect(stateFromPlayer({} as never)).toEqual({
      loka: 1,
      previous_loka: 0,
      direction: '',
      consecutive_sixes: 0,
      position_before_three_sixes: 0,
      is_finished: false,
    });
  });
});
