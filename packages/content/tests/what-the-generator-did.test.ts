/**
 * Every step that changes a text, asked of the text.
 *
 * The generator does four things to what the donors hand it: it applies the
 * stated corrections, it restores paragraph breaks a donor wrote with single
 * newlines, it cuts one plan's text out of the plan before it, and it takes off
 * the markdown a page is written in. Each is a step that can stop happening,
 * and a step nothing checks is a step that stops quietly.
 *
 * **The generator needs the donor, and the donor is not in CI.** So the checks
 * that live in the build — and the spillover cut's rot check is one of them —
 * run only when somebody rebuilds by hand. The cut is the one that matters
 * most: the Arabic, Malay and Ukrainian donor runs plan 12 into plan 13, so a
 * player standing on Envy read the whole of Nullity, and until this was written
 * nothing that runs on a push would have said if it came back.
 *
 * Asked here and in `audit-dataset`, of the shipped data, where the answer does
 * not depend on having the donor to hand.
 *
 * And asked so that silence means something. A detector that has stopped
 * finding anything is silent in exactly the way clean data is — which is the
 * shape that passed eighteen broken translations a pass ago, where a structural
 * correction was verified by running its own repair again. The spillover check
 * proves the detector on a plan built to carry the next one before it believes
 * the quiet.
 */

import { describe, expect, it } from 'vitest';
// The generator's logic is plain JavaScript, shared with the scripts.
import { LONG_ENOUGH, spilloversIn } from '../../../scripts/lib/spillover.mjs';
import { LANGUAGES, plansFor, rulesFor } from '../src/index';

/** Every text a reader can open, in the shape the generator wrote it. */
function everyText() {
  return LANGUAGES.flatMap((language) => [
    ...plansFor(language).map((plan) => ({
      language,
      name: `plan ${plan.plan}`,
      body: String(plan.body ?? ''),
    })),
    ...rulesFor(language).map((chapter) => ({
      language,
      name: chapter.slug,
      body: String(chapter.body ?? ''),
    })),
  ]);
}

describe('what the generator did to a text', () => {
  it('cut no plan short and left none carrying the next', () => {
    // The repair the donor made necessary, asked of the data. `spilloversIn` is
    // the finder rather than the cut, so this is a property of the text and not
    // a second run of the thing that made it true.
    const carried = LANGUAGES.flatMap((language) =>
      spilloversIn(
        plansFor(language).map((plan) => ({ plan: plan.plan, body: plan.body })),
        language,
      ),
    );

    expect(carried).toEqual([]);
  });

  it('would say so if the finder had stopped finding', () => {
    // Without this the assertion above passes on a broken finder exactly as it
    // passes on clean data, and the two are indistinguishable from the outside.
    const carried = 'Nullity is the second snake and it takes the player back to the start. '.repeat(6);

    expect(carried.length).toBeGreaterThan(LONG_ENOUGH);

    const found = spilloversIn(
      [
        { plan: 12, body: `Envy stings and returns them. ${'It is a long fall. '.repeat(20)}\n\n${carried}` },
        { plan: 13, body: `${carried}\n\nIt is a familiar one.` },
      ],
      'canary',
    );

    expect(found).toHaveLength(1);
  });

  it('took the markdown off, so no rule reached a reader', () => {
    // `---` is a page break in the donor and a row of hyphens on a screen.
    const left = everyText().filter((text) => /^[ \t]*-{3,}[ \t]*$/m.test(text.body));

    expect(left.map((text) => `${text.language}/${text.name}`)).toEqual([]);
  });

  it('left no gap wider than a paragraph', () => {
    // Three newlines are two blank lines, which is a hole in a page rather than
    // a break between paragraphs. The generator collapses them; this says the
    // collapse happened.
    const gaping = everyText().filter((text) => /\n{3,}/.test(text.body));

    expect(gaping.map((text) => `${text.language}/${text.name}`)).toEqual([]);
  });

  it('gave every text somewhere to break, or the build said which', () => {
    // The fourth step is `paragraphed`, and it has a data-side check of its own
    // in `paragraphs.test.ts`. What is left over from it — sixteen texts whose
    // donor wrote no break at all — is named in the manifest rather than
    // repaired, and `nowhere-to-rest.test.ts` holds that. This asserts the two
    // meet: a text with one paragraph is either in the manifest or in a
    // language whose plans mostly read properly.
    const walls = everyText().filter(
      (text) => text.body.length > 800 && !text.body.includes('\n\n'),
    );

    for (const wall of walls) {
      const others = plansFor(wall.language).filter((plan) =>
        String(plan.body ?? '').includes('\n\n'),
      );

      expect({ where: `${wall.language}/${wall.name}`, rest: others.length > 60 }).toEqual({
        where: `${wall.language}/${wall.name}`,
        rest: true,
      });
    }
  });
});
