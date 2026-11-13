/**
 * Generate the P0 golden fixtures for the Leela ⇄ T27 parity corpus.
 *
 * The engine (`packages/engine`) is the oracle: every scenario's expected
 * output is whatever `applyRoll` actually answers, recorded verbatim. The
 * fixtures land in the leela-vedic checkout, where the T27 spec lives.
 *
 * Run from /Users/playra/leela:
 *   bun scripts/generate-lila-p0-fixtures.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { applyRoll, initialState, hasWon } from '../packages/engine/src/game';
import {
  SNAKES,
  ARROWS,
  START_LOKA,
  WIN_LOKA,
  TOTAL_PLANS,
  MAX_ROLL,
  SIXES_TO_RESET,
} from '../packages/engine/src/board';
import { seededRoller } from '../packages/engine/src/dice';

const OUT =
  '/Users/playra/leela-vedic/src/game/rules/__fixtures__/lila-p0.json';

interface Scenario {
  id: string;
  kind: string;
  note: string;
  loka: number;
  isFinished: boolean;
  consecutiveSixes?: number;
  faces: number[];
  engine: unknown;
}

let seq = 0;
const scenarios: Scenario[] = [];

/** A state standing on an arbitrary loka, mid-game. */
const at = (loka: number, extra: Record<string, unknown> = {}) => ({
  loka,
  previous_loka: 0,
  direction: 'step 🚶🏼',
  consecutive_sixes: 0,
  position_before_three_sixes: 0,
  is_finished: false,
  ...extra,
});

/** Apply faces one at a time from a starting state; capture the whole trail. */
const play = (
  id: string,
  kind: string,
  note: string,
  state: Record<string, unknown>,
  faces: number[],
) => {
  let current = state;
  const steps: unknown[] = [];
  let error: string | null = null;
  for (const face of faces) {
    try {
      const result = applyRoll(current as never, face);
      current = result.state;
      steps.push(result.event);
    } catch (e) {
      error = `RangeError: ${(e as Error).message}`;
      break;
    }
  }
  seq += 1;
  console.error(`scenario ${seq}: ${id}`);
  scenarios.push({
    id: `${String(seq).padStart(4, '0')}-${id}`,
    kind,
    note,
    loka: state.loka,
    isFinished: state.is_finished ?? false,
    consecutiveSixes: state.consecutive_sixes,
    faces,
    engine: { steps, final: current, error },
  });
};

// A tiny deterministic PRNG for padding, so reruns are stable.
let rngState = 0x2f6e2b1;
const prng = (mod: number) => {
  rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
  return (rngState >> 8) % mod;
};

// --- 1. Twenty scenarios per jump (landing on each head) --------------------
for (const [headStr, tailStr] of Object.entries({ ...SNAKES, ...ARROWS })) {
  const head = Number(headStr);
  const kind = headStr in SNAKES ? 'snake' : 'arrow';
  const tail = Number(tailStr);
  // Every die face that lands on this head from a legal approach square.
  for (let face = 1; face <= MAX_ROLL; face += 1) {
    const approach = head - face;
    if (approach >= 1 && approach <= TOTAL_PLANS) {
      play(
        `jump-${kind}-${head}-via-${face}`,
        `jump-${kind}`,
        `Landing on ${head} (${kind}) via a ${face} from ${approach} → ${tail}`,
        at(approach),
        [face]
      );
    }
  }
  // Pad to twenty with deterministic approach squares.
  let pad = 0;
  const count = () =>
    scenarios.filter((s) => s.id.includes(`jump-${kind}-${head}-`)).length;
  while (count() < 20) {
    pad += 1;
    const face = (prng(MAX_ROLL) || 1) as number;
    const approach = ((head - face + pad * 7) % TOTAL_PLANS) + 1;
    if (approach < 1) continue;
    play(
      `jump-${kind}-${head}-pad${pad}`,
      `jump-${kind}`,
      `Approach ${approach} with ${face} → ${head} → ${tail}`,
      at(approach),
      [face]
    );
  }
}

