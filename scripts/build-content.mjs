#!/usr/bin/env node
/**
 * Merge every surviving copy of the Leela texts into one dataset.
 *
 * Four sources, found across four repositories:
 *
 *   1. dharmaapp/leelabook              ru  markdown, numbered only by SUMMARY.md
 *   2. NeuroLeelaAgent/docs/plans       en  markdown, `<n>-<slug>.md`
 *   3. translate-leela/locales/<lang>   19 languages, `<n>-<slug>-<lang>.md`
 *   4. leela/src/locales/<lang>         10 languages, `plan_<n>: {title, content}`
 *
 * The English filenames are the only complete numbering scheme, so they act as
 * the key that ties the other three together.
 *
 * Output: packages/content/data/plans.<lang>.json — an array of 72 entries per
 * language — plus rules.json and a manifest recording coverage and gaps.
 *
 * Run:  node scripts/build-content.mjs [--src <dir>]
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { checkRegression, dimensionsIn } from './lib/coverage.mjs';
import { RECOVERY, pendingMutation } from './lib/undo.mjs';
import { corrected, unappliedIn } from './lib/corrections.mjs';
import { stripNumbering } from './lib/numbering.mjs';
import {
  against as spilloversAgainst,
  nameOf as spilloverName,
  spilloversIn,
  withoutSpillover,
} from './lib/spillover.mjs';
import { paragraphed } from './lib/paragraphs.mjs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const OUT = join(REPO, 'packages/content/data');

/**
 * Refuse before anything else, while a mutation run is unfinished.
 *
 * `audit-mutants` edits shipped source on purpose to see whether the tests
 * notice, and a run that is killed mid-mutation leaves the edit in the file —
 * a note on disk is the only thing that survives the kill, because the script
 * lives inside synchronous `execFileSync` and no signal handler ever runs. On
 * 2026-08-06 a stopped run left `return '';` at the top of `summariseReturns`
 * in `packages/ai/src/prompts.ts` and ten tests in a package nobody had
 * touched went red. It cost an hour, and it cost an hour because nothing on
 * the path anybody actually walks reads that note: `bun run verify` is
 * `content:build && typecheck && typecheck:strict && test`, and the restore
 * only happens at the start of the *next* `audit-mutants` run.
 *
 * `content:build` is the first thing `verify` executes, so the refusal belongs
 * here. It comes before `--src` is read, before the donor repositories are
 * touched, and before the regression guard, because the order is the point: a
 * tree holding a live mutation should say so first, whatever else is also
 * wrong with the arguments. Nothing is restored here — see `lib/undo.mjs` for
 * why a build is the wrong process to repair a developer's tree.
 *
 * `--force` does not reach this. An unfinished mutation is not a judgement
 * call about the dataset that a human can overrule; it is a broken tool, and
 * the answer to it is one command. `--mutation-note` exists so a test can put
 * the note somewhere harmless — it changes where the note is looked for, never
 * whether it is.
 *
 * The intended replacement for all of this is StrykerJS with
 * `@stryker-mutator/vitest-runner`, which defaults to `inPlace: false`: it
 * copies the tree into a sandbox and mutates the copy, so a `SIGKILL` cannot
 * leave anything behind and this guard has nothing to guard. Adopting it needs
 * a network install that rewrites `package.json` and `bun.lock`, and its
 * behaviour on a ten-workspace Bun monorepo is untested here. Until somebody
 * has measured that, this is the cheap gate.
 */
/**
 * What a stopped tool leaves on disk, and the one command that clears each.
 *
 * Two tools edit or copy this tree and can be killed halfway, and the cost has
 * been the same shape both times: a suite in a package nobody touched goes red,
 * and the failure does not name the tool. The marker is the only thing that
 * survives the kill, so the build reads both and refuses before it does
 * anything else.
 *
 * A `*_MARKER` is a path relative to the repository root; its `*_RECOVERY` is
 * the exact command that clears it. That pairing is the whole convention, and
 * `packages/content/tests/a-build-that-refuses.test.ts` reads it out of this
 * source — every `*_MARKER` declared here, and the `*_RECOVERY` beside it — so
 * the test is driven by what this file declares rather than by two names
 * somebody remembered. A marker declared without a recovery makes that test
 * throw rather than skip it. It reads rather than imports, for the reason
 * `packages/engine/tests/runnable.test.ts` gives about `audit-scripts.mjs`:
 * this file does its work at import time.
 *
 * One command, one spelling — `scripts/lib/undo.mjs:90`'s rule applied to the
 * second tool. The sentence a broken tree prints is typed by somebody who has
 * just lost their bearings, and a command kept by hand in two places will be
 * right in one of them. `MUTATION_RECOVERY` is `RECOVERY` from that module
 * under the name this convention pairs on, not a copy of it; the message below
 * prints `pending.recovery`, which is that same constant arriving from the
 * module that owns the note, so the note's reader stays free to answer with a
 * different command for a note it could not read.
 *
 * `rm -rf` and not a script, for the sandbox. There is nothing to restore — it
 * is a *copy*, and the originals were never touched, which is the property
 * `audit-mutants` lacks and the reason Stryker replaced it. A recovery somebody
 * can perform without this repository's help is the one that still works when
 * this repository's tooling is what broke.
 *
 * WRITTEN AS CONSTANTS RATHER THAN AS A TABLE, and that is a rule of this
 * repository rather than a preference. `scripts/lib/records.mjs` declares every
 * list under `scripts/` and `packages/content/tests/records.test.ts` fails on
 * one that is not declared there. MEASURED on 2026-08-06: an
 * `export const LEFTOVER_ARTIFACTS = [...]` here produced
 * `expected [ "build-content.mjs:LEFTOVER_ARTIFACTS" ] to deeply equal []` from
 * *the repository as it stands > has every list declared*. A row in that file
 * is the right answer and this change does not own it — and constants are not
 * a worse answer: what that rule polices is a list whose entries quietly stop
 * describing anything, and a constant a guard below reads has nothing to rot.
 */
