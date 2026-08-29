#!/usr/bin/env node
/**
 * What a phone shows a person at six in the morning, unasked.
 *
 *     node scripts/audit-quotes.mjs [--src ../leela-src]
 *
 * Needs: the donor clone at ../leela-src, which CI does not check out.
 *
 * `ai.t27.leela.dailyquote` fires at 06:00 +07 and pushes one of 66 quotes to
 * `daily-quote-ru` and `daily-quote-en`. It has sent every day this loop has
 * watched. **Nothing in this repository had ever read what it sends** — the
 * data is in the donor, which none of the twenty other audits reach, and the
 * only test it has is a jest suite in that repo that these gates never run.
 *
 * The first sweep, 2026-08-29, found seven defects in 132 texts, and two had
 * gone out inside 48 hours: `46 Различение` on the 28th, `47.План
 * нейтральности` on the 29th. A push notification is the one surface a reader
 * cannot look away from and cannot check the source of.
 *
 * The rule was measured, not imposed: of 132 titles, 128 opened with exactly
 * `"NN. "`, and the four that did not were the four defects.
 *
 * It also counts what is NOT there. Sixty-six quotes for seventy-two plans —
 * six are never spoken for, and the sender walks its own list without ever
 * asking the board what it is missing.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { finish } from './lib/report.mjs';
import { UNSPOKEN_PLANS, quoteProblems, unspokenIn } from './lib/quotes.mjs';

const HERE = new URL('.', import.meta.url).pathname;
const flag = process.argv.indexOf('--src');
const SRC = flag > -1 ? process.argv[flag + 1] : join(HERE, '..', '..', 'leela-src');
const QUOTES = join(SRC, 'leela', 'scripts', 'daily-quotes.json');

/*
 * Written as an early exit rather than an `if`/`else`, and NOT for style.
 *
 * A top-level `} else {` in an audit sends
 * `packages/content/tests/a-closing-sentence-nothing-governs.test.ts` — the
 * check that holds every audit to the sentence it closes on — into an infinite
 * loop. **MEASURED on 2026-08-29 by truncating this file line by line**: at 44
 * lines the suite runs in 511 ms, and adding line 45, `} else {`, makes it run
 * past 240 s. It is synchronous, so no `--testTimeout` can interrupt it; the
 * suite simply never returns.
 *
 * Every other audit here assigns `process.exitCode` at the top level, so no
 * file had ever offered that shape. Recorded in LOOP.md as its own item: a
 * reader that loops forever on legal JavaScript is worse than the thing it
 * checks, and repairing a brace-walker safely is not a change to make in
 * passing.
 */
if (!existsSync(QUOTES)) {
  // The absence of the donor is not the absence of a defect, and must not read
  // as one. A different sentence and a different exit code.
  console.error(`No daily quotes at ${QUOTES}. Clone the donor, or pass --src.`);
  console.error('Nothing was checked — this is not a pass.');
  process.exitCode = 2;
}

if (existsSync(QUOTES)) {
  const quotes = JSON.parse(readFileSync(QUOTES, 'utf8'));
  const problems = quotes.flatMap(quoteProblems);
  const unspoken = unspokenIn(quotes);

  const recorded = UNSPOKEN_PLANS.join(', ');
  const found = unspoken.join(', ');

  process.exitCode = finish({
    allClear: `Every one of the ${quotes.length} quotes reads as a person will receive it.`,
    sections: [
      {
        failing: false,
        lines: [
          `\nRead ${quotes.length} quotes — ${quotes.length * 2} texts, two languages — as ` +
            `${QUOTES.replace(`${process.cwd()}/`, '')} holds them.`,
          `\n  ${unspoken.length} of 72 plans have no quote and are never sent: ${found}.`,
          '  Recorded rather than repaired: writing one is a judgement, and it is the owner’s.',
        ],
      },
      {
        failing: true,
        heading: '\nThe record of unspoken plans no longer describes the file:\n',
        lines: found === recorded ? [] : [`  recorded ${recorded}\n  found    ${found}`],
        epilogue:
          '\nUpdate UNSPOKEN_PLANS in scripts/lib/quotes.mjs. A gap that was filled\n' +
          'and a seventh that appeared read the same way in a count, which is why\n' +
          'this compares the list.',
      },
      {
        failing: true,
        heading: `\n${problems.length} thing(s) a reader would be pushed that are wrong:\n`,
        lines: problems.map((one) => `  ${one}`),
        epilogue:
          '\nThe shape is the corpus’s own: 128 of 132 titles open with "NN. ".\n' +
          'The file is at ../leela-src and this repository does not push it, so a\n' +
          'repair there is the owner’s to commit.',
      },
    ],
  });
}
