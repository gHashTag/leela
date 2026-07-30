#!/usr/bin/env node
/**
 * Every control the mini app draws as available, against the decision behind
 * it.
 *
 * Three defects in three consecutive passes had one shape: `draw` disabled a
 * control and the act behind it asked nothing. A double tap on Save filed two
 * accounts of one square; one tap on the players button threw away a month of
 * play; the die took a throw the drawing had already refused.
 *
 * A disabled button is a drawing, and a drawing refuses nothing — a double tap,
 * a stale dialog, a keyboard, or a line written next year walks straight past
 * it. The fix each time was the same: name the decision, ask it from both
 * places.
 *
 * This is that rule as a check. A drawing decided inline is a decision nothing
 * else can call, which is precisely why the acts did not call it.
 *
 * Run:  node scripts/audit-drawings.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inlineDrawings } from './lib/drawings.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAIN = join(HERE, '..', 'apps', 'miniapp', 'src', 'main.ts');

/**
 * Controls whose state is mechanical rather than a decision about the game.
 *
 * The die is disabled for the length of its own spin and enabled again in the
 * `finally` that follows: that is one act holding its own control, not a
 * question about whether a throw is allowed. The question is `mayThrow`, and
 * `draw` asks it.
 */
const MECHANICAL = new Set(['roll.disabled']);

const source = readFileSync(MAIN, 'utf8');
const inline = inlineDrawings(source, MECHANICAL);

console.log(`\nChecked every control the mini app draws in ${'apps/miniapp/src/main.ts'}.\n`);

if (inline.length === 0) {
  console.log('Every drawing names the decision behind it, so the act can ask the same one.');
} else {
  for (const drawing of inline) {
    console.log(`  el.${drawing.control}.${drawing.property} = ${drawing.decided}`);
  }
  console.log(
    '\nA condition written inline is a decision nothing else can call, and the act behind',
  );
  console.log('the control is the thing that needs to call it.');
  process.exitCode = 1;
}