// --- 2. Every start position on the board -----------------------------------
for (let loka = 1; loka <= TOTAL_PLANS; loka += 1) {
  const face = ((loka - 1) % MAX_ROLL) + 1;
  play(
    `start-${loka}`,
    'position',
    `Every loka on the board, one face each (${loka} + ${face})`,
    at(loka),
    [face]
  );
}

// --- 3. All six faces from the entry park -----------------------------------
for (let face = 1; face <= MAX_ROLL; face += 1) {
  play(
    `faces-${face}`,
    'faces',
    `The parked player throws ${face}: only a six enters`,
    initialState(),
    [face]
  );
}

// --- 4. Three sixes, landing on the first, second and third -----------------
const entered = at(START_LOKA);
play('sixes-run-1', 'three-sixes', 'First six of a run from loka 6', entered, [6]);
play(
  'sixes-run-2',
  'three-sixes',
  'Second six in a row (consecutive_sixes grows)',
  at(START_LOKA + 6),
  [6, 6]
);
play(
  'sixes-run-3',
  'three-sixes',
  'Third six in a row: the run resets to where it began',
  at(START_LOKA + 6, { consecutive_sixes: 1 }),
  [6, 6, 6]
);

// --- 5. Travel past the win loka, and past the board ------------------------
play(
  'past-win-68',
  'overshoot',
  '67 + 3 = 70: the player travels past the win loka without landing on it',
  at(67),
  [3]
);
play(
  'past-board-71',
  'overshoot',
  '71 + 2 = 73: past the board, the throw is refused',
  at(71),
  [2]
);
play(
  'past-board-72',
  'overshoot',
  '72 + 1 = 73: refused from the last square',
  at(72),
  [1]
);

// --- 6. Exact arrival on the win loka ---------------------------------------
play(
  'exact-win-68',
  'win',
  '65 + 3 = 68: exact arrival wins the game',
  at(65),
  [3]
);
play(
  'exact-win-62-arrow',
  'win',
  '62 + 6 = 68: exact arrival by the last face',
  at(62),
  [6]
);

// --- 7. The snake at the top of the board -----------------------------------
play(
  'snake-72-51',
  'snake-top',
  '72 + 6 → head 72 → snake down to 51',
  at(72),
  [6]
);

// --- 8. Invalid throws -------------------------------------------------------
play('invalid-zero', 'invalid', 'Face 0 is not a die', at(30), [0]);
play('invalid-seven', 'invalid', 'Face 7 is not a die', at(30), [7]);
play('gate-closed-1', 'gate', 'The parked player throws 1: refused by the gate', initialState(), [1]);
play('gate-closed-5', 'gate', 'The parked player throws 5: refused by the gate', initialState(), [5]);
play(
  'gate-after-win',
  'gate',
  'A finished player cannot re-enter by any face but six',
  at(WIN_LOKA, { is_finished: true }),
  [1]
);

// --- 9. Seed determinism -----------------------------------------------------
const roller = seededRoller(42);
const runA = Array.from({ length: 100 }, () => roller());
const roller2 = seededRoller(42);
const runB = Array.from({ length: 100 }, () => roller2());
seq += 1;
scenarios.push({
  id: `${String(seq).padStart(4, '0')}-seed-determinism`,
  kind: 'seed',
  note: 'seed 42 → 100 faces, recorded twice: the arrays must be identical',
  loka: 0,
  isFinished: false,
  faces: runA,
  engine: { runA, runB, identical: JSON.stringify(runA) === JSON.stringify(runB) },
});

mkdirSync(OUT.slice(0, OUT.lastIndexOf('/')), { recursive: true });
writeFileSync(OUT, JSON.stringify({ version: 1, scenarios }, null, 1));
const byKind: Record<string, number> = {};
for (const s of scenarios) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
console.log(`fixtures: ${scenarios.length}`);
console.log(byKind);
console.log('seed determinism identical:', JSON.stringify(runA) === JSON.stringify(runB));
