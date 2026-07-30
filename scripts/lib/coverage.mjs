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
 */

/** Languages the dataset claims, as `Map<language, plans>`. */
export const coverageOf = (manifest) => {
  const counts = new Map();
  for (const [language, entry] of Object.entries(manifest?.coverage ?? {})) {
    counts.set(language, entry?.plans ?? 0);
  }
  return counts;
};

/**
 * The dataset against the languages the package declares.
 *
 * @param declared  `LANGUAGES` from `@leela/content` — the promise.
 * @param coverage  `Map<language, plans>` from the manifest.
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
    const plans = coverage.get(language);
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
 */
export function checkRegression(before, after) {
  const problems = [];

  for (const [language, plans] of before) {
    if (!after.has(language)) {
      problems.push(`${language} would be dropped: the dataset has it and this build found none`);
      continue;
    }
    const now = after.get(language) ?? 0;
    if (now < plans) {
      problems.push(`${language} would lose ${plans - now} plans (${plans} → ${now})`);
    }
  }

  return problems;
}