export const MUTATION_MARKER = 'scripts/.mutants-undo.json';
export const MUTATION_RECOVERY = RECOVERY;

export const STRYKER_MARKER = '.stryker-tmp';
export const STRYKER_RECOVERY = `rm -rf ${STRYKER_MARKER}`;

const noteFlag = process.argv.indexOf('--mutation-note');
const MUTATION_NOTE =
  noteFlag > -1 ? process.argv[noteFlag + 1] : join(REPO, MUTATION_MARKER);

const pending = pendingMutation(MUTATION_NOTE);
if (pending) {
  console.error('\nRefusing to build: a mutation run was stopped and never put the file back.\n');
  console.error(
    pending.path
      ? `  Currently broken: ${pending.path}`
      : `  A note is there and will not parse, so which file is broken is unknown.`,
  );
  console.error(`  Note:             ${MUTATION_NOTE}`);
  console.error(`\n  Put it back with: ${pending.recovery}\n`);
  console.error('A test failing right now is a tool\'s doing and not the code\'s.');
  console.error('Nothing here is restored for you: that would repair your tree mid-commit.');
  process.exit(1);
}

/**
 * Refuse, second, while a Stryker sandbox is still on disk.
 *
 * The comment above ends by naming StrykerJS as the intended replacement for
 * `audit-mutants`, on the grounds that it copies the tree and mutates the copy
 * so a `SIGKILL` cannot leave anything behind. That is true of the *source
 * files*, and it is the reason the swap was made — but it is not true of the
 * tree. Stryker writes its copy to `.stryker-tmp/sandbox-<n>/`, and
 * `cleanTempDir: 'always'` removes it only after a run that FINISHES. A run
 * killed halfway leaves a whole second copy of this repository sitting at the
 * root, and the guard the swap was supposed to make unnecessary is needed again
 * one directory over.
 *
 * MEASURED on 2026-08-06, and it is the same hour twice:
 *
 *     $ mkdir -p .stryker-tmp/sandbox-VERIFY && cp README.md .stryker-tmp/sandbox-VERIFY/
 *     $ npx vitest run --root packages/engine tests/runnable.test.ts
 *     FAIL  tests/runnable.test.ts > ... > is every document in this repository
 *           that names a script command
 *
 * — because that check walks the repository for markdown and the copies are
 * markdown. So `bun run verify` goes red, in a package nobody has touched, over
 * a file that is not source, for a tool that was not running. Nothing in the
 * failure says the word Stryker.
 *
 * Two other costs, neither of which announces itself either: `.stryker-tmp` was
 * not in `.gitignore` (it is now, one line above `scripts/.mutants-undo.json`'s
 * neighbourhood), so a leftover sandbox showed up as untracked files in `git
 * status` and as unused files to knip.
 *
 * `stryker.conf.mjs:197-199` names this hole and says it is not fixed there —
 * *"KNOWN AND NOT FIXED HERE: `.stryker-tmp` is not in `.gitignore` … Adding
 * that entry is a change to a file this pass does not own."* The guard lives
 * here instead, for the same reason the mutation-note guard does: `content:build`
 * is the first thing `verify` runs, so this is the earliest place a broken tree
 * can say what is wrong with it. `stryker.conf.mjs` is not edited.
 *
 * After the mutation note and not before it, deliberately. A tree holding both
 * has shipped source that is currently WRONG and a directory that is merely in
 * the way; the file that is wrong is the one to say first, and
 * `a-build-that-refuses.test.ts` asserts that order over a grid of argv rows.
 * `--force` does not reach this, for the reason it does not reach that: a
 * stopped tool is not a judgement call about the dataset.
 */
