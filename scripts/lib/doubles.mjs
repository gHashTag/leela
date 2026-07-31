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

/** `export const NAME = value;` — the shape a bound is written in. */
const DECLARATION = /^export const ([A-Z][A-Z0-9_]*)\s*(?::[^=]+)?=\s*(.+?);\s*$/gm;

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
