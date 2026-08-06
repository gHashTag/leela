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
 * A `#` that begins a comment, and one that does not.
 *
 * `withoutCommentLines` above is the same idea for JavaScript, and the
 * paragraph on it records the lesson: a character scanner tracking quotes was
 * written first and was wrong, so whole comment lines were dropped instead.
 * That fix cannot be borrowed here, because a YAML comment is not always a
 * whole line — `- run: node scripts/audit-doubles.mjs  # disabled for now` is a
 * trailing one — and because the hash it turns on is also an ordinary
 * character inside `echo "::group::x"` or `sed 's/#//'`.
 *
 * So a scanner, but a narrower one than the one that failed: a `#` opens a
 * comment only when it is outside quotes AND starts a token (line start, or
 * after a space or tab). YAML says the same thing — `a#b` is the scalar `a#b`
 * — and so does every shell, which is why one function serves both this file's
 * YAML lines and the shell inside a `run:` block. A single-quoted YAML string
 * escapes its quote by doubling it, and the scanner reads `''` as a close
 * followed by an open, which lands on the same answer.
 */
function withoutHashComment(line) {
  let quote = null;

  for (let at = 0; at < line.length; at += 1) {
    const char = line[at];

    if (quote !== null) {
      if (char === '\\' && quote === '"') at += 1;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === "'" || char === '"') quote = char;
    else if (char === '#' && (at === 0 || line[at - 1] === ' ' || line[at - 1] === '\t')) {
      return line.slice(0, at);
    }
  }

  return line;
}

/** The column of the first character that is not a space. */
const indentOf = (line) => line.length - line.trimStart().length;

/** A line holding nothing a reader would call content. */
const isBlank = (line) => withoutHashComment(line).trim() === '';

/** The next line with something on it, or the end. */
function nextMeaningful(lines, from) {
  let at = from;
  while (at < lines.length && isBlank(lines[at])) at += 1;
  return at;
}

/** `|`, `>`, `|-`, `>+2` — a value whose text is the indented block below it. */
const BLOCK_SCALAR = /^[|>][+-]?\d*$/;

/** `key:`, `key: value` — and never a key made out of the value's own colons. */
const KEY = /^([^\s:][^:]*):(?:\s+(.*))?$/;

/** A sequence item: a dash that is the whole token, not the sign of a number. */
const ITEM = /^-(\s|$)/;

/** A mapping, a sequence, or a scalar — whichever starts at `from`. */
function readNode(lines, from, minIndent) {
  const at = nextMeaningful(lines, from);
  if (at >= lines.length) return { value: null, next: at };

  const line = withoutHashComment(lines[at]);
  const indent = indentOf(line);
  if (indent < minIndent) return { value: null, next: at };

  return ITEM.test(line.trim())
    ? readSequence(lines, at, indent)
    : readMapping(lines, at, indent);
}

/**
 * The items of a sequence, each read as an ordinary node.
 *
 * The dash is replaced by a space rather than sliced off, so the columns do not
 * move: a key written on the dash's own line (`- run: x`) then sits at exactly
 * the indentation its siblings below it use, and the mapping reader needs to
 * know nothing about sequences at all.
 */
function readSequence(lines, from, indent) {
  const items = [];
  let at = from;

  for (;;) {
    at = nextMeaningful(lines, at);
    if (at >= lines.length) break;

    const line = withoutHashComment(lines[at]);
    if (indentOf(line) !== indent || !ITEM.test(line.trim())) break;

    const undashed = lines.slice();
    undashed[at] = `${line.slice(0, indent)} ${line.slice(indent + 1)}`;

    const { value, next } = readNode(undashed, at, indent + 1);
    items.push(value);
    at = next > at ? next : at + 1;
  }

  return { value: items, next: at };
}

/**
 * The keys of a mapping at one indentation.
 *
 * A line at this indentation that is not a key is skipped rather than treated
 * as the end of the mapping. Stopping would be the dangerous direction: the
 * steps after an unrecognised line would vanish, and an audit that CI runs
 * would be reported as unrun — a check that cries wolf on a correct workflow is
 * one somebody deletes rather than obeys.
 */
