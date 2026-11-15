// Contract test: JS engine (packages/engine) vs frozen t27 vectors
// (specs/game/dice.t27 — asserted by t27b on every run).
// Pass = zero mismatches: first 8 rolls per seed vs the frozen vector,
// plus 92-roll determinism (re-seed must reproduce the recorded sequence).
import { seededRoller } from '../../packages/engine/src/dice.ts';

const FROZEN = {
  1:    [4,1,4,6,6,2,4,5],
  42:   [4,3,6,5,2,4,2,4],
  1337: [2,2,5,4,3,3,4,4],
};

let checked = 0;
let mismatches = 0;
const report = [];
for (const seedStr of Object.keys(FROZEN)) {
  const seed = Number(seedStr);
  const roller = seededRoller(seed);
  for (let i = 0; i < 8; i++) {
    const engine = roller();
    const frozen = FROZEN[seed][i];
    checked++;
    if (engine !== frozen) {
      mismatches++;
      report.push(`MISMATCH seed=${seed} step=${i}: engine=${engine} t27=${frozen}`);
    }
  }
  const recorded = [];
  for (let i = 0; i < 92; i++) { recorded.push(roller()); checked++; }
  const again = seededRoller(seed);
  for (let i = 0; i < 8; i++) again();  // прогрев: те же первые 8 бросков
  let seqOk = true;
  for (let i = 0; i < 92; i++) {
    const b = again();
    if (b !== recorded[i]) { mismatches++; seqOk = false; }
  }
  report.push(`seed=${seed}: determinism ${seqOk ? 'OK' : 'FAIL'} (92 rolls re-seeded vs recorded)`);
}
console.log(`contract-dice: checked=${checked} mismatches=${mismatches}`);
for (const line of report) console.log(line);
process.exit(mismatches === 0 ? 0 : 1);
