import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RULESETS } from '../src/index';
import { blank } from '../../../scripts/lib/source.mjs';

/**
 * A variant that claims to reproduce something is held to the thing it claims.
 *
 * `scripts/audit-variants.mjs` exists because a citation nobody re-reads is a
 * comment: it re-reads the donor for `legacy-mobile`, `online` and `telegram`
 * on every run. But it can only re-read the citations somebody remembered to
 * put in it. Nothing held the two files together — a variant could name a
 * donor file in its doc-comment and have no claim anywhere, which is exactly
 * the state `telegram` did not exist in and `onchain` was in for five flags.
 *
 * So the relation, over every variant the module exports rather than over a
 * list of names: **a doc-comment that cites a file this repository does not
 * hold must have a claim in `audit-variants` citing that same file, checked
 * against that same variant.** A citation to a file that *is* in this
 * repository is held here, by a test that can read it — that is how `onchain`
 * is held, by `packages/contracts`, and why it is not required to appear in
 * the audit.
 *
 * The variants that cite nothing at all are **printed, not failed**. `classic`
 * is the traditional rule and cites no application, because there is no
 * application to cite; failing it would be this test demanding that a rule of
 * the game be sourced from a program. Printing it puts the open question — on
 * whose authority does `classic` say what it says — where somebody reading a
 * test run will see it, without changing a rule on contested evidence.
 *
 * MEASURED while writing this, and worth keeping because the obvious sentence
 * is wrong: `online` cites nothing either, and it has ten claims in the audit.
 * Its doc-comment describes the published app in prose and names no file. So
 * the printed list is *variants whose prose points at no source*, not
 * *variants nothing checks* — a distinction this test would blur if it only
 * printed a number.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
/**
 * Read raw, on purpose, and it is the one file here that must be.
 *
 * Everything this test asks of `rulesets.ts` is asked OF the prose: a citation
 * lives in a doc-comment or in an inline comment on the flag it justifies, and
 * `citations()` exists to find it there. Blanking this would blank the subject.
 */
const RULESETS_TS = readFileSync(join(HERE, '..', 'src', 'rulesets.ts'), 'utf8');

/**
 * And read blanked, for the opposite reason, through the blanker the repository
 * shares rather than a regular expression of this file's own.
 *
 * `claimedFiles()` below parses this text as a table — `const NAME = [`, then
 * `file: '...'` inside it, then `for (const claim of NAME)` and `check(VARIANT,`
 * — and until this line it parsed the comments too. The audit is more than half
 * prose and that prose quotes its own table: the paragraph above `TELEGRAM_CLAIMS`
 * explains what the last claim in it is for, and any sentence that quotes a
 * `file:` line, or writes `check(ONLINE,` while explaining what a check is, would
 * be read as a claim that nothing re-reads. A paragraph about a citation is not a
 * citation, which is this whole file's subject one level up.
 *
 * MEASURED, 2026-08-06, before the line was written and again after: over the
 * audit as it stands today this changes NO answer. Both readings give the same
 * three variants and the same nine donor files — `LEGACY_MOBILE` four,
 * `ONLINE` six, `TELEGRAM` three. It is here for the claim it will not invent
 * later, not for one it invents now.
 */
const AUDIT = blank(readFileSync(join(ROOT, 'scripts', 'audit-variants.mjs'), 'utf8'));

/** Where a workspace path starts, when a citation is to this repository. */
const IN_REPO_PREFIX = /^(packages|apps|scripts|e2e|@leela)\//;

/** Every file name this repository holds, for resolving a bare citation. */
function fileNames(): Set<string> {
  const found = new Set<string>();

  const walk = (from: string): void => {
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      if (['node_modules', 'dist', 'coverage', '.git', '.turbo'].includes(entry.name)) continue;
      if (entry.isDirectory()) walk(join(from, entry.name));
      else found.add(entry.name);
    }
  };

  walk(ROOT);
  return found;
}

const NAMES = fileNames();

/**
 * One variant as it is written: its doc-comment and the object body, together.
 *
 * Both halves, because half the citations in this file are inline comments on
 * the flag they justify — `legacy-mobile` cites `store/helper.ts` from inside
 * the `Object.freeze`, not from the doc-comment above it.
 */
