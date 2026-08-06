#!/usr/bin/env node
/**
 * Every dependency a caller supplies, against a test that breaks it on purpose.
 *
 * Four passes running found one defect each and all four were the same one: a
 * model that never returned, a download that never returned, a room that would
 * not save, an account that would not record. Each is behaviour the type allows
 * and the code assumed away. Each was found by going looking.
 *
 * The rule this makes checkable: **an injected dependency is a promise the type
 * does not hold anyone to, so something has to break it deliberately.** A test
 * that only ever hands in a working implementation proves the happy path twice.
 *
 * A hostile test is recognised by what it does, not by its name: it builds an
 * implementation that throws, or one that returns a promise nobody settles.
 * That second kind is the one an error path cannot catch, and it is why three
 * of the four defects were invisible to every `catch` around them.
 *
 * Run:  node scripts/audit-promises.mjs
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectionPoints, windowsBreaking, answeredIn } from './lib/promises.mjs';
import { workspacePackages } from './lib/claims.mjs';
import { finish } from './lib/report.mjs';
import { sourceFilesUnder } from './lib/source.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/**
 * Where dependencies are declared, and where their tests live.
 *
 * Found rather than listed. This held five of the ten workspaces, and the five
 * it left out hold injected dependencies nothing has ever handed a broken one.
 */
const read = {
  exists: (path) => existsSync(join(ROOT, path)),
  entries: (path) => readdirSync(join(ROOT, path)),
  isDirectory: (path) => statSync(join(ROOT, path)).isDirectory(),
};

const PACKAGES = workspacePackages(read).filter((workspace) => workspace.tests);

/**
 * Members nothing can usefully break. Empty, and the emptying is the finding.
 *
 * It held `id`, `apiKey`, `model`, `baseUrl`, `referer` and `title`, and the
 * reason written beside it was that `id` is a string on an interface that
 * happens to hold methods, so a string that misbehaves is a string with the
 * wrong value — a different question, and one the prompt tests already ask.
 *
 * That reason described a case `lib/promises.mjs` had already closed. It drops
 * any member whose type does not match `/Store|Sink|Model|Storage|Queries|=>/`,
 * so a `string` member never becomes an injection point and never arrives here
 * to be excused. The excuse was true and it was not doing anything.
 *
 * MEASURED, per entry, by computing injection points over every source file
 * this audit walks and counting which of them each entry suppressed: `id` 0,
 * `apiKey` 0, `baseUrl` 0, `referer` 0, `title` 0. Five of the six were dead
 * by construction rather than by drift — they had never suppressed a single
 * point, sitting in the one place nothing looks.
 *
 * The sixth suppressed exactly one, and it is the damaging one. `model`
 * matched on the bare property name, with no regard to owner or type, and the
 * one thing it reached was `GuideOptions.model` in `packages/ai/src/guide.ts`
 * — a `LanguageModel`. That is this audit's founding story: *a model that
 * never returned*. The check was switched off on the dependency it was written
 * for, by a line whose stated reason was about strings.
 *
 * MEASURED with the list emptied: `GuideOptions.model` has 4 stretches of test
 * source that hand it something hostile, and `answeredIn` is true of them, so
 * it passes on its merits rather than by permission. `checked` rose from 28 to
 * 29 and the audit still exits 0. Nothing became excused; one thing stopped
 * being.
 *
 * ASSUMED, not measured, and it is the part that matters: there is no live hole
 * in `packages/ai` today only because `packages/ai/tests/guide.test.ts` happens
 * to hand in models that throw and models that never settle. The audit was not
 * what covered that, and would not have noticed if that test were weakened.
 * Being able to notice is what emptying this list buys.
 *
 * Kept as an empty set rather than deleted so the entry `lib/records.mjs` holds
 * for it still describes something, and so the keying rule below has both
 * lists to hold.
 */
const DATA = new Set([]);

/**
 * Points where a broken implementation is somebody else's to report.
 *
 * `onActivate` is a DOM click listener. An exception inside one does not stop
 * the page, does not corrupt anything, and surfaces as a `window` error — which
 * the mini app's assembled tests already assert is empty on every load. There
 * is nothing here to swallow and therefore nothing to catch swallowing.
 */
const NOT_OURS = new Set(['CellOptions.onActivate']);