if (existsSync(join(REPO, STRYKER_MARKER))) {
  console.error('\nRefusing to build: a mutation run was stopped before it cleaned up.\n');
  console.error(`  Left behind:      ${STRYKER_MARKER}/ — a Stryker sandbox, a copy of this tree.`);
  console.error('  What it costs:    the engine suite walks the repository and reads those');
  console.error('                    copies as if they were source, so it reports files that');
  console.error('                    are not source and `bun run verify` is red for a reason');
  console.error('                    that has nothing to do with the code.');
  console.error(`\n  Clear it with:    ${STRYKER_RECOVERY}\n`);
  console.error('Nothing was mutated in place: the sandbox is a copy, so deleting it loses');
  console.error('nothing. Only the run\'s own results, which a stopped run did not produce.');
  process.exit(1);
}

const srcFlag = process.argv.indexOf('--src');
const SRC = srcFlag > -1 ? process.argv[srcFlag + 1] : join(REPO, '..', 'leela-src');

const TOTAL_PLANS = 72;

/** Chapters that are rules, not plans. Same slugs across every source. */
const RULE_SLUGS = new Set([
  'chortdescription',
  'introduction',
  'meaningofthegame',
  'numerologygames',
  'chakras',
  'notes',
  'game-logic',
]);

/** Split `---\nkey: value\n---\nbody`, then lift the first heading out as the title. */
function parseMarkdown(raw) {
  const fm = {};
  let body = raw;

  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const kv = line.match(/^(\w+):\s*([\s\S]*)$/);
      if (kv) fm[kv[1]] = kv[2].trim();
    }
    body = match[2];
  }

  let title = null;
  const kept = [];
  for (const line of body.split(/\r?\n/)) {
    // Japanese and Chinese sources write `#計画1.誕生` with no space after the
    // hash, so the space cannot be required — and one file uses the fullwidth
    // number sign U+FF03 (`＃`) that a CJK keyboard produces.
    if (title === null && /^[#＃]{1,6}\s*\S/.test(line)) {
      title = line.replace(/^[#＃]{1,6}\s*/, '').trim();
      continue;
    }
    kept.push(line);
  }

  const text = kept
    .join('\n')
    .replace(/^\s*---\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { title, description: fm.description ?? null, body: text };
}

/**
 * The English plan files define the canonical `<number> -> <slug>` mapping that
 * every other language's filenames are built from.
 */
function readSlugIndex() {
  const root = join(SRC, 'NeuroLeelaAgent/docs/plans');
  const index = new Map();
  if (!existsSync(root)) return index;

  for (const name of readdirSync(root)) {
    if (!name.endsWith('.md')) continue;
    const m = name.match(/^(\d+)-(.+)\.md$/);
    if (!m) continue;
    const n = Number(m[1]);
    if (n >= 1 && n <= TOTAL_PLANS && !RULE_SLUGS.has(m[2])) index.set(n, m[2]);
  }
  return index;
}

const SLUGS = readSlugIndex();

function makePlan(plan, parsed, source) {
  return {
    plan,
    title: stripNumbering(parsed.title, plan) ?? `${plan}`,
    description: parsed.description,
    body: parsed.body,
    source,
  };
}

/** Source 1: the Russian GitBook, numbered through SUMMARY.md. */
function readLeelabook() {
  const root = join(SRC, 'leelabook');
  if (!existsSync(root)) return { plans: [], warnings: ['leelabook not cloned'] };

  const summary = readFileSync(join(root, 'SUMMARY.md'), 'utf8');
  const plans = [];
  const warnings = [];

  const re = /^\*\s*\[План\s+(\d+)\.\s*([^\]]+)\]\(([^)]+)\)/gm;
  let m;
  while ((m = re.exec(summary)) !== null) {
    const [, num, summaryTitle, relPath] = m;
    const file = join(root, decodeURIComponent(relPath));
    if (!existsSync(file)) {
      warnings.push(`ru plan ${num}: missing ${relPath}`);
      continue;
    }
    const parsed = parseMarkdown(readFileSync(file, 'utf8'));
    const plan = makePlan(Number(num), parsed, `leelabook/${relPath}`);
    if (!parsed.title) plan.title = summaryTitle.trim();
    plans.push(plan);
  }
  return { plans, warnings };
}

/** Source 2: the English plans. */
function readEnglishPlans() {
  const root = join(SRC, 'NeuroLeelaAgent/docs/plans');
  if (!existsSync(root)) return { plans: [], warnings: ['NeuroLeelaAgent not cloned'] };

  const plans = [];
  for (const [n, slug] of SLUGS) {
    const file = join(root, `${n}-${slug}.md`);
    if (!existsSync(file)) continue;
    plans.push(
      makePlan(n, parseMarkdown(readFileSync(file, 'utf8')), `NeuroLeelaAgent/docs/plans/${n}-${slug}.md`),
    );
  }
  return { plans, warnings: [] };
}

/**
 * The English the 19 machine translations were made from.
 *
 * `translate-leela/index.js` reads `./docs` and writes `./locales/<lang>`, so
 * `docs` is the source and it is in English — and it is **not** the English
 * this dataset ships. `NeuroLeelaAgent/docs/plans/1-birth.md` is 2,240 bytes
 * where `translate-leela/docs/1-birth.md` is 1,977, and the two say different
 * things. Nineteen languages were therefore being judged against an edition
 * none of them came from, which is the same defect `leela-en` was captured to
 * fix, one family over.
 *
 * It makes no difference to the board references — both comparisons report
 * nothing for all seventeen shipped languages of this family, and that was
 * measured rather than assumed. It is kept anyway, because *nothing found* and
 * *nothing looked for* are the same sentence, and the next number to go missing
 * should be seen by a check that is right rather than one that agrees by luck.
 */
function readTranslateSource() {
  const root = join(SRC, 'translate-leela/docs');
  if (!existsSync(root)) return [];

  const plans = [];
  for (const [n, slug] of SLUGS) {
    const file = join(root, `${n}-${slug}.md`);
    if (!existsSync(file)) continue;
    plans.push(makePlan(n, parseMarkdown(readFileSync(file, 'utf8')), `translate-leela/docs/${n}-${slug}.md`));
  }
  return plans;
}

/** Source 3: translate-leela, `<n>-<slug>-<lang>.md` across 19 languages. */
function readTranslateLeela() {
  const root = join(SRC, 'translate-leela/locales');
  const byLang = {};
  if (!existsSync(root)) return byLang;

  for (const lang of readdirSync(root)) {
    const dir = join(root, lang);
    let files;
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }

    const plans = [];
    for (const [n, slug] of SLUGS) {
      // Filenames mostly follow `<n>-<slug>-<lang>.md`, but a few languages
      // renamed the slug, so fall back to matching on the number alone.
      let name = `${n}-${slug}-${lang}.md`;
      if (!files.includes(name)) {
        const alt = files.filter((f) => {
          const m = f.match(/^(\d+)-(.+)-[a-z]{2}\.md$/);
          return m && Number(m[1]) === n && !RULE_SLUGS.has(m[2]);
        });
        if (alt.length !== 1) continue;
        name = alt[0];
      }
      plans.push(
        makePlan(n, parseMarkdown(readFileSync(join(dir, name), 'utf8')), `translate-leela/locales/${lang}/${name}`),
      );
    }
    if (plans.length) byLang[lang] = plans;
  }
  return byLang;
}

