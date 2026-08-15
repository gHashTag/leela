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

// The one list of where a workspace's source and its tests live. A second
// hand-kept copy of it is the sixth and seventh defect that file records.
import { workspacePackages } from './claims.mjs';

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

/**
 * Blank out template literals, keeping line numbers and offsets intact.
 *
 * Everything the audit knows about a file it knows from what this returns:
 * `declaredFields`, `declaredExports` and `declaredMembers` all read the
 * stripped copy and never the original. So this function decides what the audit
 * can see, and a version of it that loses its place does not report a defect —
 * it reports a smaller repository, in the same confident sentences.
 *
 * It was one regex, `/`(?:[^`\\]|\\.)*`/gs`, which is neither quote- nor
 * regex-aware. One backtick that is not a template delimiter desynchronises it,
 * and everything up to the next stray backtick is blanked.
 *
 * Measured on `apps/docs/src/render.ts:161`, a markdown renderer whose inline
 * pass reads `.replace(/`([^`]+)`/g, '<code>$1</code>')`. That line holds four
 * backticks inside a regex literal. The old reader took the first for the start
 * of a template: 18 top-level exports in the raw file, 10 after stripping.
 * `PageOptions`, `page`, `PLAY_URL`, `DOCS_URL`, `SITE_NAME`, `titleOf`,
 * `translations` and `summarise` all vanished, and so did the `PageOptions`
 * fields at :165-215, which dropped out of the unread-field check as well. The
 * audit then printed "Checked 568 exports" and "Every export has at least one
 * caller" about a set it had never seen: on one tree, measured with this
 * function and then with the old regex, the same run counted 583 against 572,
 * and 682 field declarations against 670. Six of the eight exports carry no
 * `PUBLIC_API` waiver, so a genuinely dead one there would never have been
 * named.
 *
 * All eight have callers today, so nothing was in fact hidden. The reason to
 * fix it is not the exports: it is the report. It is the same reason written
 * over `aliasesOf` below — a check that always says one thing it cannot back up
 * is a check people stop reading.
 *
 * The remedy was already 150 lines further down. `withoutStrings` is a
 * character scanner that tracks which quote it is inside and treats `${…}` as
 * code, and its doc-comment states the principle this one inherits: stripping
 * text and stripping code look the same from outside, and the difference is
 * which exports get reported as dead. This is that state machine widened to the
 * whole file, with comments and regex literals added, because the ambiguous `/`
 * is what put backticks somewhere a line reader could not expect them.
 *
 * A `/` opens a regex only where a value cannot precede it: at the start of a
 * line, after one of `( , = : [ ! & | ? { ;`, or after a keyword that is
 * followed by an expression. Anywhere else it is division. Getting this wrong
 * in the safe direction costs a line: an unterminated string or regex is
 * abandoned at the newline, because neither can span one in valid JavaScript.
 *
 * Note for later: `knip` would replace the uncalled-export half of
 * `audit-unread` outright, and is the better long-term move. It does not do the
 * write-only-field half, which uses this same parser, so this stands on its own
 * either way.
 */
