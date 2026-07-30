/**
 * Whether a script can be started by the runtime it says to use.
 *
 * `scripts/audit-copies.mjs` — the check that reads eighteen copies of the
 * board across the source repositories, and found the one that was a hundred
 * squares of Snakes and Ladders — has not run under `node` for some time. It
 * imports the engine's TypeScript source, and the engine imports `./board`
 * without an extension, which Node cannot resolve. README told a person to run
 * `node scripts/audit-copies.mjs`, and that command dies in the loader.
 *
 * That is the same defect this repository keeps finding in a new place: a check
 * that reads as available and is not. An absent audit looks exactly like a
 * passing one.
 *
 * Checked statically rather than by running the scripts, because running them
 * is not free: `board-overlay.mjs` writes a file named after whatever argument
 * it is handed, and `build-content.mjs` rebuilds 22 languages. A smoke test
 * with side effects is a test people turn off.
 */

/** The runtime a script's shebang names, or null if it has none. */
export const runtimeOf = (text) => {
  const match = text.match(/^#!\s*\/usr\/bin\/env\s+(\w+)/);
  return match?.[1] ?? null;
};

/**
 * The same source without the lines that are only a comment.
 *
 * Written after the first version of this check reported two scripts as broken
 * over the string `'./x'` in a doc comment explaining the rule — this file's
 * own prose was the worked example. A scanner that reads prose as code
 * over-reports exactly as readily as one that misses an import under-reports.
 *
 * Line-based on purpose. The obvious fix — a character scanner tracking quotes
 * — was written first and was wrong too: a regex literal like `/['"]/` opens a
 * string that never closes, and everything after it, comments included, reads
 * as code. Dropping whole comment lines needs no lexer to be right.
 */
export function withoutCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .join('\n');
}

/** Every relative specifier a module imports or re-exports. */
export const relativeImports = (text) => {
  const found = [];
  // `from './x'` covers imports and re-exports; a bare `import './x'` does not
  // go through `from` and is the one a narrower regex would miss.
  for (const [, viaFrom, bare] of withoutCommentLines(text).matchAll(
    /\bfrom\s*['"](\.[^'"]*)['"]|^\s*import\s*['"](\.[^'"]*)['"]/gm,
  )) {
    const specifier = viaFrom ?? bare;
    if (specifier) found.push(specifier);
  }
  return found;
};

/**
 * Whether Node can resolve a relative specifier as written.
 *
 * Node has no extension search: `./board` is a file called `board`, and it is
 * not there. A bundler, `bun`, and `tsc` all guess; Node does not, and the
 * error arrives at the loader rather than anywhere near the code.
 */
export const resolvableByNode = (specifier) =>
  /\.(m?js|cjs|ts|tsx|mts|cts|json|node)$/.test(specifier);

/**
 * Every import Node could not follow, starting from one entry file.
 *
 * The walk is the point: `board-overlay.mjs` imports `board.ts` directly and
 * runs today only because that file happens to import nothing. The day it
 * imports a neighbour without an extension, the script breaks in the loader
 * and nothing about the script itself has changed.
 *
 * @param read  `(path) => string | null`. Injected so the rule can be asserted
 *              against a made-up tree rather than against this repository,
 *              which would be a test that passes until someone edits a file.
 */
export function findNodeBlockers(entry, read) {
  const blockers = [];
  const seen = new Set();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.shift();
    if (!file || seen.has(file)) continue;
    seen.add(file);

    const text = read(file);
    if (text === null || text === undefined) continue;

    const from = file.slice(0, file.lastIndexOf('/') + 1);

    for (const specifier of relativeImports(text)) {
      // `./x` and `../x` only; a specifier is relative to the importer.
      const target = normalise(from + specifier);

      if (!resolvableByNode(specifier)) {
        blockers.push({ file, specifier });
        // Keep walking anyway, guessing the extension a bundler would: one
        // unresolvable import should not hide the twenty behind it.
        queue.push(`${target}.ts`);
        continue;
      }

      queue.push(target);
    }
  }

  return blockers;
}

/** Collapse `a/b/../c` and `./` so two spellings of one path are one path. */
function normalise(path) {
  const parts = [];
  for (const part of path.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return (path.startsWith('/') ? '/' : '') + parts.join('/');
}

/**
 * Which runtimes the documentation tells a reader to use, per script.
 *
 * Two directions of wrong, and this repository had one of each: README said
 * `node scripts/audit-copies.mjs`, which dies, and `bun scripts/board-overlay.mjs`
 * for a script that runs perfectly well under Node. A list of commands kept by
 * hand goes stale in both directions at once.
 */
export const documentedRuntimes = (markdown) => {
  const runtimes = new Map();
  for (const [, runtime, script] of markdown.matchAll(
    /\b(node|bun|bunx|npx)\s+(scripts\/[\w-]+\.mjs)/g,
  )) {
    if (!script || !runtime) continue;
    const named = runtimes.get(script) ?? new Set();
    named.add(runtime);
    runtimes.set(script, named);
  }
  return runtimes;
};

/**
 * Everything wrong with the runtimes.
 *
 * @param declared   `Map<path, {runtime, blockers}>` — what each script says
 *                   about itself, and what stops it saying it truthfully.
 * @param documented `Map<path, Set<runtime>>` — what the docs tell a reader.
 */
export function checkRuntimes(declared, documented) {
  const problems = [];

  for (const [path, { runtime, blockers }] of declared) {
    if (!runtime) {
      problems.push(`${path}: no shebang, so nothing says how to run it`);
    } else if (runtime === 'node' && blockers.length > 0) {
      const [first] = blockers;
      problems.push(
        `${path}: says node and cannot run under it — ${first.file} imports '${first.specifier}' with no extension`,
      );
    }

    for (const named of documented.get(path) ?? []) {
      if (runtime && named !== runtime) {
        problems.push(`${path}: documented as \`${named} ${path}\`, but it declares ${runtime}`);
      }
    }
  }

  for (const path of documented.keys()) {
    if (!declared.has(path)) {
      problems.push(`the docs tell a reader to run ${path}, which is not there`);
    }
  }

  return problems;
}

/**
 * What a script says it needs before it can run.
 *
 * `audit-copies.mjs` needs the donor clones and `audit-deployment.mjs` needs
 * four public RPC endpoints — neither exists in CI, so neither can be a job.
 * That exemption belongs in the file with the reason attached, rather than as
 * an absence somewhere else that reads as an oversight.
 */
export const needsOf = (text) => text.match(/^\s*\*\s*Needs:\s*(.+)$/m)?.[1]?.trim() ?? null;

/**
 * Which audits the workflow runs.
 *
 * An audit that exists and is never run is this repository's oldest defect
 * wearing a new hat: `audit-copies.mjs` sat broken for passes because it could
 * not be in CI, and nothing said so out loud.
 */
export const auditsRunByCi = (workflow) =>
  new Set([...workflow.matchAll(/(?:node|bun)\s+(scripts\/[\w-]+\.mjs)/g)].map(([, path]) => path));

/** Audits that are neither run by CI nor excused by their own header. */
export function checkAuditsRun(audits, runByCi) {
  const problems = [];

  for (const [path, needs] of audits) {
    if (runByCi.has(path)) {
      if (needs) {
        // The other direction: a job that runs a script the script says cannot
        // run there is a job that passes by not looking.
        problems.push(`${path}: CI runs it, but it says it needs ${needs}`);
      }
      continue;
    }
    if (!needs) {
      problems.push(`${path}: nothing runs it and it does not say what it needs`);
    }
  }

  return problems;
}