interface Written {
  name: string;
  id: string;
  text: string;
}

function asWritten(): Written[] {
  const pattern = /(\/\*\*[\s\S]*?\*\/\s*)?export const (\w+): RuleSet = Object\.freeze\(\{([\s\S]*?)\n\}\);/g;
  const found: Written[] = [];

  for (const match of RULESETS_TS.matchAll(pattern)) {
    const [, doc = '', name = '', body = ''] = match;
    const id = /\bid: '([^']+)'/.exec(body)?.[1];
    if (id === undefined) continue;
    found.push({ name, id, text: `${doc}${body}` });
  }

  return found;
}

/**
 * The files a variant's prose points at.
 *
 * Two shapes, because both are used: a path with a slash in it, anywhere in
 * the text, and a bare file name in backticks. A trailing `:78` or `:17-22` is
 * part of the citation and not part of the path.
 */
function citations(text: string): string[] {
  const paths = [...text.matchAll(/(?:[\w@.-]+\/)+[\w.-]+\.\w+(?::\d+(?:-\d+)?)?/g)].map((m) => m[0]);
  const bare = [...text.matchAll(/`([\w.-]+\.\w{2,4})(?::\d+(?:-\d+)?)?`/g)].map((m) => m[1] ?? '');

  return [...new Set([...paths, ...bare].map((one) => one.replace(/:\d+(?:-\d+)?$/, '')))];
}

/** Whether a citation names something this repository holds and can read. */
function inThisRepository(citation: string): boolean {
  if (IN_REPO_PREFIX.test(citation)) return true;
  if (!citation.includes('/')) return NAMES.has(citation);
  return existsSync(join(ROOT, citation));
}

/**
 * Which donor files the audit checks against which variant.
 *
 * Read out of the audit's source rather than imported: importing it would run
 * it, and it exits when the donor clones are absent — which is every CI run.
 * The parse is deliberately strict about the two shapes the file uses, and the
 * test below asserts it found something. A parse that quietly returned nothing
 * would turn this whole file into a check that passes because it did not look,
 * which is the failure this repository keeps meeting.
 */
