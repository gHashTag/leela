/**
 * The file the whole bot hangs from, and the reason nothing was holding it.
 *
 * MIGRATION.md marks apps/bot "- done." `apps/bot/src/index.ts` is the one file
 * in this workspace that is not. MEASURED with the v8 coverage provider, twice
 * - package-scoped and again under the ten-workspace run, identical numbers -
 * it is 211 lines at 0% statements, 0% branches, 0% functions: the only file in
 * the workspace at zero. No test imports it. No audit reads it either; a grep
 * for `apps/bot/src/index` across `scripts/` finds one comment about a regex,
 * while `scripts/audit-variants.mjs` reads the DONOR bot's entry point seven
 * times.
 *
 * What stands in for it is `assemble()` in `tests/assembled.test.ts`, whose own
 * comment says *"Everything index.ts does, minus the polling"* - a second copy
 * of the wiring with nothing at all holding the copy to the original. That is
 * this repository's named recurring defect, and it is the reason this file
 * exists rather than a rewrite of `assemble()`: the copy is useful, and what it
 * needed was a tie.
 *
 * FALSIFIED rather than argued, before a line of this was written. Deleting
 * `reports: storage.reports,` from the `createBot` call in index.ts leaves
 * `tsc --noEmit` at 0, the strict `tsc --noEmit -p tsconfig.src.json` at 0,
 * 681 of 681 tests passing, and `bun run audit` printing *"15 audits ran and
 * passed"*. Every report then goes to `discardReports` and nothing anywhere
 * says so. The control - the identical defect one file over, wrapping the
 * `reports.record(...)` call in `bot.ts`'s `applyEffects` in `if (false)` -
 * turns 7 files and 19 tests red. So the boundary of the entire test surface
 * is the `createBot({...})` call itself: inside it, this class of defect is
 * caught within seconds; at it, nothing looks.
 *
 * And CI's bot-image smoke job did not close it. Run against a three-change
 * mutation - both durable sinks dropped from the call, the command-menu scope
 * inverted, the provider precedence reversed - the container's output was
 * BYTE-IDENTICAL and all four of the job's greps passed. The reason is the line
 * the job greps as its proof: index.ts computed
 *
 *     `Leela bot starting. Games and reports are kept in ${databasePath}.`
 *
 * from `storage.durable`, which answers *did the SQLite file open* and not
 * *did that sink reach the bot*. With the sinks dropped, the operator is told
 * reports are kept while every report is discarded, and a player typing `/path`
 * is told the truth. The two readers disagree, and the line CI reads as
 * evidence is the one that lies. That is the defect rather than the reassurance,
 * and it is repaired in index.ts by this change: the object handed to
 * `createBot` is named, and the startup line is derived from that object
 * against what storage offered. A sink swapped for a memory one now makes the
 * comparison false and the sentence honest; a field deleted outright no longer
 * compiles, because `built.reports` is then a property that is not there.
 *
 * This is the third instance of one shape on this surface - the published app's
 * *Write a report* button that wrote nothing, and the durable sink with a
 * `record` and no history. The first two were caught because they were inside
 * `createBot`'s reach.
 *
 * STATED PLAINLY: index.ts was correct on the day this was written. What was
 * measured is that it was unheld.
 *
 * WHAT WAS OBSERVED, breaking the guard four ways rather than trusting it.
 * Every line below is a run, not a prediction:
 *
 *  (i) `reports: storage.reports,` deleted from `built` in index.ts. Two cases
 *      here fail, both naming `[ 'reports' ]` - *passes every default that
 *      discards* and *ties the hand-written copy of the wiring to the original*,
 *      which is the tie doing its job - and `tsc` fails as well:
 *      `error TS2339: Property 'reports' does not exist`. Everything else in the
 *      workspace stays green: 685 of 687 passed, 41 of 42 files, and the one
 *      failing file is this one.
 * (ii) restored, and `steps: storage.steps,` deleted instead. The same two cases
 *      fail, naming `[ 'steps' ]`, the same `tsc` error names `steps`, and
 *      685 of 687 pass again. Nothing else moves.
 *(iii) the startup line reading `storage.durable` alone - which is how the file
 *      was written before this change, so this was observed against the real
 *      thing rather than a mutation of it. *derives the operator startup line
 *      from what the bot was built with* fails naming all three sinks,
 *      `[ 'storage.store', 'storage.reports', 'storage.steps' ]`, while the
 *      other five cases pass. That is the half a repair could otherwise have
 *      made unfalsifiable.
 * (iv) a substitution rather than a deletion, because a check that only sees
 *      deletions is a check somebody walks around. With
 *      `reports: new MemoryReportSink()` in `built` and a database that opens,
 *      the repaired process prints *"...leela.db was opened, but the bot was not
 *      built with it - games and reports are held in memory..."*. The same
 *      process with the old `storage.durable` line prints *"Games and reports
 *      are kept in .../leela.db."* One mutation, two answers, and the old one is
 *      the sentence CI greps.
 *
 * The four substrings the bot-image job greps were observed surviving the
 * repair by running the entry point twice, once against a database that opens
 * and once against `/proc/leela.db`: `Leela bot starting`, `kept in `,
 * `could not open /proc/leela.db`, `held in memory` all still printed.
 *
 * HOW IT ASSERTS, and why not by listing names. The set of options whose
 * default silently discards or forgets is DERIVED from the destructuring
 * defaults of `createBot` itself, by matching the default EXPRESSION - a
 * `discard*` identifier, or a `new Memory*` construction. Today that names
 * `store`, `reports` and `steps`. Written this way, a fourth discarding default
 * is covered on the day somebody adds it, which a list of three names is not.
 *
 * DELIBERATELY NOT DONE: this file does not read `.github/workflows/ci.yml` to
 * check that the sentences the bot-image job greps still exist. That coupling
 * would turn this suite red for an edit to the workflow, which is somebody
 * else's file and somebody else's decision. The greps were read by hand and the
 * substrings - `Leela bot starting`, `kept in `, `could not open `,
 * `held in memory` - survive the repair.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blank, callsTo } from '../../../scripts/lib/source.mjs';

const read = (name: string) =>
  blank(readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8'));

const BOT = read('../src/bot.ts');
const INDEX = read('../src/index.ts');
const ASSEMBLED = read('./assembled.test.ts');

/**
 * The index just past the bracket opened at `from`.
 *
 * Bracket-aware rather than pattern-aware, for the reason `callsTo` exists at
 * all: `new MemoryRoomStore()` and `async (url) => (await fetch(url)).text()`
 * both close a bracket inside the thing being read, and a regular expression
 * stops at the first one. String contents are stepped over whole - `blank`
 * deliberately keeps what a string SAYS, so a brace inside one would otherwise
 * be counted.
 */