/** Source 4: the shipped app's locale JSON, `plan_<n>: {title, content}`. */
function readAppLocales() {
  const roots = [join(SRC, 'leela/src/locales'), join(SRC, 'NeuroLeelaExpo/locales')].filter(existsSync);
  const byLang = {};

  for (const root of roots) {
    const label = root.includes('/leela/') ? 'leela' : 'NeuroLeelaExpo';
    for (const lang of readdirSync(root)) {
      const file = join(root, lang, 'translation.json');
      if (!existsSync(file)) continue;

      let json;
      try {
        json = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        continue;
      }

      const plans = [];
      for (let n = 1; n <= TOTAL_PLANS; n++) {
        const entry = json[`plan_${n}`] ?? json[`${n}-plan`] ?? json[`plan${n}`];
        if (!entry) continue;

        const title = typeof entry === 'string' ? entry : entry.title;
        const body = typeof entry === 'string' ? '' : (entry.content ?? '');
        if (!title && !body) continue;

        plans.push({
          plan: n,
          title: stripNumbering(title, n) ?? `${n}`,
          description: null,
          // Paragraphs, written the way every reader splits on them. This
          // donor separates them with a single newline and the markdown ones
          // use a blank line; passing both through unchanged is what made all
          // 72 plans in Arabic, Malay and Ukrainian one unbroken wall of text.
          body: paragraphed((body ?? '').trim()),
          source: `${label}/src/locales/${lang}/translation.json#plan_${n}`,
        });
      }

      if (plans.length && (byLang[lang]?.length ?? 0) < plans.length) byLang[lang] = plans;
    }
  }
  return byLang;
}