function readMapping(lines, from, indent) {
  const mapping = {};
  let at = from;

  while (at < lines.length) {
    at = nextMeaningful(lines, at);
    if (at >= lines.length) break;

    const line = withoutHashComment(lines[at]);
    const here = indentOf(line);

    if (here < indent) break;
    if (ITEM.test(line.trim()) && here <= indent) break;
    if (here > indent) {
      at += 1;
      continue;
    }

    const key = KEY.exec(line.trim());
    if (key === null) {
      at += 1;
      continue;
    }

    const [, name, written = ''] = key;

    if (BLOCK_SCALAR.test(written.trim())) {
      const [text, next] = readBlockScalar(lines, at + 1, indent);
      mapping[name] = text;
      at = next;
      continue;
    }

    if (written.trim() !== '') {
      mapping[name] = written.trim();
      at += 1;
      continue;
    }

    // An empty value is a nested block. A sequence may sit at its parent's own
    // indentation — `steps:` with the dashes in the same column is legal and
    // common — so the child's indentation decides, not a fixed step of two.
    const child = nextMeaningful(lines, at + 1);
    const text = child < lines.length ? withoutHashComment(lines[child]) : '';
    const childIndent = indentOf(text);
    const nested =
      child < lines.length &&
      (childIndent > indent || (childIndent === indent && ITEM.test(text.trim())));

    if (!nested) {
      mapping[name] = null;
      at += 1;
      continue;
    }

    const { value, next } = readNode(lines, child, childIndent);
    mapping[name] = value;
    at = next > at ? next : at + 1;
  }

  return { value: mapping, next: at };
}

/**
 * The text under a `|` or `>`.
 *
 * Taken raw, with its hashes left in place: inside a block scalar YAML has no
 * comments, and what is in there is shell. The shell's own comment rule is
 * applied later, where the text is read as commands, so a `#` is judged once by
 * the language that owns it.
 */
function readBlockScalar(lines, from, indent) {
  const body = [];
  let at = from;

  while (at < lines.length) {
    const line = lines[at];
    if (line.trim() === '') {
      body.push('');
      at += 1;
      continue;
    }
    if (indentOf(line) <= indent) break;
    body.push(line);
    at += 1;
  }

  return [body.join('\n'), at];
}

/** A scalar with YAML's quoting taken off, because the runner never sees it. */
function scalarOf(value) {
  const text = String(value).trim();
  const quoted = /^'([\s\S]*)'$|^"([\s\S]*)"$/.exec(text);
  return quoted === null ? text : (quoted[1] ?? quoted[2] ?? '');
}

/**
 * What a workflow value says once YAML and `${{ }}` are out of the way.
 *
 * The two layers are peeled in that order and only that order, because they
 * disagree: `if: 'false'` is the string `false` handed to the expression
 * engine, which evaluates it as the boolean and skips the step, while
 * `if: ${{ 'false' }}` is a string literal *inside* the expression, and a
 * non-empty string is true. The quotes that vanish are YAML's; the quotes that
 * survive belong to the expression.
 */
function literalOf(value) {
  const yaml = scalarOf(value);
  const expression = /^\$\{\{([\s\S]*)\}\}$/.exec(yaml);
  return (expression === null ? yaml : expression[1]).trim().toLowerCase();
}

/** Values GitHub reads as false without evaluating anything. */
const FALSEY = new Set(['false', '0', 'null', '~', '']);

/** An `if:` that cannot be true, whatever the run. */
const alwaysSkipped = (value) =>
  value !== undefined && value !== null && FALSEY.has(literalOf(value));

/** A `continue-on-error:` that takes the step's failure away from the job. */
const failureIgnored = (value) =>
  value !== undefined && value !== null && literalOf(value) === 'true';