export function stripTemplateLiterals(source) {
  const out = source.split('');

  // Newlines survive, so an index into the result is an index into the source
  // and line N is still line N.
  const blank = (index) => {
    if (out[index] !== undefined && out[index] !== '\n') out[index] = ' ';
  };

  // Where a `/` begins a regex rather than dividing. The empty string is the
  // start of a line, which is why `previous` is cleared on every newline.
  const openings = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', ';', '\n']);
  // ...and the keywords after which an expression, not a value, follows.
  const openingWords = new Set([
    'return',
    'typeof',
    'instanceof',
    'in',
    'of',
    'new',
    'delete',
    'do',
    'else',
    'case',
    'yield',
    'await',
    'void',
    'throw',
  ]);

  // A stack rather than a flag, because `${…}` can hold another template
  // literal. A `code` frame counts its own braces so it knows which `}` closes
  // the expression it lives in; a `template` frame is text and gets blanked.
  const frames = [{ kind: 'code', braces: 0, previous: '', word: '' }];
  // The leaf states, which cannot nest: a string holds no code, a comment holds
  // no string, a regex holds neither.
  let mode = null;
  let inClass = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    const frame = frames[frames.length - 1];

    if (frame.kind === 'template') {
      blank(i);

      if (char === '\\') {
        blank(i + 1);
        i += 1;
        continue;
      }
      if (char === '$' && next === '{') {
        blank(i + 1);
        i += 1;
        frames.push({ kind: 'code', braces: 0, previous: '', word: '' });
        continue;
      }
      if (char === '`') frames.pop();
      continue;
    }

    if (mode === 'line') {
      if (char === '\n') mode = null;
      continue;
    }

    if (mode === 'block') {
      if (char === '*' && next === '/') {
        mode = null;
        i += 1;
      }
      continue;
    }

    if (mode === "'" || mode === '"') {
      if (char === '\\') {
        // Which also covers a line continuation: the escaped newline is skipped
        // and the string carries on, as it does in the language.
        i += 1;
        continue;
      }
      // An unterminated quote is an apostrophe in prose the comment rules did
      // not catch. Ending it at the newline keeps the damage to one line
      // instead of to everything up to the next apostrophe in the file.
      if (char === mode || char === '\n') {
        mode = null;
        frame.previous = char === '\n' ? '' : ')';
        frame.word = '';
      }
      continue;
    }

    if (mode === 'regex') {
      if (char === '\\') {
        i += 1;
        continue;
      }
      if (char === '[') inClass = true;
      else if (char === ']') inClass = false;
      else if (char === '\n') {
        mode = null;
        frame.previous = '';
      } else if (char === '/' && !inClass) {
        mode = null;
        // A regex is a value, so the next `/` divides it.
        frame.previous = ')';
      }
      continue;
    }

    if (char === '/' && next === '/') {
      mode = 'line';
      i += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      mode = 'block';
      i += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      mode = char;
      continue;
    }
    if (char === '`') {
      blank(i);
      frames.push({ kind: 'template' });
      continue;
    }
    if (char === '/' && (openings.has(frame.previous) || openingWords.has(frame.word))) {
      mode = 'regex';
      inClass = false;
      continue;
    }

    if (char === '{') frame.braces += 1;
    if (char === '}') {
      if (frame.braces === 0 && frames.length > 1) {
        // The `}` that closes a `${…}`; it belongs to the template around it.
        blank(i);
        frames.pop();
        continue;
      }
      frame.braces -= 1;
    }

    if (/[A-Za-z0-9_$]/.test(char)) frame.word += char;
    else frame.word = '';

    if (char === '\n') frame.previous = '';
    else if (!/\s/.test(char)) frame.previous = char;
  }

  return out.join('');
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

  // The name written as the key of an object literal, at the head of its line.
  //
  // This is the hole through which the whole exports gate fell out. `SEARCH` in
  // `audit-unread.mjs` includes `'scripts'` and the walk reads `.mjs`, so the
  // audit script is one of the sources searched for callers — and its own
  // waiver lists are object literals written `  snakeAt: 'board helper for
  // consumers',`. `withoutStrings` blanks the reason and leaves `snakeAt:`
  // standing, and that counted as a use. Measured, against this tree: a name
  // mentioned in no source at all returned 0 uses, and the same name given one
  // source whose only line was `zzNothingCallsThis: 'a reason',` returned 1.
  // `usesOf('stepsFor', [audit-unread source])` returned 1, and the mention it
  // counted was that name's own `PUBLIC_MEMBERS` entry — whose comment says
  // nothing calls it. So writing the excuse was the act that stopped the audit
  // asking, for every name in `PUBLIC_API` and `PUBLIC_MEMBERS`, including one
  // whose only real caller is deleted tomorrow.
  //
  // The fields half of this file solved the same problem in `readsOf` and its
  // rule is not reusable here. `readsOf` strips every `NAME\s*:` anywhere on the
  // line, with a global regex. Copied into this function it cries wolf, and that
  // was measured too: `node scripts/audit-unread.mjs` went from exit 0 to exit 1
  // naming `ZAI_CODING_BASE_URL`, whose caller at `apps/bot/src/index.ts:89` is
  //     baseUrl: process.env.ZAI_PLAN === 'coding' ? ZAI_CODING_BASE_URL : undefined,
  // The unanchored rule matches the colon of the ternary's other arm and erases
  // a live use. In this repository a check that names an innocent gets deleted
  // rather than obeyed, so the rule is anchored: a key is a name at the START of
  // its line followed by a colon, and a name anywhere else on that line is an
  // expression. `{ paginate: paginate }` therefore still counts — the strip is
  // anchored and not global, so it removes the key and leaves the value — and so
  // does the shorthand `{ paginate }`, which has no colon to strip.
  //
  // Anchored and without the `g` flag on purpose. `readsOf`'s `write` carries
  // `g`, and `.test()` on a global regex advances `lastIndex` between calls, so
  // a rule shaped that way answers differently depending on what was asked
  // before it. `String.replace` on a non-global `^`-anchored regex has no state
  // to carry.
  const leadingKey = new RegExp(`^\\s*${name}\\s*:`);

  // A class member's own declaration, which reads exactly like a use of it and
  // was counted as one — so `DirectChannels.refusedCount`, whose only mention
  // anywhere is the line declaring it, came back as called once. A member is
  // always reached through something (`channels.refusedCount`), so a bare name
  // at one indent level, followed by a bracket, is the declaration and nothing
  // else.
  const member = new RegExp(
    `^  (?:private |protected |readonly |static |async |get |set )*${name}\\s*[(<]`,
  );

  // ...and a call written at the same indent reads exactly like that
  // declaration. `forgetIntention(localStorage, seated.id);` sits two spaces in
  // at the top of a function body, and the guard above erased it — so eight
  // exports with live callers were reported as having none, which is the kind
  // of standing false alarm this file has been burned by before. A declaration
  // opens a body or ends a signature; a call ends the statement. The semicolon
  // is what tells them apart, and when neither applies the line is counted as a
  // use: claiming code is dead when it is not costs more than the reverse.
  const statement = /;\s*$/;

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
      if (member.test(raw) && !statement.test(raw)) continue;

      // A name inside a string is not a call. `bot.command('board', …)`
      // registers a Telegram command that happens to share a name with an
      // export, and counted as a use of it — so `commands.board`, which
      // nothing in the bot calls, read as called. Every message key, every
      // command name and every slug is a chance for the same accident.
      const line = withoutStrings(raw);
      if (!line.includes(name)) continue;

      // The key is removed rather than the line dropped, so a line that both
      // writes the name and reads it still counts as a read: `paginate:
      // paginate,` keeps its value half. This mirrors the same decision written
      // over `readsOf` above, and for the same reason — the three separate rules
      // it replaced threw away the read in `temperature: options.temperature`.
      const withoutKey = line.replace(leadingKey, ' ');
      if (new RegExp(boundary).test(withoutKey)) uses++;
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

