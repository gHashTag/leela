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
 * The public members of exported classes: methods and getters.
 *
 * The blind spot this closes was found twice, and the second time cost the
 * worst defect of its pass. `sqliteReportSink` had `record` and no `history`,
 * so a durable bot wrote every report into a database and told anybody who
 * asked that it kept nothing — and `audit-unread` could not see it, because
 * `reportsFor` is a method on a class rather than an export. Then
 * `DirectChannels.refusedCount`, an observable nothing observes.
 *
 * A class is exported and its members are not, so every one of them is invisible
 * to a check that reads `export`.
 *
 * Private members are skipped: `private x` and `#x` are the class saying it is
 * talking to itself, which is the one case where nobody else calling is the
 * point. Constructors are skipped for the same reason — `new X()` calls them.
 */
export function declaredMembers(source, file) {
  const members = [];
  const clean = stripTemplateLiterals(source);

  for (const opening of clean.matchAll(/^export\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm)) {
    const from = clean.indexOf('{', opening.index ?? 0);
    if (from < 0) continue;

    let depth = 0;
    let index = from;
    for (; index < clean.length; index += 1) {
      if (clean[index] === '{') depth += 1;
      if (clean[index] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    const body = clean.slice(from + 1, index);

    // One indent level in, which is where a member is written and where a
    // statement inside a method body is not.
    for (const member of body.matchAll(
      /^  (?:(private|protected)\s+)?(?:readonly\s+)?(?:static\s+)?(?:async\s+)?(get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*[(<]/gm,
    )) {
      const [, visibility, accessor, name] = member;
      if (visibility || name === 'constructor' || name.startsWith('#')) continue;
      members.push({ name, file, kind: accessor ? 'accessor' : 'method', owner: opening[1] });
    }
  }

  return members;
}

/**
 * Mentions of a name that are not its declaration or its re-export.
 *
 * An `export { name } from './x'` is plumbing, not a use: a barrel file that
 * lists everything would otherwise make every export look consumed.
 */
/**
 * A line with its string contents removed, and its code kept.
 *
 * Quote-aware rather than a regex: a line often carries several strings, and an
 * apostrophe inside a double-quoted one is not a quote.
 *
 * `${…}` inside a template literal is **code** and stays. The first version of
 * this dropped it, and three real callers vanished — `faceFor(value, FACES)`
 * lives inside `url("${…}")`, which is a string containing a call. Stripping
 * text and stripping code look the same from outside; the difference is which
 * exports get reported as dead.
 */
export function withoutStrings(line) {
  let out = '';
  let quote = null;
  let depth = 0;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (quote) {
      if (char === '\\') {
        i += 1;
        continue;
      }
      if (quote === '`' && char === '$' && line[i + 1] === '{') {
        // Out of the string and into an expression.
        depth += 1;
        quote = null;
        out += ' ';
        i += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
        out += char;
      }
      continue;
    }

    if (depth > 0 && char === '}') {
      depth -= 1;
      quote = '`';
      out += ' ';
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      out += char;
      continue;
    }

    out += char;
  }

  return out;
}

/**
 * Every name a re-export gives something else.
 *
 * `export { squareText as shareTextFor } from '@leela/journal'` is how the mini
 * app takes the journal's word for the format. Export lists are dropped as
 * plumbing before uses are counted — rightly, or a barrel file would make every
 * export look consumed — and the rename went with them, so `squareText` was
 * reported as having no caller while every one of its callers wrote
 * `shareTextFor`.
 *
 * That line has been printed on every run of this audit for twenty passes. A
 * check that always says one thing it cannot back up is a check people stop
 * reading, and the reason to fix it is not the export: it is the report.
 */
export function aliasesOf(name, sources) {
  const found = new Set();
  const renamed = new RegExp(`(?<![\\w$])${name}\\s+as\\s+([A-Za-z_$][\\w$]*)`, 'g');

  for (const source of sources) {
    // Across lines, because a list of six names is written down the page and
    // the rename sits in the middle of it. A per-line reader found nothing at
    // all, which looked exactly like there being nothing to find.
    for (const list of source.matchAll(/(?:import|export)\s*(?:type\s*)?\{([^}]*)\}/gs)) {
      for (const match of (list[1] ?? '').matchAll(renamed)) found.add(match[1]);
    }
  }

  return [...found];
}

export function usesOf(name, sources) {
  // Counted under every name it goes by. Renaming something on the way out is
  // not the same as nobody using it.
  const names = [name, ...aliasesOf(name, sources)];
  if (names.length > 1) {
    return names.reduce((total, one) => total + directUsesOf(one, sources), 0);
  }

  return directUsesOf(name, sources);
}

function directUsesOf(name, sources) {
  let uses = 0;

  const boundary = `(?<![\\w$])${name}(?![\\w$])`;
  const comment = /^\s*(\/\/|\*|\/\*)/;
  const declaration = new RegExp(
    `^export\\s+(?:async\\s+)?(?:function|const|class)\\s+${name}\\b`,
  );

  // A class member's own declaration, which reads exactly like a use of it and
  // was counted as one — so `DirectChannels.refusedCount`, whose only mention
  // anywhere is the line declaring it, came back as called once. A member is
  // always reached through something (`channels.refusedCount`), so a bare name
  // at one indent level, followed by a bracket, is the declaration and nothing
  // else.
  const member = new RegExp(
    `^  (?:private |protected |readonly |static |async |get |set )*${name}\\s*[(<]`,
  );

  for (const source of sources) {
    // Import and export lists are plumbing; drop them before counting.
    const withoutPlumbing = source.replace(
      /^\s*(?:import|export)\s*(?:type\s*)?\{[^}]*\}[^\n]*$/gm,
      '',
    );

    for (const raw of withoutPlumbing.split('\n')) {
      if (!raw.includes(name)) continue;
      if (comment.test(raw)) continue;
      if (declaration.test(raw)) continue;
      if (member.test(raw)) continue;

      // A name inside a string is not a call. `bot.command('board', …)`
      // registers a Telegram command that happens to share a name with an
      // export, and counted as a use of it — so `commands.board`, which
      // nothing in the bot calls, read as called. Every message key, every
      // command name and every slug is a chance for the same accident.
      const line = withoutStrings(raw);
      if (!line.includes(name)) continue;
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

/**
 * Names declared in more than one place, which this check cannot tell apart.
 *
 * Uses are counted by name across every source, so one live caller anywhere
 * covers every declaration of that name — and the second one can be dead
 * without a word. `writingsOn` was: the mini app calls its own, the phone app
 * had written one and no screen read it, and the audit said every export has a
 * caller.
 *
 * Telling them apart properly means resolving imports, which is a different
 * tool. Saying so is not: an ambiguity reported is a place to look, and this
 * audit has always been a prompt to look rather than a gate.
 */
export function ambiguousExports(declarations, ignore = []) {
  const skip = new Set(ignore);
  const byName = new Map();

  for (const item of declarations) {
    if (skip.has(item.name)) continue;
    byName.set(item.name, [...(byName.get(item.name) ?? []), item]);
  }

  return [...byName.entries()]
    .filter(([, items]) => new Set(items.map((item) => item.file)).size > 1)
    .map(([name, items]) => ({ name, files: [...new Set(items.map((item) => item.file))].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The workspace a file belongs to: `apps/mobile/src/journal.ts` -> `apps/mobile`. */
function packageOf(file) {
  const parts = file.split('/');
  return parts.slice(0, 2).join('/');
}

/**
 * Declarations of an ambiguous name that nothing in their own package calls.
 *
 * The report above says where to look. This is the looking, done mechanically:
 * when two packages export the same name, a caller in one of them proves
 * nothing about the other, so each is asked whether **its own package** uses
 * it.
 *
 * Applications only. A library exists to be used by somebody else —
 * `@leela/journal` calls almost nothing it exports, and that is what a format
 * is — while an application's own export is for that application, and one it
 * does not call is one it does not use. `apps/mobile` wrote a path and had a
 * `writingsOn` no screen read back; the mini app's `writingsOn` covered it.
 */
export function unusedInOwnPackage(declarations, files, sources, ignore = []) {
  const skip = new Set(ignore);
  const ambiguous = new Set(ambiguousExports(declarations, ignore).map((one) => one.name));
  const found = [];

  for (const item of declarations) {
    if (skip.has(item.name) || !ambiguous.has(item.name)) continue;
    if (!item.file.startsWith('apps/')) continue;

    const own = packageOf(item.file);
    const inside = sources.filter((_, index) => packageOf(files[index]) === own);

    if (usesOf(item.name, inside) === 0) found.push(item);
  }

  return found.sort((a, b) => a.name.localeCompare(b.name));
}