/** Every step in the file, with the job whose `if:` also governs it. */
function* stepsOf(node, parent = null) {
  if (Array.isArray(node)) {
    for (const item of node) yield* stepsOf(item, parent);
    return;
  }
  if (node === null || typeof node !== 'object') return;

  if (Array.isArray(node.steps)) {
    for (const step of node.steps) {
      if (step !== null && typeof step === 'object') yield { step, job: node };
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (key !== 'steps') yield* stepsOf(value, node);
  }
}

/**
 * Every step of a workflow that can actually fail the job, with its `run:`
 * already read as shell.
 *
 * Exported, and that is the whole point of it. The reader below asks one
 * question of a workflow — *is this text going to be executed* — and it was
 * answered here properly once: a step behind a `#`, behind `if: false`, behind
 * a job's `if: false`, or with its failure waived by `continue-on-error`, is not
 * running whatever is written in it. Meanwhile `scripts/lib/claims.mjs` asked
 * the same question of the same two files with `workflow.matchAll(...)` over the
 * raw text, and so answered it the old, wrong way. MEASURED on 2026-08-06, with
 * nothing edited on disk: `packagesCheckedByCi` returned three `for pkg in`
 * loops for `.github/workflows/ci.yml`, and returned three again when every one
 * of those three lines was prefixed with `#`. The fix that closed this in this
 * file was simply never carried across, because there was nothing to carry — the
 * machinery was not exported.
 *
 * So it is exported rather than copied. The header of this module says a second
 * parser for one thing is the defect the module is about, and a second *rule*
 * for one thing is the same defect a level down.
 *
 * @param workflow The file, as written.
 * @yields `{ step, job, run }` — the step's mapping, the job's mapping (for
 *         callers that want more of it), and the text of `run:` with the
 *         shell's own comments taken off, or `null` when the step has no `run:`
 *         at all. The comment-stripping is done here and not by each caller for
 *         the reason above: `# node scripts/x.mjs` and `# for pkg in …` are the
 *         same line to a runner, and they should be the same line to us.
 */
export function* liveStepsOf(workflow) {
  const lines = workflow.split('\n').map((line) => line.replace(/\r$/, ''));
  const { value } = readNode(lines, 0, 0);

  for (const { step, job } of stepsOf(value)) {
    if (alwaysSkipped(job?.if) || alwaysSkipped(step.if)) continue;
    if (failureIgnored(step['continue-on-error'])) continue;

    const run =
      typeof step.run === 'string'
        ? step.run.split('\n').map(withoutHashComment).join('\n')
        : null;

    yield { step, job, run };
  }
}

/**
 * Which audits the workflow runs.
 *
 * An audit that exists and is never run is this repository's oldest defect
 * wearing a new hat: `audit-copies.mjs` sat broken for passes because it could
 * not be in CI, and nothing said so out loud. `audit-scripts.mjs` is the check
 * that says it out loud, and this function is the half of it that reads CI —
 * so whatever this function cannot see, twenty audits are unsupervised in.
 *
 * It used to read the workflow as text: one `matchAll` for `node scripts/x.mjs`
 * anywhere in the file. Every way of writing a step that does not run it looked
 * identical to a step that does. MEASURED, on this repository, before this was
 * rewritten: commenting out `- run: node scripts/audit-doubles.mjs` in
 * `.github/workflows/ci.yml` left `node scripts/audit-scripts.mjs` printing
 * "the docs agree" and exiting 0. A YAML comment starts with `#`, and
 * `withoutCommentLines` — written in this same file for exactly this class of
 * mistake — knows about `*`, `//` and `/*` and was never applied here anyway.
 * `if: false` and `continue-on-error: true` read as running for the same
 * reason.
 *
 * **The right tool is not this.** A YAML parser (`yaml`, `js-yaml`) or
 * `actionlint`, which exists precisely to answer questions about workflow
 * files, would replace all of the reader below. MEASURED on 2026-08-06:
 * `node_modules` holds neither `yaml` nor `js-yaml`, this repository's
 * devDependencies are `typescript` and `vitest` and nothing else, and
 * `actionlint` is a Go binary that is not on this machine and cannot be
 * installed in a sitting that must not reach the network. So the reader is
 * hand-rolled by necessity rather than by preference, and it is kept small and
 * structural so that adopting a real parser later is a deletion: everything
 * below `withoutHashComment` becomes `parse(workflow)` and the rules survive.
 *
 * What it promises: the block structure of these two workflow files — mappings,
 * sequences, plain and quoted scalars, `|` and `>` blocks, comments whole and
 * trailing — and one question asked of every step, *can this step fail the
 * job*. A step cannot when its own `if:` or its job's is a falsey literal, or
 * when `continue-on-error:` is true; a step that cannot fail the job is not
 * running the audit, whatever text is in it. That question is `liveStepsOf`
 * above, exported because `claims.mjs` needed to ask it of the same two files
 * and was answering it with a text search instead.
 *
 * What it does not promise: anchors, aliases, multi-document files, flow
 * mappings, multi-line plain scalars, and `%YAML` directives — none appear in
 * `.github/workflows`, and each would be a reason to reach for the real parser
 * rather than to grow this one. Nor does it read shell: the text of a `run:` is
 * searched for `node scripts/x.mjs`, so a path inside `echo "..."` counts, and
 * `packages/engine/tests/runnable.test.ts` records that as measured rather than
 * as an oversight. Teaching it to skip quoted shell arguments would also skip
 * `bash -c "node scripts/audit-x.mjs"`, which runs. It does not evaluate
 * expressions either:
 * `if: ${{ github.event_name == 'push' }}` is counted as running, because a
 * step that runs on some events runs, and guessing the other way would fail a
 * correct workflow. Where it is unsure it counts the audit as run — the
 * direction that leaves the old blindness rather than inventing a new alarm.
 */
export const auditsRunByCi = (workflow) => {
  const found = new Set();

  for (const { run } of liveStepsOf(workflow)) {
    if (run === null) continue;
    for (const [, path] of run.matchAll(/(?:node|bun)\s+(scripts\/[\w-]+\.mjs)/g)) {
      found.add(path);
    }
  }

  return found;
};

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
