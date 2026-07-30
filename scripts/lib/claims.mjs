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

/**
 * Which workspaces a Dockerfile copies a manifest for.
 *
 * The list is written by hand — Docker cannot glob a path and keep it — and a
 * package added without a line here fails the image build with "Workspace
 * dependency not found". That happened the first time a ninth package was
 * added, and the CI job caught it, which is the good version of this story. The
 * cheap version is checking the list.
 */
export const copiedManifests = (dockerfile) => {
  const copied = new Set();
  for (const [, path] of dockerfile.matchAll(/^COPY\s+((?:packages|apps)\/[\w-]+)\/package\.json/gm)) {
    copied.add(path);
  }
  return copied;
};

/** Workspaces the image installs for, against the ones that exist. */
export function checkManifests(copied, workspaces) {
  const problems = [];

  for (const workspace of workspaces) {
    if (!copied.has(workspace)) {
      problems.push(`${workspace} has a package.json the Dockerfile does not copy`);
    }
  }

  for (const path of copied) {
    if (!workspaces.has(path)) {
      problems.push(`the Dockerfile copies ${path}/package.json, which does not exist`);
    }
  }

  return problems;
}
