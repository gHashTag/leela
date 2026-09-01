#!/usr/bin/env node
/**
 * Sentences the app says in English because somebody typed them there.
 *
 *     node scripts/audit-spoken.mjs
 *
 * The sixth principle: every sentence the game says about itself comes from
 * `@leela/content`. `apps/webgl/src/main.ts` records four English strings found
 * written into it and moved out — and nothing was added to stop the next, so on
 * 2026-08-28 there were three more, including the visible face of a button
 * (`'Light' : 'Dark'`) on all twenty-two boards.
 *
 * The rule and its reasoning are in `lib/spoken.mjs`. This walks the two apps
 * that speak and exits 1 on a finding.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { finish } from './lib/report.mjs';
import { unspokenIn } from './lib/spoken.mjs';

/**
 * The surfaces that speak to a player, and the reason `apps/bot` is not one.
 *
 * The bot has no DOM: it says everything through grammY and its own render
 * layer, so `textContent` and `aria-label` mean nothing there and a walk of it
 * would assert nothing rather than assert something weakly. `apps/docs`
 * renders HTML from strings and is a different shape again — named here as a
 * known gap rather than silently skipped.
 */
const SURFACES = ['apps/webgl/src', 'apps/miniapp/src'];

const root = new URL('..', import.meta.url).pathname;
const findings = [];
let read = 0;

for (const surface of SURFACES) {
  const here = join(root, surface);
  for (const name of readdirSync(here)) {
    if (!name.endsWith('.ts') || name.endsWith('.d.ts')) continue;

    read += 1;
    for (const one of unspokenIn(readFileSync(join(here, name), 'utf8'))) {
      findings.push(`${surface}/${name}:${one.line} — ${one.said.map((w) => `"${w}"`).join(', ')}`);
    }
  }
}

/*
 * Closed through `finish`, like its neighbours, so the last line it prints is
 * the one its exit code belongs to.
 *
 * Written with a `console.log` and a `process.exit` first, and
 * `a-closing-sentence-nothing-governs.test.ts` said so the same minute: an
 * all-clear nothing ties to the gate is a report wearing a gate's clothes, and
 * this repository has caught that three times in a fortnight — twice in things
 * this loop wrote.
 */
process.exitCode = finish({
  allClear: 'Every sentence handed to the page comes from the catalogue.',
  sections: [
    {
      failing: false,
      lines: [
        `\nRead ${read} source files in ${SURFACES.join(' and ')} for sentences handed to the page.`,
        'A value that goes through `messageFor` passes whatever it holds; one that carries a',
        'typed English word does not. Interpolated data is not a sentence.',
      ],
    },
    {
      failing: true,
      heading: `\n${findings.length} sentence(s) are written into the source, not the catalogue:\n`,
      lines: findings.map((one) => `  ${one}`),
      epilogue:
        '\nMove the words to `packages/content/src/messages.ts` and say them with\n' +
        '`messageFor(language, key)`. A board in Hindi should not read "Dark".',
    },
  ],
});