function past(text: string, from: number): number {
  let depth = 0;
  let at = from;

  while (at < text.length) {
    const ch = text[at];

    if (ch === "'" || ch === '"' || ch === '`') {
      at = endOfString(text, at);
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) return at + 1;
    }
    at += 1;
  }

  throw new Error('a bracket opened and never closed');
}

/** The index just past the string literal opening at `at`, escapes included. */
function endOfString(text: string, at: number): number {
  const quote = text[at];
  let i = at + 1;

  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2;
      continue;
    }
    if (text[i] === quote) return i + 1;
    i += 1;
  }

  return text.length;
}

/**
 * The same text with what every string literal SAYS blanked out.
 *
 * `blank` in `scripts/lib/source.mjs` deliberately keeps string contents - a
 * check that forbids a sentence has to be able to see the sentence - and here
 * that is exactly wrong, because the thing being read is an English sentence
 * with identifiers around it.
 *
 * MEASURED, and it is the reason this function exists rather than a paragraph
 * about being careful. The first draft of *derives the operator startup line*
 * expanded every name in the whole expression, including the words inside
 * `` `Leela bot starting. Games and reports are kept in ${databasePath}.` ``.
 * `bot` is a top-level `const` in index.ts, bound to the `createBot({...})`
 * call - so the word `bot` in the middle of an English sentence expanded into
 * the entire wiring, the reading came back containing `storage.reports`, and
 * the check PASSED against the unrepaired file it was written to fail against.
 * A guard that says yes for a reason unrelated to its question is worse than no
 * guard, and this one said yes on the first run.
 */
function outsideStrings(text: string): string {
  let out = '';
  let at = 0;

  while (at < text.length) {
    const ch = text[at];

    if (ch === "'" || ch === '"' || ch === '`') {
      const end = endOfString(text, at);
      // Blanked rather than removed, so offsets and line numbers do not move -
      // the same reason the shared blanker blanks.
      out += text.slice(at, end).replace(/[^\n]/g, ' ');
      at = end;
      continue;
    }

    out += ch;
    at += 1;
  }

  return out;
}