/**
 * KEYING. Every entry in either list above is `Owner.property`, never a bare
 * property name, and this is checked rather than remembered.
 *
 * A bare name reads like the narrower thing to write and it is the wider one.
 * `Owner.property` excuses one member of one interface; a bare `property`
 * excuses that name on every interface in the repository, including interfaces
 * written afterwards, by somebody who never read this file, about a dependency
 * nobody had in mind when the excuse was granted. It is not a smaller
 * exemption, it is an unbounded one, and it is silent about the difference:
 * both spellings suppress, so both spellings look like they worked.
 *
 * That is not hypothetical here. `model` was written as a bare name and spent
 * itself on `GuideOptions.model`, the `LanguageModel` this audit exists
 * because of. See the note on DATA above, and
 * `packages/ai/tests/a-dependency-excused-by-name.test.ts`, which builds the
 * two spellings over synthetic interfaces and shows one suppressing every
 * same-named member of every owner where the other suppresses exactly one.
 *
 * The rule outlives the entries: both lists could be empty and the next person
 * to add one still has to say whose member they mean.
 */
const bareKeys = [...DATA, ...NOT_OURS].filter((entry) => !entry.includes('.'));

/** Whether an excuse has been granted for this exact member of this exact owner. */
const excused = (point) => {
  const key = `${point.owner}.${point.property}`;
  return DATA.has(key) || NOT_OURS.has(key);
};

/** A test is hostile when it hands something in that throws, or never settles. */
const THROWS = /throw new |Promise\.reject|=> \{\s*throw|rejects\.toThrow/;
const NEVER_SETTLES = /new Promise<[^>]*>\(\(\) => \{\}\)|new Promise\(\(\) => \{\}\)/;

const unbroken = [];
const unanswered = [];
let checked = 0;
let hostileFiles = 0;

for (const { src, tests } of PACKAGES) {
  const testFiles = sourceFilesUnder(join(ROOT, tests)).map((path) => {
    const source = readFileSync(path, 'utf8');
    return { path, source, hostile: THROWS.test(source) || NEVER_SETTLES.test(source) };
  });
  hostileFiles += testFiles.filter((test) => test.hostile).length;

  for (const path of sourceFilesUnder(join(ROOT, src))) {
    const source = readFileSync(path, 'utf8');

    for (const point of injectionPoints(source, relative(ROOT, path))) {
      if (excused(point)) continue;
      checked += 1;
      const windows = windowsBreaking(point, testFiles, [THROWS, NEVER_SETTLES]);
      if (windows.length === 0) unbroken.push(point);
      else if (!answeredIn(windows)) unanswered.push(point);
    }
  }
}

console.log(
  `\nChecked ${checked} injected dependencies against ${hostileFiles} test files that break one.\n`,
);

// The three findings, and the sentence that closes the run, arranged by
// `lib/report.mjs` so the two cannot disagree.
//
// They could, and did. The KEYING gate above is this pass's own work, and it
// was added as a fourth `if` over `bareKeys` while the all-clear below it went
// on asking `unbroken.length === 0 && unanswered.length === 0` — a condition
// that knows nothing about bare keys. A run whose only finding was an excuse
// written as a bare property name therefore set the exit code, printed the
// KEYING block, and then signed off with *every dependency a caller supplies is
// handed a broken one, and somebody is told*. The exit code was right and the
// sentence under it was wrong, which is the defect `report.mjs` exists for and
// which this file reproduced within one pass of that module being written.
process.exitCode = finish({
  allClear: 'Every dependency a caller supplies is handed a broken one, and somebody is told.',
  sections: [
    {
      failing: true,
      heading: 'These excuses are keyed on a bare property name:\n',
      lines: bareKeys.map((entry) => `  ${entry}`),
      epilogue:
        '\nA bare name excuses that property on every interface in the repository, not\n' +
        'the one it was written about. Write it as Owner.property. See the note on\n' +
        'DATA: the last bare entry here spent itself on the LanguageModel this audit\n' +
        'exists because of.\n',
    },
    {
      failing: true,
      heading: 'Never handed a broken one:\n',
      lines: unbroken.map((point) => `  ${point.owner}.${point.property}  (${point.file})`),
      epilogue:
        '\nNothing tries these with an implementation that throws or never returns, which is\n' +
        'what four consecutive passes found in the ones that were tried.\n',
    },
    {
      failing: true,
      heading: 'Broken, with nothing asserted about what anyone is told:\n',
      lines: unanswered.map((point) => `  ${point.owner}.${point.property}  (${point.file})`),
      epilogue:
        '\nEvery defect of this family was caught somewhere and told nobody. A test that\n' +
        'proves the code survived proves the half that was never in doubt.\n',
    },
  ],
});
