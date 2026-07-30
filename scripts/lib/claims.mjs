/**
 * The numbers this repository says about itself.
 *
 * `README.md` carries a table of per-package test counts and a total, and both
 * have been maintained by hand for forty passes. A number kept by hand is a
 * number that will eventually be wrong, and the two passes before this one were
 * both about a confident sentence that had never been checked.
 *
 * The parsing and the comparing are here, away from anything that runs a test
 * suite, so the rules can be asserted without one.
 */

/** A claim the README makes about a package. */
export const claimedCounts = (readme) => {
  const counts = new Map();
  // `| `@leela/engine` | 202 | rules, four variants… |`
  for (const [, name, count] of readme.matchAll(/^\|\s*`(@leela\/[\w-]+)`\s*\|\s*(\d+)\s*\|/gm)) {
    counts.set(name, Number(count));
  }
  return counts;
};

/** The total the README states in prose: "1135 tests, run on every push". */
export const claimedTotal = (readme) => {
  const match = readme.match(/^(\d[\d,]*) tests, run on every push/m);
  return match ? Number(match[1].replace(/,/g, '')) : null;
};

/**
 * Everything wrong with the numbers.
 *
 * Three kinds, and the third is the one a person would not notice: a package
 * that runs tests and is not in the table at all. A table that is *correct
 * about what it lists* can still be a table that leaves things out.
 */
export function checkCounts(claimed, actual) {
  const problems = [];

  for (const [name, count] of actual) {
    if (!claimed.has(name)) {
      problems.push(`${name} runs ${count} tests and is not in the table`);
      continue;
    }
    const said = claimed.get(name);
    if (said !== count) {
      problems.push(`${name}: the table says ${said}, the suite runs ${count}`);
    }
  }

  for (const name of claimed.keys()) {
    if (!actual.has(name)) {
      problems.push(`${name} is in the table and ran nothing`);
    }
  }

  return problems;
}

/**
 * Whether the stated total is the sum of the table.
 *
 * Checked against the *sum* rather than against the suites: a total that agrees
 * with the suites but not with the table above it is still two numbers in one
 * document disagreeing, and a reader adds the column.
 */
export function checkTotal(claimed, total) {
  const sum = [...claimed.values()].reduce((a, b) => a + b, 0);

  if (total === null) return ['the README states no total'];
  if (total !== sum) return [`the total says ${total}, the table adds up to ${sum}`];
  return [];
}