/** Rules chapters per language, keyed by a stable slug. */
function readRules() {
  const out = {};

  const ruChapters = {
    описание: 'summary',
    введение: 'introduction',
    смыслигры: 'meaning',
    чакры: 'chakras',
    нумерологияигры: 'numerology',
    примечания: 'notes',
  };
  const ruRoot = join(SRC, 'leelabook/правила');
  if (existsSync(ruRoot)) {
    out.ru = [];
    for (const [file, slug] of Object.entries(ruChapters)) {
      const path = join(ruRoot, `${file}.md`);
      if (!existsSync(path)) continue;
      const parsed = parseMarkdown(readFileSync(path, 'utf8'));
      out.ru.push({ slug, title: parsed.title, body: parsed.body, source: `leelabook/правила/${file}.md` });
    }
  }

  const enChapters = {
    '0-chortdescription': 'summary',
    '1-introduction': 'introduction',
    '2-meaningofthegame': 'meaning',
    '3-numerologygames': 'numerology',
    '4-chakras': 'chakras',
    '5-notes': 'notes',
    // `game-logic.md` is deliberately not here. It sits in the same folder as
    // the six numbered English chapters and is written in Russian — developer
    // notes on the NeuroLeela rewrite, titled «Логика игры НейроЛила» — and
    // this map published it as the seventh chapter of the *English* book, on
    // the docs site, for as long as the book has existed. It is not a chapter
    // of the rules and it is not English. `audit-dataset.mjs` now refuses any
    // chapter written in a script its language does not use.
  };
  const enRoot = join(SRC, 'NeuroLeelaAgent/docs/rules');
  if (existsSync(enRoot)) {
    out.en = [];
    for (const [file, slug] of Object.entries(enChapters)) {
      const path = join(enRoot, `${file}.md`);
      if (!existsSync(path)) continue;
      const parsed = parseMarkdown(readFileSync(path, 'utf8'));
      out.en.push({ slug, title: parsed.title, body: parsed.body, source: `NeuroLeelaAgent/docs/rules/${file}.md` });
    }
  }

  // The remaining languages keep their rules chapters in translate-leela.
  const trRoot = join(SRC, 'translate-leela/locales');
  const trChapters = {
    chortdescription: 'summary',
    introduction: 'introduction',
    meaningofthegame: 'meaning',
    numerologygames: 'numerology',
    chakras: 'chakras',
    notes: 'notes',
  };
  if (existsSync(trRoot)) {
    for (const lang of readdirSync(trRoot)) {
      if (out[lang]) continue;
      let files;
      try {
        files = readdirSync(join(trRoot, lang));
      } catch {
        continue;
      }
      const chapters = [];
      for (const file of files) {
        const m = file.match(/^\d+-(.+)-[a-z]{2}\.md$/);
        if (!m || !trChapters[m[1]]) continue;
        const parsed = parseMarkdown(readFileSync(join(trRoot, lang, file), 'utf8'));
        chapters.push({
          slug: trChapters[m[1]],
          title: parsed.title,
          body: parsed.body,
          source: `translate-leela/locales/${lang}/${file}`,
        });
      }
      if (chapters.length) out[lang] = chapters;
    }
  }

  // Languages the shipped app translated but translate-leela never covered
  // keep their rules chapters inside translation.json under named keys.
  const jsonChapters = {
    rulesOfPlay: 'summary',
    introduction: 'introduction',
    gameMeaning: 'meaning',
    numerology: 'numerology',
    chakras: 'chakras',
    notes: 'notes',
    onlineRules: 'online',
    foreword: 'foreword',
  };
  const appRoot = join(SRC, 'leela/src/locales');
  if (existsSync(appRoot)) {
    for (const lang of readdirSync(appRoot)) {
      if (out[lang]?.length) continue;
      const file = join(appRoot, lang, 'translation.json');
      if (!existsSync(file)) continue;

      let json;
      try {
        json = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        continue;
      }

      const chapters = [];
      for (const [key, slug] of Object.entries(jsonChapters)) {
        const entry = json[key];
        if (!entry) continue;
        const title = typeof entry === 'string' ? null : (entry.title ?? null);
        const body = typeof entry === 'string' ? entry : (entry.content ?? '');
        if (!body) continue;
        chapters.push({
          slug,
          title,
          body: body.trim(),
          source: `leela/src/locales/${lang}/translation.json#${key}`,
        });
      }
      if (chapters.length) out[lang] = chapters;
    }
  }

  return inEnglishOrder(out);
}

/**
 * One order for every book, taken from the only evidence there is.
 *
 * Each of the three readers above walks an object literal, and a book came out
 * in whatever sequence somebody typed those keys. Two of the literals happen to
 * agree; the Russian one does not, so a reader of the Russian book met the
 * chakras before the numerology and every other reader met them the other way
 * round. Nothing decided that. A key order did.
 *
 * The English chapters are the one source that carries an order of its own:
 * their filenames are numbered `0-chortdescription` … `5-notes`, and `3` is
 * numerology and `4` is chakras. The Russian files are a flat folder of
 * unnumbered names — plans and rules together — so there is nothing in them to
 * read an order out of, and the order they had was not theirs.
 *
 * Chapters English does not have keep their own sequence, after the ones it
 * does: `online` and `foreword` come from a different edition, and putting them
 * in the middle of a book on the strength of a slug would be inventing an order
 * rather than following one.
 */
