/**
 * A player who updates the app, and their game.
 *
 * `apps/mobile` succeeds the published application and carries its identity in
 * a release build — two apps with one identifier are one app to iOS, so the
 * update installs over it and inherits its storage. `device.ts` chose
 * AsyncStorage for that reason and says so. Nothing read what was there.
 *
 * The published app keeps one key, `OfflinePlayers`, written by
 * `mobx-persist-store` from `src/store/OfflinePlayers.ts`: six seats as four
 * parallel arrays — `plans`, `start`, `finish`, `histories`. A player standing
 * on plan 41 would have updated and found themselves on the waiting square,
 * with their own history in the same store under a key nobody opened.
 *
 * These assert the shape of the reading rather than one saved file. What the
 * published app writes on a *fresh* install is the same key with everybody on
 * 68 and one `start` entry each, so *the key exists* and *somebody played* are
 * different questions, and answering the first as the second would tell a new
 * player their game had been restored.
 */

import { describe, expect, it } from 'vitest';
import { TOTAL_PLANS, WIN_LOKA } from '@leela/engine';
import { inheritedGame } from '../src/inherited';

/** What `mobx-persist-store` writes, as the published app initialises it. */
const fresh = () => ({
  start: [false, false, false, false, false, false],
  finish: [false, false, false, false, false, false],
  plans: [68, 68, 68, 68, 68, 68],
  histories: Array.from({ length: 6 }, () => [
    { createDate: 1_700_000_000_000, plan: 68, count: 0, status: 'start' },
  ]),
});

/** The same store with a seat played into it. */
function seated(
  at: number,
  over: { plan?: number; start?: boolean; finish?: boolean; history?: unknown[] } = {},
) {
  const kept = fresh() as unknown as {
    start: boolean[];
    finish: boolean[];
    plans: number[];
    histories: unknown[][];
  };
  kept.plans[at] = over.plan ?? 41;
  kept.start[at] = over.start ?? true;
  kept.finish[at] = over.finish ?? false;
  kept.histories[at] = over.history ?? [
    { createDate: 1_700_000_000_100, plan: 41, count: 3, status: 'cube' },
    { createDate: 1_700_000_000_050, plan: 38, count: 6, status: 'cube' },
    { createDate: 1_700_000_000_000, plan: 68, count: 0, status: 'start' },
  ];
  return kept;
}

const read = (kept: unknown) => inheritedGame(JSON.stringify(kept));

describe('what the published app left on this phone', () => {
  it('is the game they were playing, wherever they had got to', () => {
    // The shape: whatever square the old app had them on, that is where they
    // are. Not a list of the plans that happen to be in this fixture.
    const wrong: string[] = [];

    for (const plan of [1, 12, 41, 67, TOTAL_PLANS]) {
      const found = read(seated(0, { plan, history: [{ createDate: 1, plan, status: 'cube' }] }));
      if (found?.state.loka !== plan) wrong.push(`plan ${plan} came back as ${found?.state.loka}`);
    }

    expect(wrong).toEqual([]);
  });

  it('is nothing at all where nobody has played', () => {
    // The published app writes this key on its first launch. Adopting it would
    // tell a new player their game had been restored, from a game that is the
    // opening position.
    expect(read(fresh())).toBeNull();
  });

  it('is nothing where there is no key, or nothing this app can read', () => {
    for (const raw of [null, '', 'not json', '42', '{}', '{"plans":"six"}']) {
      expect({ raw, found: inheritedGame(raw) }).toEqual({ raw, found: null });
    }
  });

  it('waits on the win square for somebody who had not entered yet', () => {
    // The old app tracks "in the game" with `start`; this engine folds it into
    // `is_finished` on the win square. A seat with a history and no six is a
    // player waiting to enter, not a player on plan 68.
    const found = read(
      seated(0, {
        start: false,
        plan: 68,
        history: [
          { createDate: 2, plan: 68, count: 4, status: 'start' },
          { createDate: 1, plan: 68, count: 0, status: 'start' },
        ],
      }),
    );

    expect(found?.state).toMatchObject({ loka: WIN_LOKA, is_finished: true });
  });

  it('carries somebody who had won as somebody who had won', () => {
    const found = read(seated(0, { plan: 68, finish: true, start: true }));

    expect(found?.state).toMatchObject({ loka: WIN_LOKA, is_finished: true });
  });

  it('remembers the square they came from, and how they arrived', () => {
    // Both are read from the history, and both change what the game says next:
    // the companion is told how somebody arrived, and the report gate asks
    // whether they moved at all.
    const found = read(
      seated(0, {
        plan: 9,
        history: [
          { createDate: 300, plan: 9, count: 2, status: 'snake' },
          { createDate: 200, plan: 44, count: 5, status: 'cube' },
        ],
      }),
    );

    expect(found?.state.previous_loka).toBe(44);
    expect(found?.state.direction).toBe('snake 🐍');
  });

  it('reads the newest step whatever order the array is in', () => {
    // The published app unshifts, so index 0 is newest — and a file is the
    // least trustworthy thing either surface handles.
    const steps = [
      { createDate: 100, plan: 20, status: 'cube' },
      { createDate: 300, plan: 9, status: 'snake' },
      { createDate: 200, plan: 44, status: 'cube' },
    ];

    expect(read(seated(0, { plan: 9, history: steps }))?.state.direction).toBe('snake 🐍');
  });

  it('says how many other people were playing on this phone', () => {
    // Six seats there, one here. Five games not carried across is a loss, and a
    // loss that is not said reads exactly like an absence.
    const kept = seated(0);
    for (const at of [1, 2, 3]) {
      kept.plans[at] = 20 + at;
      kept.start[at] = true;
    }

    expect(read(kept)?.others).toBe(3);
  });

  it('counts nobody else where nobody else played', () => {
    expect(read(seated(0))?.others).toBe(0);
  });

  it('leaves a seat no game could have written where it is', () => {
    // Handing this engine a plan of 900 is worse than handing it nothing, and
    // a damaged seat must not cost the seats beside it either.
    const kept = seated(1);
    kept.plans[0] = 900;
    kept.start[0] = true;

    const found = read(kept);

    expect(found?.state.loka).toBe(41);
    expect(found?.others).toBe(0);
  });

  it('reads a store that holds fewer seats than the app offers', () => {
    // An older version of the published app, or a hand-edited file. Four
    // parallel arrays are four chances for one of them to be short.
    expect(
      inheritedGame(
        JSON.stringify({ plans: [41], start: [true], finish: [false], histories: [[]] }),
      )?.state.loka,
    ).toBe(41);
  });
});
