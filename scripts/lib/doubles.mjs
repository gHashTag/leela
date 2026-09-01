/**
 * Bounds declared twice.
 *
 * `MAX_REPORT_CHARS` and `MAX_REPORTS` were declared in the format and again in
 * the mini app, with the same two numbers. `MAX_INTENTION_CHARS` was declared
 * three times — a validator, a file reader, a prompt builder: three jobs, one
 * number. `MAX_MESSAGE_CHARS` twice inside one app, and the second declaration
 * had a comment beside it observing that the first one existed.
 *
 * That is how every one of them started. Somebody needs the number, finds that
 * it is already written down somewhere they cannot easily import from, and
 * writes it down again. The copies agree on the day they are made, which is the
 * whole problem: nothing goes wrong until one of them is changed, and then the
 * app accepts a report the file refuses and neither says a word.
 *
 * Names rather than values, deliberately. Two constants that happen to be 500
 * are not a duplicate; two constants called `MAX_REPORTS` are one idea, and if
 * they hold *different* values that is worse than if they agree.
 */

/**
 * `const NAME = value;` — the shape a bound is written in, exported or not.
 *
 * Private ones count. `@leela/journal` held its own `TOTAL_PLANS`, unexported,
 * beside the engine's — one board counted twice, and invisible to a check that
 * only looked at what a module lets out. A copy nobody can import is still a
 * copy that stops agreeing.
 */
const DECLARATION = /^(?:export )?const ([A-Z][A-Z0-9_]*)\s*(?::[^=]+)?=\s*(.+?);\s*$/gm;

/** A name that is exported from somewhere else rather than declared again. */
const REEXPORT = /^export \{[^}]*\b([A-Z][A-Z0-9_]*)\b[^}]*\}/gm;

export function declarationsIn(source, file) {
  const found = [];

  const reexported = new Set();
  for (const match of source.matchAll(REEXPORT)) reexported.add(match[1]);

  for (const match of source.matchAll(DECLARATION)) {
    const [, name, value] = match;
    // A re-export is the opposite of a copy: it is one declaration, said twice
    // so that callers of either module can reach it.
    if (reexported.has(name)) continue;
    found.push({ name, value: value.trim(), file });
  }

  return found;
}

/** Names declared in more than one file. */
export function doubled(declarations) {
  const byName = new Map();

  for (const declaration of declarations) {
    const seen = byName.get(declaration.name) ?? [];
    seen.push(declaration);
    byName.set(declaration.name, seen);
  }

  return [...byName.entries()]
    .filter(([, seen]) => seen.length > 1)
    .map(([name, seen]) => ({
      name,
      where: seen,
      /** Worse than agreeing: one idea, two answers, and nobody told. */
      disagreeing: new Set(seen.map((one) => one.value)).size > 1,
    }));
}

/**
 * The same function written twice, whatever it was called each time.
 *
 * `doubled` above compares *names*, and says why: two constants that happen to
 * be 500 are not a duplicate. A function body is the other way round. Nobody
 * writes forty identical characters of logic by coincidence, and the copy is
 * usually made under a different name — which is exactly what makes it
 * invisible to a check that reads names.
 *
 * Both of the ones this found were made while *removing* a duplication.
 * `within`, the clock the phone's two stores share, was copied word for word
 * into the second of them. `directionFromStatus` in `packages/db` and
 * `directionOf` in `packages/engine` were the same switch under two names,
 * left behind when the rule moved and called by nothing afterwards — dead in
 * one file and live in the other, seen by neither audit: `audit-unread` reads
 * exports and fields, and a private function is neither.
 *
 * Comments and whitespace are stripped, so two copies that were commented
 * differently are still one copy. Short bodies are not reported: a one-line
 * getter is a shape, not an idea, and a check that flags them is a check
 * somebody turns off.
 */

/** Shortest body worth calling a copy. Below this it is a shape, not an idea. */
export const A_FUNCTION = 80;

/** Every top-level function in a source, with its body stripped to substance. */
export function functionsIn(source, file) {
  const found = [];

  for (const match of source.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(/g)) {
    const opens = source.indexOf('{', (match.index ?? 0) + match[0].length);
    if (opens === -1) continue;

    let depth = 0;
    let at = opens;
    for (; at < source.length; at += 1) {
      if (source[at] === '{') depth += 1;
      if (source[at] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    const body = source
      .slice(opens, at + 1)
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (body.length >= A_FUNCTION) found.push({ name: match[1], file, body });
  }

  return found;
}

/** Bodies written in more than one file, under whatever names. */
export function repeated(functions) {
  const byBody = new Map();

  for (const one of functions) {
    const seen = byBody.get(one.body) ?? [];
    seen.push(one);
    byBody.set(one.body, seen);
  }

  return [...byBody.values()]
    .filter((seen) => new Set(seen.map((one) => one.file)).size > 1)
    .map((seen) => ({
      names: [...new Set(seen.map((one) => one.name))],
      where: seen,
      /** Two names for one body: the copy a name-based check cannot see. */
      renamed: new Set(seen.map((one) => one.name)).size > 1,
    }));
}
