import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the generator, which is plain JavaScript.
import {
  LONG_ENOUGH,
  RECORDED,
  against,
  nameOf,
  spilloverAt,
  spilloversIn,
  withoutSpillover,
} from '../../../scripts/lib/spillover.mjs';
import type { Spillover } from '../../../scripts/lib/spillover.d.mts';
// The sibling this module was born half of. Imported to compare shapes, not
// behaviour: see 'the shape a record can be wrong in' below.
import { against as untranslatedAgainst } from '../../../scripts/lib/untranslated.mjs';
import { LANGUAGES } from '../src/index';
import type { Language } from '../src/language';

/**
 * A plan's page carrying the next plan's text.
 *
 * The Arabic page for plan 12 opens on envy and, halfway down and without a
 * break, becomes antariksha — which is plan 13. A player standing on Envy read
 * the whole of Nullity. Arabic, Malay and Ukrainian are the three languages
 * translated from the donor edition where `plan_12.content` is envy followed by
 * the opening of `plan_13.content`, and each carried the join.
 *
 * What is asserted here is the *rule*, on texts built for the purpose: the
 * three that exist today are gone from the data, so a check that named them
 * would be a check on nothing.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');

const plansOf = (language: Language) =>
  JSON.parse(readFileSync(join(DATA, `plans.${language}.json`), 'utf8')) as Array<{
    plan: number;
    title: string;
    body: string;
  }>;

const ENVY = 'Envy is the first snake of the game, and its bite takes the player back down. ';
const NULLITY =
  'Antariksha is the space between the physical plane and the celestial one, neither here nor there. ';

/** A plan whose body ends in `howMuch` characters of the next plan's opening. */
const joined = (next: string, howMuch: number) =>
  ENVY.repeat(Math.ceil((howMuch * 2) / ENVY.length)) + next.slice(0, howMuch);

describe('where the next plan begins inside this one', () => {
  it('finds a run long enough to be a page and not a quotation', () => {
    const next = NULLITY.repeat(20);
    const body = joined(next, LONG_ENOUGH * 2);

    const at = spilloverAt(body, next);
    expect(at, 'the join was found').not.toBeNull();
    expect(body.slice(at ?? 0).startsWith(next.slice(0, 40))).toBe(true);
  });

  it('leaves a short quotation of the next plan alone', () => {
    // A book is allowed to name what comes next. The three real ones run to
    // 548, 672 and 725 characters; no other neighbouring pair in any of the
    // twenty-two languages shares even sixty.
    const next = NULLITY.repeat(20);
    expect(spilloverAt(joined(next, LONG_ENOUGH - 20), next)).toBeNull();
  });

  it('leaves a plan that opens where the last one stopped', () => {
    // Taking up a thread at the top of a page is not a page running into the
    // next one, and cutting from the first sentence would empty it.
    const next = NULLITY.repeat(20);
    const body = next.slice(0, LONG_ENOUGH * 2) + ENVY.repeat(30);

    expect(spilloverAt(body, next)).toBeNull();
  });

  it('says nothing about an empty plan either way', () => {
    expect(spilloverAt('', NULLITY)).toBeNull();
    expect(spilloverAt(NULLITY, '')).toBeNull();
  });

  it('finds the join across a difference in whitespace', () => {
    /**
     * The reason the reading is done on flattened text and converted back. In
     * the donor the same sentences carry a line break in one copy and a space
     * in the other — `nullity.\nNul` on one page, `nullity. Nul` on the next —
     * and counting characters on either side would cut in the wrong place.
     */
    const next = NULLITY.repeat(20);
    const body = joined(next, LONG_ENOUGH * 2).replace(/\. /g, '.\n\n');

    const at = spilloverAt(body, next);
    expect(at).not.toBeNull();
    expect(withoutSpillover(body, next).length).toBeLessThan(body.length);
  });
});