function inEnglishOrder(books) {
  const canonical = (books.en ?? []).map((chapter) => chapter.slug);
  const ordered = {};

  for (const [language, chapters] of Object.entries(books)) {
    const known = chapters
      .filter((chapter) => canonical.includes(chapter.slug))
      .sort((a, b) => canonical.indexOf(a.slug) - canonical.indexOf(b.slug));
    const rest = chapters.filter((chapter) => !canonical.includes(chapter.slug));
    ordered[language] = [...known, ...rest];
  }

  return ordered;
}

// --- build -----------------------------------------------------------------

const warnings = [];

const leelabook = readLeelabook();
const english = readEnglishPlans();
warnings.push(...leelabook.warnings, ...english.warnings);

/**
 * lang -> plans[]. Sources are offered from weakest to strongest; a stronger
 * source wins as long as it is no less complete.
 *
 * Ranking, weakest first:
 *   1. the shipped apps' translation.json — titles and text, no descriptions
 *   2. translate-leela markdown — the machine translations, 19 languages
 *   3. the hand-authored English plans and the Russian GitBook — the originals
 */
const byLang = {};
function offer(lang, plans) {
  if (!plans?.length) return;
  if (plans.length >= (byLang[lang]?.length ?? 0)) byLang[lang] = plans;
}

const appLocales = readAppLocales();

/**
 * The English the published app's own locales were translated from.
 *
 * It is read, beaten by the hand-authored English markdown, and thrown away —
 * and it is the edition three shipped languages actually follow. Arabic, Malay
 * and Ukrainian come from `leela/src/locales/<lang>`, so their sibling is
 * `leela/src/locales/en`, which is **not** the English this dataset ships.
 *
 * The two say different things. *A snake leading from the tamoguna square
 * (field 72)* in the shipped English is *the snake of tamoguna* here, with no
 * number in it at all — so a translation of this edition that carries no 72 has
 * lost nothing, and `audit-numbers` recorded twenty-one such lines as damage
 * for as long as it has existed. The audit already knew the shape (*not every
 * language was translated from the same edition*, its third false alarm) and
 * compared against the wrong English.
 *
 * Kept as text rather than as the numbers it states, so the reading of it stays
 * in `lib/numbers.mjs` with every other reading. A derivation baked into a
 * generated file is a derivation that goes stale the day the rule changes —
 * which is the mistake `lib/corrections.mjs` exists to record.
 */
const EDITIONS = { 'leela-en': appLocales.en ?? [], 'translate-leela-en': readTranslateSource() };

for (const [lang, plans] of Object.entries(appLocales)) offer(lang, plans);
for (const [lang, plans] of Object.entries(readTranslateLeela())) offer(lang, plans);
offer('en', english.plans);
offer('ru', leelabook.plans);

const rules = readRules();

/**
 * What is already there, before anything is overwritten.
 *
 * The generator keeps the best copy of each language it finds across the donor
 * repositories, so a source directory that is incomplete — mis-typed,
 * half-cloned, empty — produces a *smaller* dataset rather than an error. Run
 * once against an empty directory, it emptied `rules.json` and the manifest,
 * exited 0, and printed "Content built". Twenty-four tests went red for a
 * reason none of them named.
 *
 * Losing ground is the signal. Gaining is the generator working.
 */
