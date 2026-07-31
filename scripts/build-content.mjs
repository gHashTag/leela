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
import { checkRegression, coverageOf } from './lib/coverage.mjs';
import { corrected, unappliedIn } from './lib/corrections.mjs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const OUT = join(REPO, 'packages/content/data');

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
 * Strip the leading plan number from a title.
 *
 * Every language writes the word for "plan" in its own script — योजना, 计划,
 * 計画, 플랜, Kế hoạch, திட்டம் — so matching a list of words does not scale
 * and silently left the number in place for 15 of the 22 languages. Instead:
 * find the plan number near the start of the title and drop everything up to
 * and including it, along with any separator that follows.
 *
 * Only the leading run is considered, and only when the number appears within
 * the first few characters, so a title that legitimately contains its own
 * number ("The 3 gunas") is left alone.
 */
function stripNumbering(title, plan) {
  if (!title) return null;

  const index = title.indexOf(String(plan));
  // The label before the number is a word or two at most; beyond that we are
  // no longer looking at numbering.
  if (index === -1 || index > 12) return title.trim();

  // Refuse to cut when the digits are part of a longer number: "12" in "120".
  const after = title.slice(index + String(plan).length);
  if (/^\d/.test(after)) return title.trim();

  const remainder = after.replace(/^[\s.:)\-–—、。]+/, '').trim();
  // If cutting would leave nothing, the number was the whole title — keep it.
  return remainder.length > 0 ? remainder : title.trim();
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
          body: (body ?? '').trim(),
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

for (const [lang, plans] of Object.entries(readAppLocales())) offer(lang, plans);
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
  ? coverageOf(JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8')))
  : new Map();

const after = new Map(
  Object.entries(byLang).map(([lang, plans]) => [
    lang,
    plans.filter((plan) => plan.plan >= 1 && plan.plan <= TOTAL_PLANS).length,
  ]),
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
      applied.push(...fixed.applied);
      complete.push({ ...plan, body: fixed.body });
    }
    else gaps.push(n);
  }
  if (gaps.length) warnings.push(`${lang}: ${gaps.length} plans missing (${gaps.slice(0, 8).join(', ')}${gaps.length > 8 ? '…' : ''})`);

  writeFileSync(join(OUT, `plans.${lang}.json`), `${JSON.stringify(complete, null, 2)}\n`);
  coverage[lang] = {
    plans: complete.length,
    rules: rules[lang]?.length ?? 0,
    withBody: complete.filter((p) => p.body.length > 0).length,
  };
}

writeFileSync(join(OUT, 'rules.json'), `${JSON.stringify(rules, null, 2)}\n`);

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
const unapplied = unappliedIn(applied);
if (unapplied.length > 0) {
  console.log(`\n${unapplied.length} correction(s) matched nothing:`);
  for (const where of unapplied) console.log(`  - ${where}`);
  console.log('\nThe donor was fixed, or the text moved. Both need the entry looked at.');
  process.exitCode = 1;
}