describe('what the cut takes and what it leaves', () => {
  it('takes the next plan and nothing before it', () => {
    const next = NULLITY.repeat(20);
    const own = ENVY.repeat(30);
    const body = own + next.slice(0, LONG_ENOUGH * 2);

    expect(withoutSpillover(body, next)).toBe(own.trimEnd());
  });

  it('leaves a plan with no spillover exactly as it was', () => {
    // The other half of the rule: a cut that fires on ordinary text would
    // quietly shorten the book.
    const body = ENVY.repeat(30);
    expect(withoutSpillover(body, NULLITY.repeat(20))).toBe(body);
  });

  it('never takes the whole of a plan', () => {
    // A page cut to nothing is worse than a page with too much on it.
    const next = NULLITY.repeat(20);
    for (const share of [0.3, 0.5, 0.9]) {
      const own = ENVY.repeat(Math.ceil((LONG_ENOUGH * 2 * (1 - share)) / ENVY.length) + 5);
      const body = own + next.slice(0, LONG_ENOUGH * 2);
      expect(withoutSpillover(body, next).length, `${share}`).toBeGreaterThan(0);
    }
  });
});

describe('the book as it ships', () => {
  it('has no plan carrying the opening of the one after it', () => {
    // Over every language and every neighbouring pair, rather than over the
    // three that were found: this is the check that fails if a rebuild puts
    // them back, and the one that would have caught them in the first place.
    for (const language of LANGUAGES) {
      const found = spilloversIn(plansOf(language), language);
      expect(found.map((finding) => `${finding.language} ${finding.plan}`), language).toEqual([]);
    }
  });

  it('still has plan 13 in the languages plan 12 was cut in', () => {
    // What was removed was not lost. It was already on the page it belongs to,
    // which is the whole argument for removing it.
    for (const language of ['ar', 'ms', 'uk'] as const) {
      const plans = plansOf(language);
      const thirteen = plans.find((plan) => plan.plan === 13);
      const twelve = plans.find((plan) => plan.plan === 12);

      expect(thirteen?.body.length ?? 0, language).toBeGreaterThan(1000);
      expect(twelve?.body.length ?? 0, language).toBeGreaterThan(500);
    }
  });
});

/**
 * The two directions a record can be wrong in, and the one that was missing.
 *
 * This module shipped with `RECORDED` and no `against`, so the build asked only
 * whether a recorded line had stopped matching. The other direction was never
 * written down as missing, because the doc-comment stated only the rotted half.
 *
 * That direction is the one that reaches a player. `build-content.mjs` runs
 * `spilloversIn` over every language and truncates with `withoutSpillover`
 * unconditionally — recorded or not. So a donor update that introduces a
 * run-on in a fourth language has that plan's tail deleted from the shipped
 * dataset by a cut nobody authorised, printed under a heading that reads as the
 * tool working, with the build still exiting 0. Nothing downstream can see it:
 * the built data has zero findings *because* the cut already happened, which is
 * why these assertions are on synthetic findings rather than on `data/`.
 *
 * Asserted as a shape, over a grid built from the edge of every column of a
 * finding — language, plan, into — rather than over the three lines that exist.
 * A check that named them would be a check on nothing, the same argument the
 * cut tests above already make.
 *
 * **Falsified, not assumed.** Making `against` return `fresh: []`
 * unconditionally turned this suite red — 3 failed, 14 passed of 17, with every
 * assertion about the rotted direction still green, which is precisely the
 * half-built state the module shipped in:
 *   - "an unrecorded finding comes back fresh, and never rotted"
 *       AssertionError: ar plan 1 carries the opening of plan 2 was cut with
 *       nothing recording it: expected [] to deep equally contain
 *       { language: 'ar', plan: 1, into: 2, at: 0 }
 *   - "both directions come back from the one pass"
 *       AssertionError: expected [] to deeply equal [ Array(1) ]
 *   - "reports the same two lists as the sibling it was born half of"
 *       fresh carries findings: expected [] to have a length of 21 but got +0
 * Restoring the filter put all 17 back. The last of those is the one that
 * matters most: it is the assertion that the next module in this family cannot
 * be born half-built either.
 *
 * **What the fresh direction reports on this machine: nothing.** With the donor
 * clones at ../leela-src present, `node scripts/build-content.mjs` cuts exactly
 * the three recorded runs and finds no fourth. The `es plan 40 carries the
 * opening of plan 41` that motivated this work did not reproduce: the longest
 * prefix of plan 41 found inside plan 40 in every Spanish donor set on this
 * disk is 8 characters — `# Plan 4`, the markdown heading — against a
 * LONG_ENOUGH of 200. It is not recorded, because recording a join that is not
 * there would make the build fail as rotted and would be a lie in a file whose
 * whole purpose is to be true.
 */