const before = existsSync(join(OUT, 'manifest.json'))
  ? dimensionsIn(JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8')))
  : new Map();

/**
 * What this build found, counted the same way the manifest records it.
 *
 * The rules chapters are counted here as well as the plans, because the run
 * that started all of this emptied `rules.json` *first* and the guard watched
 * only plans — a build that found all 72 plans in every language and not one
 * rules chapter used to pass. Same counts as the manifest written below, so
 * this build's `after` and the next build's `before` are the same measurement.
 *
 * That last sentence was a claim and not a fact until `withBody` was added
 * here. The manifest below has always written `{ plans, rules, withBody }`
 * while this map wrote two of the three, so the field that says whether the
 * pages have any text on them went into the file and was never compared to
 * anything. It is the cheapest one to lose, too: `plans` and `withBody` are
 * counted over the *same* plans, so a donor whose body extraction breaks — a
 * changed markup, a renamed field, a reader handing back the metadata and not
 * the page — still offers 72 plans and 72 empty bodies. Every count in this map
 * is now a count the manifest also records, and the refusal below sees all of
 * them.
 *
 * Counted over the same filtered array `plans` is counted over, so the two
 * numbers cannot disagree about which plans they are describing. The manifest's
 * own `withBody` is taken after `corrected()` has run over each body, which is
 * a text substitution and empties nothing — if a correction ever did empty a
 * body, the manifest would record one fewer than this and the next build would
 * read that smaller number as its floor, which is the safe direction.
 */
const after = new Map(
  Object.entries(byLang).map(([lang, plans]) => {
    const inRange = plans.filter((plan) => plan.plan >= 1 && plan.plan <= TOTAL_PLANS);
    return [
      lang,
      {
        plans: inRange.length,
        rules: rules[lang]?.length ?? 0,
        withBody: inRange.filter((plan) => plan.body.length > 0).length,
      },
    ];
  }),
);

const losses = checkRegression(before, after);

if (losses.length > 0 && !process.argv.includes('--force')) {
  console.error(`\nRefusing to write: this build found less than the dataset already has.\n`);
  for (const loss of losses.slice(0, 25)) console.error(`  ${loss}`);
  console.error(`\nSource read: ${SRC}`);
  console.error('If that is genuinely what you want, pass --force.');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const coverage = {};
const applied = [];
const spilledOver = [];
for (const [lang, plans] of Object.entries(byLang)) {
  const seen = new Map(plans.map((p) => [p.plan, p]));
  const complete = [];
  const gaps = [];
  for (let n = 1; n <= TOTAL_PLANS; n++) {
    const plan = seen.get(n);
    // Corrected here, at the one point where the language is known, so that a
    // stated repair does not depend on which of the four sources the text came
    // from — the three languages this touches are read by two different readers.
    if (plan) {
      const fixed = corrected(plan.body, lang, n);
      // And the title, through the same pass. A repair that can only reach a
      // body is a repair that sends the other half back into a generated file
      // with a countdown on it — which is the whole reason this module exists.
      const named = corrected(plan.title, lang, n, 'title');
      applied.push(...fixed.applied, ...named.applied);
      complete.push({ ...plan, title: named.body, body: fixed.body });
    }
    else gaps.push(n);
  }
  if (gaps.length) warnings.push(`${lang}: ${gaps.length} plans missing (${gaps.slice(0, 8).join(', ')}${gaps.length > 8 ? '…' : ''})`);

  // A page that becomes the next page halfway down. The donor edition Arabic,
  // Malay and Ukrainian are translated from runs plan 12 into plan 13, so a
  // player standing on Envy read the whole of Nullity. Cut here, where the plan
  // after it is known, and only where the run is that plan's own opening word
  // for word — the words stay on the page they belong to.
  for (const finding of spilloversIn(complete, lang)) {
    // The finding itself, not only its name: the name is what a record is
    // matched on, but the fresh direction has to be able to say which language
    // and which pair of plans a cut nobody authorised landed on.
    spilledOver.push(finding);
    const here = complete[finding.plan - 1];
    const next = complete[finding.plan];
    if (here && next) here.body = withoutSpillover(here.body, next.body);
  }

  writeFileSync(join(OUT, `plans.${lang}.json`), `${JSON.stringify(complete, null, 2)}\n`);
  coverage[lang] = {
    plans: complete.length,
    rules: rules[lang]?.length ?? 0,
    withBody: complete.filter((p) => p.body.length > 0).length,
  };
}

writeFileSync(join(OUT, 'rules.json'), `${JSON.stringify(rules, null, 2)}\n`);

// The editions nothing ships but the audits have to read, since the donor
// repositories are not in CI and asking which edition a translation followed is
// the only way to tell a lost number from a number that was never there.
mkdirSync(join(OUT, 'editions'), { recursive: true });
for (const [name, plans] of Object.entries(EDITIONS)) {
  if (plans.length === 0) {
    warnings.push(`edition ${name}: nothing read, so nothing written`);
    continue;
  }
  writeFileSync(join(OUT, 'editions', `${name}.json`), `${JSON.stringify(plans, null, 2)}\n`);
}

// A text that arrives as one paragraph where every other language has three.
//
// Plans 12 and 24 in Arabic, Malay and Ukrainian, and four chapters besides:
// the words are all there — seventy to a hundred per cent of the characters the
// other languages use — and not one blank line among them, so a reader of those
// three meets a wall where everybody else is given somewhere to rest. The three
// come from `leela/src/locales`, whose plan text is one JSON string;
// `paragraphed` restores the breaks where that donor wrote single newlines, and
// for these it wrote none at all.
//
// Reported rather than repaired. Deciding where a paragraph ends in somebody
// else's translation is deciding what their text says, which is the line
// `lib/corrections.mjs` draws and does not cross. Said out loud so it is a
// known gap rather than a silent one, and so a language that arrives this way
// is seen on the day it arrives.
warnings.push(
  ...wallsOfText(OUT, coverage).map(
    (wall) => `${wall}: one paragraph, where most languages have several`,
  ),
);

/**
 * Texts that carry no paragraph break where the same text has several
 * elsewhere.
 *
 * Compared across languages rather than against a number, because how many
 * paragraphs a plan has is the donor's business and differs from plan to plan.
 * What is not the donor's business is one language having none of them.
 */
function wallsOfText(out, coverage) {
  const langs = Object.keys(coverage).sort();
  const read = (name) => {
    try {
      return JSON.parse(readFileSync(join(out, name), 'utf8'));
    } catch {
      return [];
    }
  };

  const bodies = new Map();
  const put = (key, lang, body) => {
    if (!bodies.has(key)) bodies.set(key, new Map());
    bodies.get(key).set(lang, String(body ?? ''));
  };

  const allRules = read('rules.json');
  for (const lang of langs) {
    for (const plan of read(`plans.${lang}.json`)) put(`plan ${plan.plan}`, lang, plan.body);
    for (const chapter of allRules[lang] ?? []) put(`chapter ${chapter.slug}`, lang, chapter.body);
  }

  const blocks = (text) => text.split(/\n{2,}/).filter((part) => part.trim().length > 0).length;
  const middle = (numbers) => [...numbers].sort((a, b) => a - b)[Math.floor(numbers.length / 2)] ?? 0;

  const found = [];
  for (const [key, byLang] of bodies) {
    if (middle([...byLang.values()].map(blocks)) < 3) continue;

    // Only where the words are there. A translation that is half the length of
    // every other is a different finding, and the audits have it.
    const usual = middle([...byLang.values()].map((body) => body.length));
    for (const [lang, body] of byLang) {
      if (blocks(body) === 1 && body.length > usual * 0.6) found.push(`${lang} ${key}`);
    }
  }

  return found.sort();
}

const manifest = {
  // Relative to the repository, not as typed. The committed manifest carried
  // one machine's home directory, and the same rebuild from `../leela-src` and
  // from `/Users/…/leela-src` produced two different files — a dataset that
  // claims to be reproducible and is not, on one line.
  generatedFrom: relative(REPO, resolve(SRC)) || '.',
  totalPlans: TOTAL_PLANS,
  languages: Object.keys(coverage).sort(),
  coverage,
  warnings,
};
writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const langs = Object.keys(coverage).sort();
console.log(`Content built into ${OUT}`);
console.log(`  ${langs.length} languages: ${langs.join(' ')}`);
for (const lang of langs) {
  const c = coverage[lang];
  console.log(
    `    ${lang.padEnd(3)} plans ${String(c.plans).padStart(2)}/72   with text ${String(c.withBody).padStart(2)}   rules ${c.rules}`,
  );
}
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 25)) console.log(`  - ${w}`);
}