function claimedFiles(): Map<string, Set<string>> {
  const arrays = new Map<string, string[]>();
  for (const match of AUDIT.matchAll(/const (\w+) = \[\n([\s\S]*?)\n\];/g)) {
    const files = [...(match[2] ?? '').matchAll(/file: '([^']+)'/g)].map((one) => one[1] ?? '');
    arrays.set(match[1] ?? '', files);
  }

  const loops = [...AUDIT.matchAll(/for \(const claim of (\w+)\)/g)];
  const byVariant = new Map<string, Set<string>>();

  for (const [index, loop] of loops.entries()) {
    const from = loop.index ?? 0;
    const to = index + 1 < loops.length ? (loops[index + 1]?.index ?? AUDIT.length) : AUDIT.length;
    const segment = AUDIT.slice(from, to);
    const files = arrays.get(loop[1] ?? '') ?? [];

    for (const call of segment.matchAll(/check\((\w+),/g)) {
      const variant = call[1] ?? '';
      const already = byVariant.get(variant) ?? new Set<string>();
      for (const file of files) already.add(file);
      byVariant.set(variant, already);
    }
  }

  return byVariant;
}

describe('reading the variants as they are written', () => {
  it('finds every one the module exports, or it is checking a subset', () => {
    // The guard against the parse drifting off the file. A variant declared
    // some other way would be invisible to everything below, and invisible is
    // how a variant with no evidence stays.
    const written = asWritten();

    expect(written.length).toBe(Object.keys(RULESETS).length);
    expect(written.map((one) => one.id).sort()).toEqual(Object.keys(RULESETS).sort());
  });

  it('reads the audit as a table it can actually see', () => {
    // Same guard, other file. If this map came back empty every variant would
    // look unheld, and the assertion below would fail loudly rather than pass
    // — but an empty map with no citations anywhere would pass silently.
    const claimed = claimedFiles();

    expect(claimed.size).toBeGreaterThan(1);
    for (const [variant, files] of claimed) expect(files.size, variant).toBeGreaterThan(0);
  });

  it('tells a donor citation from one this repository holds', () => {
    // Both branches, on the two that are actually in the file. A classifier
    // that answered "in this repository" to everything would make the whole
    // check vacuous, and it would do it silently.
    expect(inThisRepository('packages/contracts/tests/gate.test.ts')).toBe(true);
    expect(inThisRepository('LeelaGame.sol')).toBe(true);
    expect(inThisRepository('leela-chakra-bot/src/index.ts')).toBe(false);
    expect(inThisRepository('leela/src/store/helper.ts')).toBe(false);
  });

  it('finds an in-repository citation that has gone stale', () => {
    // The cheap half of the same idea: a doc-comment pointing at a file of
    // ours that no longer exists is a citation nobody re-read either.
    const stale: string[] = [];

    for (const { id, text } of asWritten()) {
      for (const citation of citations(text)) {
        if (!IN_REPO_PREFIX.test(citation)) continue;
        if (citation.startsWith('@leela/')) continue;
        if (!existsSync(join(ROOT, citation))) stale.push(`${id} cites ${citation}, which is not here`);
      }
    }

    expect(stale).toEqual([]);
  });
});

describe('a variant that claims to reproduce an application', () => {
  it('is held to it by a claim naming the same donor file', () => {
    const claimed = claimedFiles();
    const unheld: string[] = [];

    for (const { name, id, text } of asWritten()) {
      const donorCitations = citations(text).filter((one) => !inThisRepository(one));
      if (donorCitations.length === 0) continue;

      const files = claimed.get(name);
      if (files === undefined) {
        unheld.push(`${id} cites ${donorCitations.length} donor file(s) and audit-variants checks nothing against it`);
        continue;
      }

      for (const citation of donorCitations) {
        const held = [...files].some((file) => file === citation || file.endsWith(`/${citation}`));
        if (!held) unheld.push(`${id} cites ${citation}, and no claim in audit-variants re-reads it`);
      }
    }

    expect(unheld).toEqual([]);
  });

  it('leaves the ones that cite nothing visible instead of silent', () => {
    const written = asWritten();

    // Three kinds, and the difference between the first two is the whole
    // reason to print rather than to count. A variant citing nothing has no
    // evidence to re-read; a variant citing only files vendored here has
    // evidence and it is held by a test in this repository — `onchain` and
    // `packages/contracts` — which is a different situation with the same
    // number attached to it.
    const nothing = written.filter(({ text }) => citations(text).length === 0).map(({ id }) => id);
    const onlyOurs = written
      .filter(({ text }) => citations(text).length > 0)
      .filter(({ text }) => citations(text).every((one) => inThisRepository(one)))
      .map(({ id }) => id);
    const donors = written
      .filter(({ text }) => citations(text).some((one) => !inThisRepository(one)))
      .map(({ id }) => id);

    console.log(`\n  cite no source at all:               ${nothing.join(', ') || '(none)'}`);
    console.log(`  cite only evidence vendored here:    ${onlyOurs.join(', ') || '(none)'}`);
    console.log(`  cite a donor, and are held to it:    ${donors.join(', ') || '(none)'}\n`);

    // Printed rather than asserted. `classic` belongs in the first list and is
    // not a defect: it is the traditional rule, and the open question is on
    // whose authority it says what it says. `online` belongs there too and
    // *is* checked — its prose simply names no file, which is worth seeing.
    //
    // Both branches have to be inhabited or the assertion above proves
    // nothing: with no donor citations anywhere there would be nothing to
    // hold, and with every variant citing one this list would be dead.
    expect(nothing.length, 'variants citing nothing').toBeGreaterThan(0);
    expect(donors.length, 'variants citing a donor').toBeGreaterThan(0);
    expect(nothing.length + onlyOurs.length + donors.length).toBe(Object.keys(RULESETS).length);

    // Not asserted: *which* variants are in which list. `classic` is in the
    // first one today, and the day somebody sources it from an application and
    // adds the claim, that is this check working — a test naming it here would
    // go red for the right change, and a check that cries wolf on correct code
    // is one somebody deletes rather than obeys.
  });
});