/** The `{ ... }` beginning at or after `from`, braces balanced. */
function bracesAt(text: string, from: number): string {
  const open = text.indexOf('{', from);
  if (open < 0) throw new Error('no object to read');
  return text.slice(open, past(text, open));
}

/** A comma-separated list, split only where the brackets are all closed. */
function commaSeparated(inside: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let at = 0;

  while (at < inside.length) {
    const ch = inside[at];

    if (ch === "'" || ch === '"' || ch === '`') {
      at = endOfString(inside, at);
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if (ch === ',' && depth === 0) {
      parts.push(inside.slice(start, at));
      start = at + 1;
    }
    at += 1;
  }

  parts.push(inside.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

/**
 * One field of an object literal or of a destructuring pattern.
 *
 * `value` is what the field is worth where it is written: the default
 * expression in a pattern, the property value in a literal, and the field's own
 * name where it is shorthand - which is what shorthand means.
 */
interface Field {
  name: string;
  value: string;
}

/** `{ a, b: c, d = e }` read as fields, shorthand carrying its own name. */
function fieldsOf(braces: string): Field[] {
  const inside = braces.slice(1, braces.length - 1);

  return commaSeparated(inside).map((entry) => {
    const separator = separatorIn(entry);
    if (separator < 0) return { name: entry.trim(), value: entry.trim() };
    return { name: entry.slice(0, separator).trim(), value: entry.slice(separator + 1).trim() };
  });
}

/**
 * Where a field's name stops: the first `:` or `=` with every bracket closed.
 *
 * `=>` is not an assignment and neither is `==`, and both appear in the very
 * defaults this is used to read - `readFile = async (url) => ...`. The first
 * separator wins, so a ternary in a value cannot be mistaken for the name.
 */
function separatorIn(entry: string): number {
  let depth = 0;
  let at = 0;

  while (at < entry.length) {
    const ch = entry[at];

    if (ch === "'" || ch === '"' || ch === '`') {
      at = endOfString(entry, at);
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if (depth === 0 && ch === ':') return at;
    else if (depth === 0 && ch === '=' && entry[at + 1] !== '=' && entry[at + 1] !== '>') {
      return at;
    }
    at += 1;
  }

  return -1;
}

/** The parameter list of `function <name>(...)`, brackets balanced. */
function parametersOf(text: string, name: string): string {
  const at = text.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`no function ${name}`);
  const open = text.indexOf('(', at);
  return text.slice(open + 1, past(text, open) - 1);
}

/** The body of `function <name>(...) { ... }`, braces balanced. */
function bodyOf(text: string, name: string): string {
  const at = text.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`no function ${name}`);
  const open = text.indexOf('(', at);
  return bracesAt(text, past(text, open));
}

/**
 * The initialiser of a top-level `const`/`let`, or undefined.
 *
 * Read to the `;` with every bracket closed, so an object literal spanning
 * twenty lines comes back whole.
 */
function initialiserOf(text: string, name: string): string | undefined {
  const found = new RegExp(`(?:^|\\n)(?:const|let)\\s+${name}\\s*(?::[^=\\n]+)?=\\s*`).exec(text);
  if (!found) return undefined;

  const from = found.index + found[0].length;
  let depth = 0;
  let at = from;

  while (at < text.length) {
    const ch = text[at];

    if (ch === "'" || ch === '"' || ch === '`') {
      at = endOfString(text, at);
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if (ch === ';' && depth === 0) break;
    at += 1;
  }

  return text.slice(from, at).trim();
}

/**
 * An expression with one level of top-level bindings substituted in.
 *
 * Exactly one level, and that is deliberate: it is enough to follow a named
 * condition or a named options object back to what it is made of, and it stops
 * before the substitution can wander far enough to make the check say yes for a
 * reason unrelated to the question. A name after a `.` is a property and is
 * left alone, so `built.reports` does not lose its `reports`.
 *
 * Over code only, never over prose - see `outsideStrings`, which is there
 * because the first draft of this expanded a word inside an English sentence
 * and made the check pass against the file it was written to fail against.
 */
function expanded(text: string, expression: string): string {
  return outsideStrings(expression).replace(
    /(^|[^.\w$])([A-Za-z_$][\w$]*)/g,
    (_whole, before: string, name: string) =>
      before + outsideStrings(initialiserOf(text, name) ?? name),
  );
}

/**
 * The object handed to `createBot`, wherever it is written.
 *
 * The argument may be the literal itself or a name bound to one. Both spell the
 * same wiring, and a check that only understood the inline form would be a
 * check somebody satisfies by naming the object.
 */
function optionsAt(text: string, args: string): Field[] {
  const argument = args.trim();
  if (argument.startsWith('{')) return fieldsOf(bracesAt(argument, 0));

  const bound = initialiserOf(text, argument);
  if (!bound) throw new Error(`createBot is handed ${argument}, which is bound to nothing here`);
  return fieldsOf(bracesAt(bound, 0));
}

/** The defaults of `createBot`, as its own signature writes them. */
const DEFAULTS = fieldsOf(bracesAt(parametersOf(BOT, 'createBot'), 0));

/**
 * A default that discards or forgets, recognised by the expression and not by
 * the name.
 *
 * `discardReports` and `discardSteps` throw away what they are given;
 * `new MemoryRoomStore()` keeps it until the process ends, which for a store of
 * games is the same promise broken more slowly. `log = console.log` and
 * `now = Date.now` are defaults too and neither loses anything, which is why
 * this asks what the default DOES.
 */
const DISCARDS = /^(discard[A-Z]|new\s+Memory[A-Z])/;

const discarding = DEFAULTS.filter((field) => DISCARDS.test(field.value));

const CALLS = callsTo(INDEX, 'createBot');

describe('an entry point nothing holds', () => {
  it('reads the signature at all, or the rest of this proves nothing', () => {
    // The guard against a parser that quietly reads nothing: a destructuring
    // with fields, at least one of them required, at least one defaulted.
    expect(DEFAULTS.length).toBeGreaterThan(3);
    expect(DEFAULTS.some((field) => field.value === field.name)).toBe(true);
    expect(DEFAULTS.some((field) => field.value !== field.name)).toBe(true);
  });

  it('finds defaults that discard, without being told which they are', () => {
    // Derived, so this is a claim about the derivation rather than about three
    // names: some defaults discard, not all of them do, and every one this
    // names does it by what it evaluates to.
    expect(discarding.length).toBeGreaterThan(0);
    expect(discarding.length).toBeLessThan(DEFAULTS.length);
    expect(discarding.filter((field) => !DISCARDS.test(field.value))).toEqual([]);
  });

  it('builds the bot in one place, so the wiring cannot fork', () => {
    // Two call sites in an entry point is two wirings, one of which nobody is
    // reading. `assemble()` in assembled.test.ts is already the second copy;
    // the tie below is what makes it safe, and a third would need its own.
    expect(CALLS).toHaveLength(1);
  });

  it('passes every default that discards, rather than inheriting it', () => {
    const passed = optionsAt(INDEX, CALLS[0]?.args ?? '').map((field) => field.name);
    const inherited = discarding.map((field) => field.name).filter((name) => !passed.includes(name));

    // Inheriting one of these is not a compile error, not a lint finding and
    // not a test failure anywhere else in this workspace. It is a bot that
    // plays perfectly and remembers nothing.
    expect(inherited).toEqual([]);
  });

  it('derives the operator startup line from what the bot was built with', () => {
    const said = callsTo(INDEX, 'console.log').find((call) => call.args.includes('kept in'));
    expect(said, 'the startup line that claims games are kept').toBeDefined();

    // One level of substitution, so a named condition is followed back to what
    // it is made of. `storage.durable` answers whether the file opened; the
    // question the sentence answers is whether that sink reached the bot, and
    // only the values actually handed over can answer it.
    const reading = expanded(INDEX, said?.args ?? '');
    const passed = optionsAt(INDEX, CALLS[0]?.args ?? '');

    const unread = discarding
      .map((field) => passed.find((one) => one.name === field.name)?.value)
      .filter((value): value is string => value !== undefined)
      .filter((value) => !reading.includes(value));

    expect(unread).toEqual([]);
  });

  it('ties the hand-written copy of the wiring to the original', () => {
    // `assemble()` is not deleted and is not rewritten. It is a second copy on
    // purpose - it plays whole games through a real bot on a real database, and
    // index.ts cannot be asked to do that without polling Telegram. What it
    // lacked was anything holding it to the file it says it copies.
    //
    // The keys compared are the ones assemble takes from the application's own
    // wiring or from its caller, derived by what the value mentions: `storage`,
    // or one of assemble's own parameters. The rest are the harness - a fake
    // token, `botInfo` so no `getMe` goes over the network, a `log` that says
    // nothing - and a test is entitled to those. A key that comes out of
    // `openStorage` is a different thing entirely: it is a decision production
    // has to make too.
    const parameters = commaSeparated(parametersOf(ASSEMBLED, 'assemble')).map((entry) =>
      entry.split(/[:?=]/)[0]?.trim(),
    );
    const calls = callsTo(bodyOf(ASSEMBLED, 'assemble'), 'createBot');
    expect(calls).toHaveLength(1);

    const wiring = fieldsOf(bracesAt(calls[0]?.args ?? '', 0)).filter(
      (field) =>
        /\bstorage\b/.test(field.value) ||
        parameters.some((name) => name !== undefined && new RegExp(`\\b${name}\\b`).test(field.value)),
    );
    expect(wiring.length, 'assemble wires something, or this compares nothing').toBeGreaterThan(2);

    const passed = optionsAt(INDEX, CALLS[0]?.args ?? '').map((field) => field.name);
    expect(wiring.map((field) => field.name).filter((name) => !passed.includes(name))).toEqual([]);
  });
});

/**
 * The board asks for a PLAYER's game; a room is keyed by a CHAT.
 *
 * `/ask` learned this first. `roomOf` exists because of it, and its own
 * doc-comment says why: *a room is keyed by the chat it lives in… a player
 * seated in a group was told "take a seat first" while holding one.*
 *
 * `specs/009`'s routes are the second caller with a player in hand and no chat,
 * and they made the identical mistake — `store.get(userId)`, which is right in
 * exactly one place: a private chat with the bot, where the chat id and the
 * user id are the same number. That is the chat a developer tests in, so the
 * defect looks correct until somebody plays at a table in a group and is told
 * they have no game.
 *
 * Asserted over the source because `index.ts` is the wiring itself — the file
 * this whole suite exists to hold — and the lookup is a fact about how it wires
 * the two routes, not about what any function returns.
 */
describe('the board is answered about a player, not a chat', () => {
  const wiring = read('../src/index.ts');

  it('is reading the file it means to', () => {
    // Every check that reads a tree can read an empty one and pass over
    // nothing, which has happened twice in this repository.
    expect(wiring.length).toBeGreaterThan(2000);
    expect(wiring).toContain('gameOf');
    expect(wiring).toContain('rollFor');
  });

  it('ASKS `roomOf` FOR BOTH ROUTES, not the chat-keyed `get`', () => {
    /*
     * Both, and the same way. A board that can READ a game it cannot ROLL in is
     * worse than one that can do neither: the player sees their real position
     * and then the die refuses, with no sentence that explains the difference.
     */
    const lookups = wiring.match(/storage\.store\.roomOf\?\.\(userId\)/g) ?? [];

    expect(lookups.length, 'one of the two routes still looks a player up by chat').toBe(2);
  });

  it('keeps `get` only as the fallback, never as the first question', () => {
    /*
     * `roomOf` is optional on the interface — a store that cannot answer says so
     * by not having the method, which is that file's own convention. So `get`
     * must still be reachable, and must not be what is asked first.
     */
    const bare = wiring.match(/const room = await storage\.store\.get\(userId\)/g) ?? [];

    expect(bare, 'a route asks the chat-keyed store first').toEqual([]);
    expect(wiring).toContain('?? (await storage.store.get(userId))');
  });

  it('attributes a Mini App conversion only after the die really turned', () => {
    const start = wiring.indexOf('rollFor:');
    const rollFor = bracesAt(wiring, start);
    const refusal = rollFor.indexOf('after.rollsTaken === before');
    const attribution = rollFor.indexOf('attributeConversion');

    expect(start, 'the Mini App roll route exists').toBeGreaterThan(-1);
    expect(rollFor.length, 'the Mini App roll route has a readable boundary').toBeGreaterThan(100);
    expect(refusal, 'refused rolls are detected').toBeGreaterThan(-1);
    expect(attribution, 'successful Mini App rolls reach daily-word attribution').toBeGreaterThan(
      refusal,
    );
  });
});