// A stated correction that matched nothing is the build describing text that is
// no longer there. Either the donor was fixed upstream and the entry should go,
// or it moved and the correction is now pointing at nothing — and the second one
// looks exactly like the first if the build stays quiet about it.
// The same rule the corrections get: a repair that has silently stopped
// matching is a repair that has been undone, and it must not go quiet.
if (spilledOver.length > 0) {
  console.log(`\nCut ${spilledOver.length} run(s) of one plan out of the one before it:`);
  for (const finding of spilledOver) console.log(`  - ${spilloverName(finding)}`);
}

// Both directions from one pass, the way the two sibling modules do it. The
// rotted half was the only one this build ever asked about, and the cut itself
// is unconditional: `withoutSpillover` runs on every language on every build.
// So an unrecorded finding is a plan's tail deleted from the shipped data with
// nobody's signature on it, and it has to be as loud as a record gone stale.
const spillovers = spilloversAgainst(spilledOver);
if (spillovers.rotted.length > 0) {
  console.log(`\n${spillovers.rotted.length} recorded spillover(s) matched nothing:`);
  for (const line of spillovers.rotted) console.log(`  - ${line}`);
  console.log('\nThe donor was fixed, or the text moved. Both need the entry looked at.');
  process.exitCode = 1;
}

if (spillovers.fresh.length > 0) {
  console.log(`\n${spillovers.fresh.length} unrecorded spillover(s) were cut anyway:`);
  for (const finding of spillovers.fresh) console.log(`  - ${spilloverName(finding)}`);
  console.log(
    '\nText was removed from the shipped book that no record accounts for. Read both plan',
  );
  console.log(
    'bodies: if the run really is the next plan\'s opening word for word, record it in',
  );
  console.log('RECORDED; if it is not, the cut is wrong and must not ship.');
  process.exitCode = 1;
}

const unapplied = unappliedIn(applied);
if (unapplied.length > 0) {
  console.log(`\n${unapplied.length} correction(s) matched nothing:`);
  for (const where of unapplied) console.log(`  - ${where}`);
  console.log('\nThe donor was fixed, or the text moved. Both need the entry looked at.');
  process.exitCode = 1;
}