/**
 * Every file under a directory that could hold a call, depth first.
 *
 * `.tsx` for the same reason `audit-unread.mjs`'s own walk takes it: a React
 * screen's tests are `.tsx` as often as not, and a caller invisible because of
 * a file extension is the blind spot that audit was widened for twice.
 *
 * Reader-injected rather than reaching for `node:fs`, so the rule below can be
 * asserted against a made-up tree — the same arrangement `lib/claims.mjs` uses
 * and for the same reason.
 */
function* filesUnder(read, dir) {
  for (const entry of read.entries(dir).sort()) {
    const path = `${dir}/${entry}`;
    if (read.isDirectory(path)) yield* filesUnder(read, path);
    else if (/\.(ts|tsx|mjs)$/.test(entry)) yield path;
  }
}

/**
 * The test files, which count as callers and as nothing else.
 *
 * MEASURED, and the finding that produced this was a false one. `audit-unread`
 * reported `floatingAssertions (function, scripts/lib/awaited.mjs)` as an export
 * with no caller anywhere, and it has thirteen live callers — every one of them
 * in `apps/mobile/tests/awaited.test.ts`. The audit's corpus is
 * `workspaceSources(...)` plus `scripts`, and `NOT_SOURCE` in `lib/claims.mjs`
 * contains `'tests'`, so a caller inside a tests directory was outside the
 * search BY CONSTRUCTION. That is a shape, not one export: any library function
 * whose only caller is a test is reported uncalled, every time, and the remedy
 * the audit prints — *add it to PUBLIC_API with a reason* — would write a
 * falsehood into the permissions list permanently, where the rule in
 * `lib/records.mjs` says an excuse outliving its reason is a licence issued for
 * something else.
 *
 * ## Why this is a SEPARATE corpus and not a wider one
 *
 * `NOT_SOURCE` is right about everything else it is used for, and folding tests
 * into `workspaceSources` would switch off three checks at once:
 *
 *   - `unreadFields` asks whether a field has a READER. `Reply.broadcast` was
 *     read in its tests and nowhere else — a field the suite confirms and the
 *     program ignores — which is precisely the state that audit exists to find.
 *     Searching tests would have reported it as read.
 *   - `unusedInOwnPackage` aligns `files` with `sources` by index and asks
 *     whether an application uses its OWN export. Adding entries to one of the
 *     two arrays and not the other would mis-attribute every file after the
 *     first insertion.
 *   - `staleAmong` and the waivers keyed on it are statements about the
 *     shipped surface, not about the suite.
 *
 * Only `uncalledExports` gets this, because only its question — *does anything
 * at all call this* — has an honest answer that includes a test. A test IS a
 * caller: it compiles against the signature and breaks when the signature does.
 * It is a weaker answer than *the game calls it*, which is why every OTHER
 * question here still refuses to look at tests.
 *
 * @param read  `{ entries(dir), isDirectory(path), exists(path) }`, repo-relative,
 *              injected exactly as `lib/claims.mjs` takes it.
 */
export function testCallerFiles(read, groups) {
  const found = [];

  for (const one of workspacePackages(read, groups)) {
    if (one.tests === null) continue;
    found.push(...filesUnder(read, one.tests));
  }

  return found;
}
