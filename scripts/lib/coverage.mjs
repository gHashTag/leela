/**
 * Whether the generated dataset still covers what the package promises.
 *
 * `packages/content/data` is generated from the donor repositories by
 * `build-content.mjs`, and the generator writes whatever it found. Handed a
 * source directory with nothing in it, it found nothing, wrote an empty
 * `rules.json` and an empty manifest, exited 0, and said "Content built" — and
 * 24 tests in `@leela/content` went red for a reason none of them named.
 *
 * That happened here, to this repository, while checking something else. Two
 * silences made it possible and both are closed below:
 *
 * - the generator had no idea what it was replacing, so losing 22 languages
 *   looked the same to it as building the first one;
 * - CI's dataset check iterates the languages *the manifest lists*, so an empty
 *   manifest is zero iterations and a green job. A check that reads its own
 *   subject out of the thing under test cannot fail on an absence.
 *
 * `LANGUAGES` in `packages/content/src` is the promise; the data has to keep
 * it. That is a comparison against something declared in code, rather than a
 * number written down twice.
 *
 * **A third silence, and it is the first thing that incident destroyed.** The
 * sentence above says the run "wrote an empty `rules.json`" — the rules book
 * went before the plans did. The guard written afterwards watched plans and
 * nothing else: `coverageOf` read `entry.plans` and threw the rest of the
 * entry away, though `build-content.mjs` has always written
 * `{ plans, rules, withBody }`. A rebuild that found all 72 plans in every
 * language and not one rules chapter therefore passed the guard, wrote, and
 * exited 0. Measured, at this level: `coverageOf` over the shipped manifest
 * gave 72 for `ru` and nothing else, and `checkRegression` handed an `after`
 * with the same plans and zero rules returned `[]`.
 *
 * Two things are true and they are not the same thing, so both are written
 * down. The hole is **measured** — the paragraph above is what the functions
 * did. Whether it is **reachable** is **assumed**: an attempt to construct a
 * donor tree that loses the rules while keeping the plans failed, because
 * every mutilation that took the rules away took the Russian plans with them.
 * So this guard closes a hole nobody has yet walked through. That is worth
 * doing at this price and it is not worth claiming more for.
 *
 * **A fourth silence, and this one was reachable by construction.** The
 * paragraph above names the three fields the generator writes —
 * `{ plans, rules, withBody }` — and then the line below it tracked two of
 * them. Measured against the shipped manifest: `ru` is
 * `{ plans: 72, rules: 6, withBody: 72 }`, `dimensionsIn` kept
 * `{ plans: 72, rules: 6 }`, and `checkRegression` handed an `after` in which
 * every one of the 22 languages had `withBody: 0` returned no problems at all,
 * where the same experiment on `rules` returned 22. A build that found every
 * plan file in every language and not one word of text inside any of them was
 * a silent, unprompted overwrite of the good dataset.
 *
 * Unlike the `rules` hole this one needed no invented donor tree to reach.
 * `build-content.mjs` counts `plans` and `withBody` over the *same* array of
 * plans: any donor whose body extraction breaks — a changed markup, a renamed
 * field, a reader returning the metadata and not the page — yields 72 plans,
 * the real rules, and `withBody: 0`. No loss, no `--force` prompt, and
 * `mkdirSync`/`writeFileSync` a few lines later replace 22 good languages with
 * 22 empty ones. That is verbatim the accident this file was written about,
 * one field to the left.
 *
 * And the grid meant to catch exactly this could not: it derives its dimensions
 * from `dimensionsIn`, which is the guard, so it walked the edge of every
 * dimension the guard already knew and could not fail on the one it did not.
 * The sentence at the top of this file — *a check that reads its own subject
 * out of the thing under test cannot fail on an absence* — turned on itself.
 * The grid now reads its dimensions out of the generator's real manifest, and
 * asserts every key it finds there is in `TRACKED`, so the next field the
 * generator writes is a red test rather than a fifth silence.
 *
 * **Why `dimensionsIn` is a second function rather than a wider `coverageOf`.**
 * The obvious fix is to make `coverageOf` return the whole entry, and it was
 * written that way first. It breaks `audit-dataset.mjs`, which does not only
 * hand the map to `checkCoverage` — it compares `coverage.get(language)` with
 * `plans.length` under `!==`, on purpose, because the manifest is a summary the
 * generator wrote and the plan files are the thing itself. An object is never
 * strictly equal to a number, so all 22 languages became findings reading
 * "the manifest says [object Object] plans". Measured, by running it. The two
 * readers want different things: that audit wants one number to compare
 * against one file, and this guard wants every number a rebuild can lose. So
 * they get a function each, and `coverageOf` keeps the contract its caller
 * relies on.
 */

/**
 * Every dimension of a language's coverage that a rebuild can lose.
 *
 * Adding a name here is all it takes to guard a new one: `dimensionsIn` reads
 * it, `checkRegression` compares it, and the grid in `coverage.test.ts` walks
 * its edge without anybody remembering to walk it.
 *
 * The list has to hold every key `build-content.mjs` writes into a coverage
 * entry, and it did not: `withBody` was written by the generator and missing
 * here, so a build that lost all the text in all 22 languages was not a loss.
 * That is not left to whoever reads this — `coverage.test.ts` reads the keys of
 * a real entry out of the shipped manifest and fails naming any that is absent
 * from this list.
 */
