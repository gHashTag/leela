/**
 * Finding fields that are written and never read.
 *
 * Three passes in a row turned one of these up by hand: `Reply.broadcast`,
 * `RuleSet.rerollOnRepeat`, `players.needs_report`. Each was declared, set
 * everywhere it should be, documented — and consulted by nothing. Each looked
 * complete in review, and a type system has no opinion about it.
 *
 * So: stop finding them by hand. The parsing is deliberately simple and errs
 * towards silence, because a checker that cries wolf gets switched off.
 */

/**
 * A field declared on an interface or a Drizzle table.
 *
 * Template literals are stripped first: a stylesheet held in a `.ts` file is
 * full of `gap: 3px` lines that look exactly like field declarations, and
 * reporting them taught nothing except to distrust the report.
 */
export function declaredFields(source, file) {
  const fields = [];
  source = stripTemplateLiterals(source);

  // `readonly name: type;` / `name?: type;` inside an interface or type.
  for (const match of source.matchAll(
    /^\s*(?:readonly\s+)?([a-z_][\w]*)\??\s*:\s*[^;{]+;/gim,
  )) {
    fields.push({ name: match[1], file, kind: 'interface' });
  }

  // `needsReport: boolean('needs_report')` — a Drizzle column.
  for (const match of source.matchAll(
    /^\s*([a-z_][\w]*)\s*:\s*(?:text|integer|boolean|timestamp|serial)\(/gim,
  )) {
    fields.push({ name: match[1], file, kind: 'column' });
  }

  return fields;
}

/** Blank out template literals, keeping line numbers intact. */
function stripTemplateLiterals(source) {
  return source.replace(/`(?:[^`\\]|\\.)*`/gs, (block) =>
    block.replace(/[^\n]/g, ' '),
  );
}

/**
 * Places a name appears that are not its own declaration.
 *
 * A field is "read" when something mentions it outside a declaration, an
 * object literal that sets it, or a comment. Setting a field is writing;
 * writing is what these three all did.
 */
export function readsOf(name, sources) {
  let reads = 0;

  // A single backslash in the source is what reaches the regex, so these are
  // written `\\w` in a template literal.
  const boundary = `(?<![\\w$])${name}(?![\\w$])`;
  const comment = /^\s*(\/\/|\*|\/\*)/;
  const write = new RegExp(`${boundary}\\s*:`, 'g');

  for (const source of sources) {
    for (const line of source.split('\n')) {
      if (!line.includes(name)) continue;
      if (comment.test(line)) continue;

      // Remove every `name:` first. That covers a declaration
      // (`broadcast: boolean;`), a column (`needsReport: boolean('...')`) and a
      // one-line literal (`{ text: 'x', broadcast: false }`) with one rule
      // instead of three — and it keeps the read in
      // `temperature: options.temperature ?? 0.7`, which the three separate
      // rules threw away by treating the whole line as a declaration.
      const withoutWrites = line.replace(write, '');
      if (new RegExp(boundary).test(withoutWrites)) reads++;
    }
  }

  return reads;
}

/**
 * Fields with no readers.
 *
 * @param declarations  From `declaredFields`, across the files that declare.
 * @param sources       Every source to search, including the declaring ones.
 * @param ignore        Names that are legitimately write-only.
 */
export function unreadFields(declarations, sources, ignore = []) {
  const skip = new Set(ignore);
  const seen = new Set();
  const unread = [];

  for (const field of declarations) {
    if (skip.has(field.name) || seen.has(field.name)) continue;
    seen.add(field.name);

    if (readsOf(field.name, sources) === 0) unread.push(field);
  }

  return unread.sort((a, b) => a.name.localeCompare(b.name));
}

// --- exports ----------------------------------------------------------------

/**
 * Functions and constants a module exports.
 *
 * The same question as `declaredFields`, asked of the public surface: which of
 * these has no caller. `hasWon` had none and was wrong — it called a player who
 * had never rolled a winner, and three copies of that rule existed with the
 * unused one broken.
 */
export function declaredExports(source, file) {
  const exports = [];
  const clean = stripTemplateLiterals(source);

  for (const match of clean.matchAll(
    /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm,
  )) {
    exports.push({ name: match[1], file, kind: 'function' });
  }

  for (const match of clean.matchAll(
    /^export\s+(?:const|class)\s+([A-Za-z_$][\w$]*)/gm,
  )) {
    exports.push({ name: match[1], file, kind: 'value' });
  }

  return exports;
}

/**
 * Mentions of a name that are not its declaration or its re-export.
 *
 * An `export { name } from './x'` is plumbing, not a use: a barrel file that
 * lists everything would otherwise make every export look consumed.
 */
export function usesOf(name, sources) {
  let uses = 0;

  const boundary = `(?<![\\w$])${name}(?![\\w$])`;
  const comment = /^\s*(\/\/|\*|\/\*)/;
  const declaration = new RegExp(
    `^export\\s+(?:async\\s+)?(?:function|const|class)\\s+${name}\\b`,
  );

  for (const source of sources) {
    // Import and export lists are plumbing; drop them before counting.
    const withoutPlumbing = source.replace(
      /^\s*(?:import|export)\s*(?:type\s*)?\{[^}]*\}[^\n]*$/gm,
      '',
    );

    for (const line of withoutPlumbing.split('\n')) {
      if (!line.includes(name)) continue;
      if (comment.test(line)) continue;
      if (declaration.test(line)) continue;
      if (new RegExp(boundary).test(line)) uses++;
    }
  }

  return uses;
}

/** Exports with no caller anywhere in the searched sources. */
export function uncalledExports(declarations, sources, ignore = []) {
  const skip = new Set(ignore);
  const seen = new Set();
  const uncalled = [];

  for (const item of declarations) {
    if (skip.has(item.name) || seen.has(item.name)) continue;
    seen.add(item.name);

    if (usesOf(item.name, sources) === 0) uncalled.push(item);
  }

  return uncalled.sort((a, b) => a.name.localeCompare(b.name));
}
