import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the generator, which is plain JavaScript.
import {
  LONG_ENOUGH,
  spilloverAt,
  spilloversIn,
  withoutSpillover,
} from '../../../scripts/lib/spillover.mjs';
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