const TRACKED = ['plans', 'rules', 'withBody'];

/**
 * One language's counts, whatever shape they arrived in.
 *
 * A bare number is read as plans, because that is what every caller and every
 * manifest meant before `rules` was tracked, and a manifest written by an older
 * build is exactly the input this must not throw on. A missing dimension is 0,
 * which makes an old manifest's absent `rules` a floor of zero — so the first
 * build after this change cannot be a regression, and the second one can.
 *
 * That is what protects widening `TRACKED`, and it is why widening it is safe
 * to do at any time: a name added here reads as 0 out of every manifest written
 * before it, and zero is a floor nothing can fall below. `withBody` is the
 * milder case of the same rule and worth separating from it — the generator has
 * written `withBody` into every manifest it ever wrote, so the shipped one
 * already carries the real 72s. Tracking it therefore starts guarding on the
 * *first* build rather than the second: measured, the shipped `ru` entry is
 * `{ plans: 72, rules: 6, withBody: 72 }`. The zero-floor still matters for a
 * hand-edited or truncated manifest, which is the input that must not become a
 * false alarm.
 */
const dimensionsOf = (value) => {
  const entry = typeof value === 'number' ? { plans: value } : (value ?? {});
  return Object.fromEntries(TRACKED.map((name) => [name, entry[name] ?? 0]));
};

/**
 * Plans the dataset claims, as `Map<language, plans>`.
 *
 * One number per language, because its caller compares that number with the
 * length of a file. For the regression guard, which has to see everything a
 * rebuild can take away, use `dimensionsIn`.
 */
export const coverageOf = (manifest) => {
  const counts = new Map();
  for (const [language, entry] of Object.entries(manifest?.coverage ?? {})) {
    counts.set(language, entry?.plans ?? 0);
  }
  return counts;
};

/**
 * Everything the dataset claims, as `Map<language, { plans, rules, withBody }>`
 * — every key `build-content.mjs` writes into a coverage entry, held to that by
 * a test that reads the shipped manifest.
 *
 * The whole of a manifest entry that a rebuild can shrink, not the one field
 * the first version of this guard happened to look at. A manifest written
 * before a dimension existed reads as 0 there rather than as a hole, so the
 * first build after the dimension is added cannot be called a regression and
 * every build after it can.
 */
export const dimensionsIn = (manifest) => {
  const counts = new Map();
  for (const [language, entry] of Object.entries(manifest?.coverage ?? {})) {
    counts.set(language, dimensionsOf(entry));
  }
  return counts;
};

/**
 * The dataset against the languages the package declares.
 *
 * @param declared  `LANGUAGES` from `@leela/content` — the promise.
 * @param coverage  `Map<language, { plans, rules, withBody }>` from the
 *   manifest — though only `plans` is read here, since this asks a different
 *   question than the regression guard does. A bare
 *   plan count is still read, so a caller that counted plans itself keeps
 *   working.
 * @param total     Plans a complete language has. 72, from the engine.
 */
export function checkCoverage(declared, coverage, total) {
  const problems = [];

  if (coverage.size === 0) {
    // Said first and on its own: every other message below would be a
    // repetition of this one, 22 times over.
    return ['the dataset covers no languages at all'];
  }

  for (const language of declared) {
    if (!coverage.has(language)) {
      problems.push(`${language} is declared in LANGUAGES and absent from the dataset`);
      continue;
    }
    const { plans } = dimensionsOf(coverage.get(language));
    if (plans !== total) {
      problems.push(`${language}: ${plans} plans in the dataset, ${total} expected`);
    }
  }

  for (const language of coverage.keys()) {
    if (!declared.includes(language)) {
      problems.push(`${language} is in the dataset and not in LANGUAGES`);
    }
  }

  return problems;
}

/**
 * What a rebuild would take away.
 *
 * The generator reads several donor repositories and keeps the best copy of
 * each language it finds. A source directory that is incomplete — mis-typed,
 * half-cloned, empty — therefore produces a smaller dataset rather than an
 * error, and overwrites a good one with it.
 *
 * Losing ground is the signal. Gaining is not: a new language, or a language
 * that gained the plans it was missing, is the generator working.
 *
 * Every dimension in `TRACKED` is compared with that same asymmetry, and the
 * message names which one shrank. It said "plans" for a year while the thing
 * the original accident emptied first was `rules.json`, and then it said
 * "plans" and "rules" while a build could still empty the text of every page in
 * every language and read as no loss at all — see the note at the top of this
 * file for what is measured about each of those holes and what is assumed.
 */
export function checkRegression(before, after) {
  const problems = [];

  for (const [language, was] of before) {
    if (!after.has(language)) {
      problems.push(`${language} would be dropped: the dataset has it and this build found none`);
      continue;
    }
    const had = dimensionsOf(was);
    const has = dimensionsOf(after.get(language));
    for (const dimension of TRACKED) {
      if (has[dimension] < had[dimension]) {
        const lost = had[dimension] - has[dimension];
        problems.push(
          `${language} would lose ${lost} ${dimension} (${had[dimension]} → ${has[dimension]})`,
        );
      }
    }
  }

  return problems;
}