describe('the two directions a record can be wrong in', () => {
  /** The wording `nameOf` produces, read back apart again. */
  const RECORD = /^(\S+) plan (\d+) carries the opening of plan (\d+)$/;

  const parse = (line: string): Spillover => {
    const match = RECORD.exec(line);
    if (!match) throw new Error(`not a line nameOf can produce: ${line}`);
    return { language: match[1], plan: Number(match[2]), into: Number(match[3]), at: 0 };
  };

  const recorded = RECORDED.map(parse);

  /**
   * Every combination of the columns, at each column's edge.
   *
   * Languages: the ones a record names, plus ones no record has ever named.
   * Plans: the pair a record names, the first pair, and the last pair — a
   * finding on plan 71 is as unrecorded as one on plan 40, and the grid says so
   * without either being listed as a case.
   */
  const GRID: Spillover[] = ['ar', 'ms', 'uk', 'es', 'de', 'zz'].flatMap((language) =>
    [12, 1, 40, 71].map((plan) => ({ language, plan, into: plan + 1, at: 0 })),
  );

  const unrecorded = GRID.filter((finding) => !RECORDED.includes(nameOf(finding)));

  it('has a grid that is neither all recorded nor all new', () => {
    // Otherwise the two tests below would pass over an empty list and assert
    // nothing at all — the failure mode that put this whole family in the repo.
    expect(unrecorded.length, 'unrecorded cells').toBeGreaterThan(0);
    expect(GRID.length - unrecorded.length, 'recorded cells').toBe(RECORDED.length);
  });

  it('an unrecorded finding comes back fresh, and never rotted', () => {
    for (const finding of unrecorded) {
      const { fresh, rotted } = against([finding]);

      expect(fresh, `${nameOf(finding)} was cut with nothing recording it`).toContainEqual(finding);
      expect(rotted, `${nameOf(finding)} is not a record`).not.toContain(nameOf(finding));
    }
  });

  it('a record that matched nothing comes back rotted, and never fresh', () => {
    for (const missing of recorded) {
      const rest = recorded.filter((finding) => nameOf(finding) !== nameOf(missing));
      const { fresh, rotted } = against(rest);

      expect(rotted, `${nameOf(missing)} stopped matching`).toContain(nameOf(missing));
      expect(fresh.map(nameOf), 'the rest are all recorded').toEqual([]);
      expect(rotted, 'only the one that stopped matching').toHaveLength(1);
    }
  });

  it('both directions come back from the one pass', () => {
    // A build that reports one and swallows the other is what this replaces, so
    // the two have to be able to be true at once.
    const { fresh, rotted } = against([...recorded.slice(1), unrecorded[0]]);

    expect(fresh.map(nameOf)).toEqual([nameOf(unrecorded[0])]);
    expect(rotted).toEqual([nameOf(recorded[0])]);
  });

  it('says nothing in either direction when every record matched and nothing else did', () => {
    expect(against(recorded)).toEqual({ fresh: [], rotted: [] });
  });

  it('records only lines nameOf can produce', () => {
    // Parsed back rather than listed: a record misspelled by one word is a
    // record that can never match, and would read as an honest rotted entry
    // forever. Listing the three would not catch a fourth added by hand.
    for (const line of RECORDED) expect(nameOf(parse(line)), line).toBe(line);
  });

  it('reports the same two lists as the sibling it was born half of', () => {
    // The asymmetry this fixes was invisible because nobody compared them. If a
    // third module in this family renames a half or ships only one, this fails.
    expect(Object.keys(against(unrecorded)).sort()).toEqual(
      Object.keys(untranslatedAgainst([])).sort(),
    );
    expect(against(unrecorded).fresh, 'fresh carries findings').toHaveLength(unrecorded.length);
    expect(against(unrecorded).rotted, 'rotted carries lines').toEqual([...RECORDED]);
  });
});
