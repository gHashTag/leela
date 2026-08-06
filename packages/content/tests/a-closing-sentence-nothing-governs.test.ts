/**
 * An all-clear that nothing governs, in every audit this repository runs.
 *
 * The defect: a script decides to fail — it sets `process.exitCode = 1` inside
 * some branch — and then closes on a sentence written over a different
 * variable, one that knows nothing about that branch. The exit code is right.
 * The last line on screen says everything is fine, and a human reads the last
 * line. That is not a theory about how output is read: an hour went into
 * debugging a package for ten failures a script had already named on screen,
 * above its own all-clear, and the write-up of that hour is what
 * `scripts/lib/report.mjs` was built from.
 *
 * `report.mjs` fixed the printing. It could not fix the next script to be
 * written, and it did not fix the ones it was not carried to — its own header
 * says the repair "was never carried to the four siblings", and it was in fact
 * carried to four of the seven that had the defect. A rule implemented in one
 * module and restated in prose everywhere else is a rule in the wrong place;
 * this is the check that holds the rest of the directory to it.
 *
 * ## What is asserted, and how
 *
 * Nothing here names an audit. The directory is listed, every `audit-*.mjs` is
 * parsed, and each file is asked one question:
 *
 *   let GATES be the identifiers in the condition of every ARM that sets
 *   `process.exitCode = 1` in its own half — not of every chain that sets it
 *   somewhere;
 *   let CLOSING be the condition of the last top-level `if` that prints, does
 *   not itself set an exit code, asks only one question, and whose condition is
 *   a claim of emptiness — `x.length === 0`, possibly several joined by `&&`.
 *   That is the shape of an all-clear: a sentence printed because nothing was
 *   found.
 *
 *   then GATES must be a subset of CLOSING.
 *
 * ## Arms, and why a chain's head is not its closing sentence
 *
 * Both halves of that were once written over whole chains, and both were wrong
 * in the same way — `branches()` returns one Branch per `if / else if / else`
 * chain, with `whole` spanning every arm but `condition` holding only the head.
 *
 * On the reading side that books an exit to whoever the FIRST question was
 * about. MEASURED on `scripts/audit-claims.mjs`: reported as exiting on
 * `unreadable`, which is a name that is governed, and which is not even
 * attached to the exit code this check looks for — `unreadable` sets 2. The
 * gate is `red`, one arm lower. So GATES is now read arm by arm.
 *
 * On the closing side, a chain that asks more than one question has no single
 * closing sentence to be governed. Exactly one arm prints, so which sentence a
 * run ends on is decided by which arm ran, and the head condition did not
 * decide that — an `else if` is entered on a question the head never asked.
 * That is a structural property of the chain, not an exemption granted to it:
 * there is no sentence to hold the gates against, so the file is not asked,
 * exactly as a file with no all-clear at all is not asked. `audit-claims.mjs`
 * leaves by this route, and the sentence it was being held to reads 'Nothing
 * was measured, so nothing about README was checked.' — the opposite of an
 * all-clear, and accepted as one only because `isAllClearShaped` reads the
 * shape of a condition and never the sentence.
 *
 * A two-armed `if / else` is kept, and the line is drawn there on purpose.
 * MEASURED, by drawing it at any `else` first: the incident's own shape — a
 * gate over `stale`, an all-clear over `missing`, the `else` of that all-clear
 * setting the code — went silent, and so did the fixture for the gate hidden
 * in an `else`. A two-armed chain is exhaustive over one question: whichever
 * arm printed, the head condition is what decided it, and the complement of a
 * claim about `missing` is still a claim about `missing`. With three arms that
 * stops being true. The rule is therefore "asks more than one question", which
 * is `hasFurtherArms`, not "has an else".
 *
 * With two ways out, because there are two other correct ways to write it: a
 * file that hands its sections to `finish(` has the guarantee from the module,
 * and a file that reads `process.exitCode ===` back into its own condition has
 * asked the question directly.
 *
 * A file with no all-clear at all is not asked. It has no closing sentence to
 * be wrong, and flagging it would be crying wolf — MEASURED on
 * `scripts/audit-deployment.mjs`, which ends on `console.error` inside its gate
 * and prints no verdict of its own.
 *
 * The emptiness requirement on CLOSING is there for the same reason. Without
 * it, "the last `if` that prints" picks up any trailing informational block,
 * and `scripts/audit-podlock.mjs` — whose all-clear is correctly governed by
 * the same list its gate uses, and which then prints a note about podspecs the
 * lock has never heard of — was reported as defective. A check that cries wolf
 * on correct code is one somebody deletes rather than obeys.
 *
 * ## What this cannot see
 *
 * ASSUMED, and worth writing down: an all-clear whose condition is spelled some
 * other way — `!problems.length`, `everything.every(...)` — is not recognised as
 * a closing sentence, so a file written that way is skipped rather than
 * checked. That is a miss, not a false alarm, and it is the direction to err in.
 *
 * MEASURED and worse, because it is a miss of the defect itself: a bare `else`
 * that sets the exit code is invisible. It has no condition, so there is no
 * name to hold against the closing sentence, and the fixture called 'a bare
 * else that sets the code' is a source that really does have the defect and
 * really is passed. The alternative was to charge the head's names for it,
 * which on that same fixture would report `drift` — a name the all-clear does
 * govern — and answer a question about the wrong variable. A check that names
 * an innocent gets deleted; one that stays quiet about a shape it cannot read
 * gets extended. This is that shape, written down so the next reader knows it
 * was chosen rather than missed.
 *
 * MEASURED, and repaired on 2026-08-06 rather than left standing — this
 * paragraph is kept because where the note used to live is the finding. A
 * decision to fail spelled `process.exit(1)` was invisible here: this reader
 * knew `process.exitCode = 1` and nothing else. Of the audits on disk, five call
 * `process.exit(...)`, and two of them write `process.exitCode` nowhere at all —
 * `scripts/audit-awaited.mjs` (2 calls, 0 assignments) and
 * `scripts/audit-copies.mjs` (4 calls; its one `process.exitCode` is inside a
 * doc-comment, which `blanked()` correctly erases). For those two, GATES came
 * out empty and the file passed by construction rather than by being clean.
 *
 * The note saying so lived at `scripts/audit-copies.mjs:230`, inside one of the
 * two files this reader could not see — a limit of the READER recorded in one of
 * the things it reads, which is where a limit goes to be forgotten:
 * `audit-awaited.mjs` was written afterwards in the same shape and nothing
 * anywhere said it was unsupervised. `SETS_THE_CODE` now reads both spellings,
 * and `audit-copies.mjs` carries a pointer here instead of the note.
 *
 * MEASURED on the widening itself, because a wider reader is a chance to name an
 * innocent: over the 21 audits on disk it names nobody new — `ungoverned` is
 * empty for every file both before and after. Exactly two files gain gate names
 * at all: `audit-book.mjs` gains `shared` (its 'the two editions share no
 * chapters' precondition) and `audit-copies.mjs` gains `existsSync, SRC` (its
 * 'No source directory' precondition), and both are files with no closing
 * sentence to be held against — so the names are computed and then held against
 * nothing. `audit-variants.mjs`, whose :127 is the same precondition shape, does
 * NOT gain them: it has a closing sentence, so the order rule in
 * `ASSIGNS_THE_CODE` drops the exit above it before `gates` ever sees it.
 *
 * MEASURED and still unread, named here so the next widening starts from a list
 * rather than from a surprise: an exit code that is not 1 — `audit-copies.mjs`
 * leaves with 2 for a board nobody could parse — and an exit whose code is
 * computed, `process.exit(fresh.length + rotted.length > 0 ? 1 : 0)` at the foot
 * of that same file. The second is not an arm of anything: it stands at the top
 * level with no condition above it, so there is no name to attribute it to, and
 * it is invisible for the same structural reason a bare `else` is. Both are
 * misses rather than false alarms, which is the direction to err in.
 *
 * MEASURED today: of the audits in this directory, three were named by this rule
 * and every one of them was the defect; two more were named by looser versions
 * of it and neither was.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const SCRIPTS = join(ROOT, 'scripts');

/**
 * The source with its comments and the insides of its strings blanked out.
 *
 * Not decoration. Half of this repository is prose about what went wrong, and
 * that prose quotes the code it is about: the file this check was written for
 * carries the words `process.exitCode = 1` in a doc-comment, describing the
 * defect it used to have. A reader that searched lines would find that comment
 * and report a gate that is not there — a check fooled by prose says a file
 * does what it does not.
 *
 * Blanking rather than deleting, so every offset in the result is the offset it
 * had in the file and a newline stays a newline. String CONTENTS go too: they
 * hold braces and parentheses that would throw the depth count off, and nothing
 * asked here is about what a message says.
 */
function blanked(source: string): string {
  const keep = (ch: string) => (ch === '\n' ? '\n' : ' ');
  let out = '';
  let at = 0;
  // The last character that was not whitespace, which is how a regular
  // expression is told from a division: `/` after a value divides, `/` after
  // `(`, `,`, `=` and their relatives opens a pattern.
  let last = '';

  while (at < source.length) {
    const ch = source[at];
    const next = source[at + 1];

    if (ch === '/' && next === '/') {
      while (at < source.length && source[at] !== '\n') {
        out += keep(source[at]);
        at += 1;
      }
      continue;
    }

    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', at + 2);
      const stop = end === -1 ? source.length : end + 2;
      for (; at < stop; at += 1) out += keep(source[at]);
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      out += ch;
      at += 1;
      while (at < source.length) {
        if (source[at] === '\\') {
          out += '  ';
          at += 2;
          continue;
        }
        if (source[at] === ch) break;
        out += keep(source[at]);
        at += 1;
      }
      out += ch;
      at += 1;
      last = ch;
      continue;
    }

    if (ch === '/' && /[(,=:[!&|?{};+\-*%<>~^]/.test(last)) {
      out += ch;
      at += 1;
      let inClass = false;
      while (at < source.length) {
        const c = source[at];
        if (c === '\\') {
          out += '  ';
          at += 2;
          continue;
        }
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) break;
        out += keep(c);
        at += 1;
      }
      out += '/';
      at += 1;
      while (at < source.length && /[a-z]/.test(source[at])) {
        out += source[at];
        at += 1;
      }
      last = '/';
      continue;
    }

    out += ch;
    if (!/\s/.test(ch)) last = ch;
    at += 1;
  }

  return out;
}

/** The index of the bracket closing the one at `open`. */
function closes(text: string, open: number): number {
  const shut: Record<string, string> = { '(': ')', '{': '}' };
  const end = shut[text[open]];
  let depth = 0;
  for (let at = open; at < text.length; at += 1) {
    if (text[at] === text[open]) depth += 1;
    else if (text[at] === end) {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  return -1;
}

type Branch = {
  /**
   * Where the `if` starts, as an offset into the blanked source.
   *
   * Carried because one question this file asks is about ORDER, and only one:
   * a gate that ends the run outright cannot be followed by anything, so
   * whether it stands above or below the closing sentence decides whether that
   * sentence can print after it. `blanked()` keeps every offset the offset it
   * had in the file, which is why this number means anything.
   */
  at: number;
  /** What is inside the `if (...)`. */
  condition: string;
  /** The `then` half alone. */
  consequent: string;
  /** Consequent, `else`, `else if` and all: the whole statement. */
  whole: string;
};

/**
 * Every `if` written at the top level of a script.
 *
 * Top level is the point. An audit's gates and its closing sentence are
 * statements of the file itself; an `if` inside a helper is about one value it
 * was handed, and reading those would mix the two. Depth is counted over the
 * blanked source, so a brace inside a message or a pattern cannot move it.
 */
function branches(text: string): Branch[] {
  const found: Branch[] = [];
  let depth = 0;

  for (let at = 0; at < text.length; at += 1) {
    const ch = text[at];
    if (ch === '(' || ch === '{' || ch === '[') {
      depth += 1;
      continue;
    }
    if (ch === ')' || ch === '}' || ch === ']') {
      depth -= 1;
      continue;
    }
    if (depth !== 0) continue;
    if (!/^if\b/.test(text.slice(at, at + 3))) continue;
    // `notif(` and `x.if` are not this.
    if (at > 0 && /[A-Za-z0-9_$.]/.test(text[at - 1])) continue;

    let open = at + 2;
    while (open < text.length && /\s/.test(text[open])) open += 1;
    if (text[open] !== '(') continue;

    const shut = closes(text, open);
    if (shut === -1) continue;
    const condition = text.slice(open + 1, shut);

    let body = shut + 1;
    while (body < text.length && /\s/.test(text[body])) body += 1;
    const consequentEnd =
      text[body] === '{' ? closes(text, body) + 1 : text.indexOf(';', body) + 1;
    if (consequentEnd <= 0) continue;
    const consequent = text.slice(body, consequentEnd);

    // Walk the `else` / `else if` chain so `whole` covers the statement. The
    // branch that sets the exit code is often the `else` of a condition that
    // reads like an all-clear, which is exactly the arrangement being asked
    // about, so stopping at the consequent would miss half the gates.
    let end = consequentEnd;
    for (;;) {
      let after = end;
      while (after < text.length && /\s/.test(text[after])) after += 1;
      if (!/^else\b/.test(text.slice(after, after + 5))) break;

      let arm = after + 4;
      while (arm < text.length && /\s/.test(text[arm])) arm += 1;

      if (text[arm] === '{') {
        end = closes(text, arm) + 1;
      } else if (/^if\b/.test(text.slice(arm, arm + 3))) {
        let nested = arm + 2;
        while (nested < text.length && /\s/.test(text[nested])) nested += 1;
        const nestedShut = closes(text, nested);
        let nestedBody = nestedShut + 1;
        while (nestedBody < text.length && /\s/.test(text[nestedBody])) nestedBody += 1;
        end =
          text[nestedBody] === '{'
            ? closes(text, nestedBody) + 1
            : text.indexOf(';', nestedBody) + 1;
      } else {
        end = text.indexOf(';', arm) + 1;
      }
      if (end <= 0) break;
    }

    found.push({ at, condition, consequent, whole: text.slice(at, end) });
    at = end - 1;
    depth = 0;
  }

  return found;
}

type Arm = {
  /**
   * The `if (...)` this arm is entered on, or `null` for a bare `else` — which
   * is entered on the failure of every condition above it and therefore has no
   * condition of its own.
   */
  condition: string | null;
  /** The half that runs when this is the arm taken. */
  consequent: string;
};

/**
 * One chain, split into the arms a run can actually take.
 *
 * `branches()` hands back one Branch per whole `if / else if / else` chain,
 * with `whole` spanning every arm and `condition` holding only the head. Asking
 * whether the chain sets an exit code and then reading the head's names off it
 * attributes the exit to whoever the FIRST question was about, and on a chain
 * with three arms the first question is usually not the one that failed.
 * MEASURED on `scripts/audit-claims.mjs`, whose exit chain is
 *
 *   if (unreadable.size > 0) { ...; process.exitCode = 2; }
 *   else if (problems.length > 0 || red.size > 0) { ...; process.exitCode = 1; }
 *
 * and which was reported as exiting on `unreadable` — a name that is governed,
 * by a different chain, and that is not even attached to the exit code the
 * check looks for. The gate is `red`, three lines lower and invisible to a
 * reader that stops at the head.
 *
 * The scan is the one `closes()` already does; nothing here counts braces of
 * its own.
 */
function arms(branch: Branch): Arm[] {
  const text = branch.whole;
  const found: Arm[] = [];
  let at = 0;

  for (;;) {
    while (at < text.length && /\s/.test(text[at])) at += 1;
    if (!/^if\b/.test(text.slice(at, at + 3))) break;

    let open = at + 2;
    while (open < text.length && /\s/.test(text[open])) open += 1;
    if (text[open] !== '(') break;
    const shut = closes(text, open);
    if (shut === -1) break;

    let body = shut + 1;
    while (body < text.length && /\s/.test(text[body])) body += 1;
    const bodyEnd =
      text[body] === '{' ? closes(text, body) + 1 : text.indexOf(';', body) + 1;
    if (bodyEnd <= 0) break;

    found.push({
      condition: text.slice(open + 1, shut),
      consequent: text.slice(body, bodyEnd),
    });

    let after = bodyEnd;
    while (after < text.length && /\s/.test(text[after])) after += 1;
    if (!/^else\b/.test(text.slice(after, after + 5))) break;

    at = after + 4;
    while (at < text.length && /\s/.test(text[at])) at += 1;
    // `else if` is the next turn of this same loop. A bare `else` ends it.
    if (/^if\b/.test(text.slice(at, at + 3))) continue;

    const elseEnd =
      text[at] === '{' ? closes(text, at) + 1 : text.indexOf(';', at) + 1;
    if (elseEnd <= 0) break;
    found.push({ condition: null, consequent: text.slice(at, elseEnd) });
    break;
  }

  return found;
}

/** Whether a chain asks more than one question: it has at least one `else if`. */
const hasFurtherArms = (branch: Branch) =>
  arms(branch).filter((arm) => arm.condition !== null).length > 1;

/**
 * The names a condition is written over, ignoring what is read off them.
 *
 * `uncalled.length === 0` is about `uncalled`; `length` is how the question is
 * asked, not what it is about. Anything after a dot is dropped for that reason,
 * and the handful of globals and keywords that can appear in a condition with
 * it.
 */
const NOT_A_SUBJECT = new Set([
  'true',
  'false',
  'null',
  'undefined',
  'new',
  'typeof',
  'instanceof',
  'in',
  'of',
  'void',
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Set',
  'Map',
  'JSON',
  'process',
]);

function subjects(condition: string): Set<string> {
  const names = new Set<string>();
  const word = /(\.?)\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g;
  let found: RegExpExecArray | null;
  while ((found = word.exec(condition))) {
    if (found[1] === '.') continue;
    if (NOT_A_SUBJECT.has(found[2])) continue;
    names.add(found[2]);
  }
  return names;
}

/** A claim that nothing was found: `x.length === 0`, or several joined by `&&`. */
const EMPTINESS = /^\s*[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*\.(?:length|size)\s*===\s*0\s*$/;
const isAllClearShaped = (condition: string) =>
  condition
    .split('&&')
    .every((part) => EMPTINESS.test(part.replace(/[()]/g, ' ')));

/**
 * A decision to fail, written either way round.
 *
 * `process.exitCode = 1` was the only one recognised until 2026-08-06, and the
 * miss was named inside one of the files it missed rather than here — the note
 * now in 'What this cannot see' lived at `scripts/audit-copies.mjs:230`, which
 * is a limit of the READER recorded in one of the things it reads.
 */
const SETS_THE_CODE = /process\.exitCode\s*=\s*1|process\.exit\(\s*1\s*\)/;

/**
 * The half of that which lets the run carry on.
 *
 * The two are not interchangeable and the difference is the whole reason this
 * check exists. `process.exitCode = 1` marks the run and keeps going, so a
 * closing sentence BELOW it still prints, and the last line can contradict the
 * code — the incident. `process.exit(1)` ends the process where it stands:
 * nothing below it prints, so a sentence below it cannot be the sentence the
 * run ended on. An exiting gate is therefore only asked about when it stands
 * AFTER the closing sentence, where the all-clear has already been printed and
 * the run then leaves red.
 *
 * MEASURED, and the prediction that this widening would name nobody was wrong:
 * without the order rule the widened reader names `scripts/audit-variants.mjs`
 * for `SRC, existsSync`, which is its 'No source directory at ...' precondition
 * at :126 — three lines that print an error and leave, forty lines above the
 * all-clear they were said to contradict. That all-clear cannot print on that
 * path. Naming it would be the first false alarm this check ever raised, on the
 * audit that checks the two hand-written variants; a check that cries wolf is
 * one somebody deletes rather than obeys.
 */
const ASSIGNS_THE_CODE = /process\.exitCode\s*=\s*1/;
const READS_THE_CODE = /process\.exitCode\s*===/;
const HANDS_IT_OVER = /\bfinish\s*\(/;

type Reading = {
  gates: Set<string>;
  closing: Set<string> | null;
  excused: boolean;
  ungoverned: string[];
};

/** Ask one script the question. */
function read(source: string): Reading {
  const text = blanked(source);
  const all = branches(text);

  const closers = all.filter(
    (branch) =>
      !hasFurtherArms(branch) &&
      branch.consequent.includes('console.log') &&
      !branch.consequent.includes('process.exitCode') &&
      isAllClearShaped(branch.condition),
  );
  const closer = closers.length > 0 ? closers[closers.length - 1] : null;
  const closing = closer === null ? null : subjects(closer.condition);

  const gates = new Set<string>();
  for (const branch of all) {
    for (const arm of arms(branch)) {
      if (!SETS_THE_CODE.test(arm.consequent)) continue;
      // A bare `else` is reached by every condition above it failing, and none
      // of those names is what this arm is about. There is nothing to attribute
      // the exit to, so it contributes none — which is this reader's one blind
      // spot by construction, and the fixture named for it says so.
      if (arm.condition === null) continue;
      // A gate that ENDS the run, standing above the closing sentence, is a
      // precondition: the sentence it is being held against cannot print after
      // it. See `ASSIGNS_THE_CODE`, and `audit-variants.mjs` for the file this
      // was measured on.
      if (
        !ASSIGNS_THE_CODE.test(arm.consequent) &&
        closer !== null &&
        branch.at < closer.at
      )
        continue;
      for (const name of subjects(arm.condition)) gates.add(name);
    }
  }

  const excused = HANDS_IT_OVER.test(text) || READS_THE_CODE.test(text);
  const ungoverned =
    excused || closing === null ? [] : [...gates].filter((name) => !closing.has(name));

  return { gates, closing, excused, ungoverned };
}

/**
 * The shapes this reader is allowed to be silent about, each one named.
 *
 * Not a roster of files. A roster goes stale the moment somebody rearranges an
 * audit's exit — which is happening in this same round to
 * `scripts/audit-deployment.mjs` — and a stale roster excuses a file for a
 * reason that stopped being true. These are shapes, derived per run from the
 * source in front of the reader, and every audit on disk has to land on one of
 * them or on 'held'. The point is the count: an audit that is skipped is
 * skipped in total silence today, and silence is indistinguishable from a pass.
 *
 * `unclassified` is the one that matters. It is reachable — a file whose
 * all-clear candidates are disqualified by a mixture of reasons, or by a filter
 * added to `closers` that nobody named here, comes out as `unclassified` and
 * fails. That is the guard against this reader growing a new blind spot in
 * silence, which is precisely how it grew the `process.exit` one.
 */
const NOT_HELD = {
  excused: 'hands its sections to the reporter, or reads the exit code back',
  noEmptiness: 'no top-level condition is a claim of emptiness',
  furtherArms: 'its only all-clear shape is one arm of a chain that asks more than one question',
  silent: 'its only all-clear shape prints nothing',
  setsCode: 'its only all-clear shape sets the exit code itself',
  unclassified: 'UNCLASSIFIED: it has an all-clear shape and this reader cannot say why it skipped it',
} as const;

/**
 * Why a file was not held to the rule, or `null` if it was.
 *
 * Re-derived from the branches rather than read off `read()`, so the two paths
 * have to agree: `read()` drops a candidate through a chain of four filters and
 * remembers nothing about which one, and this asks each filter by name. When
 * they stop agreeing the answer is `unclassified`, which is a failure.
 *
 * The order of the four is load-bearing and not a style choice. `every` on an
 * empty list is true, so with no candidates at all each of the last three would
 * answer yes and the first of them would take the credit. MEASURED, by deleting
 * the `shaped.length === 0` line: `scripts/audit-deployment.mjs`, which has no
 * emptiness claim anywhere, came back as 'one arm of a chain that asks more than
 * one question' — a confident sentence about a chain it does not have, and the
 * accounting above passed it because the reason was still one of the named ones.
 * The emptiness check has to stay first, and stay a length test.
 */
function whyNotHeld(source: string): string | null {
  const reading = read(source);
  if (reading.excused) return NOT_HELD.excused;
  if (reading.closing !== null) return null;

  const shaped = branches(blanked(source)).filter((branch) => isAllClearShaped(branch.condition));
  if (shaped.length === 0) return NOT_HELD.noEmptiness;
  if (shaped.every(hasFurtherArms)) return NOT_HELD.furtherArms;
  if (shaped.every((branch) => !branch.consequent.includes('console.log'))) return NOT_HELD.silent;
  if (shaped.every((branch) => branch.consequent.includes('process.exitCode')))
    return NOT_HELD.setsCode;
  return NOT_HELD.unclassified;
}

const audits = readdirSync(SCRIPTS)
  .filter((name) => /^audit-.*\.mjs$/.test(name))
  .sort()
  .map((name) => ({ name, source: readFileSync(join(SCRIPTS, name), 'utf8') }));

describe('a closing sentence nothing governs', () => {
  it('has audits to read', () => {
    // The directory listing is the input. If it ever comes back empty this test
    // passes over nothing and says so — which is the failure mode of every
    // check that walks a tree, and it has happened twice in this repository.
    expect(audits.length).toBeGreaterThan(10);
  });

  it('finds every gate governed by the sentence the run ends on', () => {
    const guilty = audits
      .map(({ name, source }) => ({ name, ...read(source) }))
      .filter((one) => one.ungoverned.length > 0)
      .map((one) => `${one.name}: exits on ${one.ungoverned.join(', ')}, closes on ${[
        ...(one.closing ?? []),
      ].join(', ')}`);

    expect(guilty).toEqual([]);
  });

  it('accounts for every audit on disk, and says how many it actually compared', () => {
    // What this adds is a number, and the number is the finding. An audit this
    // reader cannot parse is skipped without a word, so `guilty: []` above has
    // always meant 'none of the files I could read is defective' while reading
    // like 'none of the files is defective'. The file that documented the
    // `process.exit` blind spot — `scripts/audit-copies.mjs` — was itself
    // skipped twice over: no gate this reader recognised, and an all-clear that
    // is not emptiness-shaped, so it was neither asked nor mentioned.
    //
    // Three outcomes, and the middle one is the honest half of a green run:
    //   compared — a closing sentence was found and gates were held against it;
    //   vacuous  — a closing sentence was found and this reader saw no gate to
    //              hold against it, so the pass proves nothing about the file;
    //   not held — for one of the shapes `NOT_HELD` names.
    const ledger = audits.map(({ name, source }) => {
      const reading = read(source);
      const why = whyNotHeld(source);
      return { name, why, gates: reading.gates.size };
    });

    const compared = ledger.filter((one) => one.why === null && one.gates > 0);
    const vacuous = ledger.filter((one) => one.why === null && one.gates === 0);
    const skipped = ledger.filter((one) => one.why !== null);

    console.log(
      `\na closing sentence nothing governs: ${audits.length} audit(s) on disk, ` +
        `${compared.length} compared, ${vacuous.length} held but with no gate this reader could see, ` +
        `${skipped.length} not held.`,
    );
    for (const one of compared) console.log(`  compared  ${one.name} (${one.gates} gate name(s))`);
    for (const one of vacuous) console.log(`  vacuous   ${one.name}`);
    for (const one of skipped) console.log(`  not held  ${one.name} — ${one.why}`);

    // Every file is accounted for exactly once, and none of it by accident.
    expect(compared.length + vacuous.length + skipped.length).toBe(audits.length);

    // No file may be skipped for a reason this file does not name in prose.
    const named = new Set<string>(Object.values(NOT_HELD));
    expect(
      skipped.filter((one) => !named.has(one.why!) || one.why === NOT_HELD.unclassified),
    ).toEqual([]);

    // And the whole check may not go vacuous. If this reader ever stops seeing
    // a single gate anywhere in the directory, `guilty: []` becomes a sentence
    // about nothing — which is the defect this file is named for, arriving in
    // the reader instead of the read.
    expect(compared.length, 'no audit is actually compared, so the green above is empty').
      toBeGreaterThan(0);
  });

  /**
   * The reader, shown the shapes it has to tell apart.
   *
   * These are written out rather than taken from the directory, because a test
   * that only reads the tree proves whatever the tree happens to be: on a clean
   * tree it passes without ever having decided anything. Each fixture is one
   * edge of the rule, and the defective one is the shape of the incident.
   */
  const fixtures: Array<{
    what: string;
    ungoverned: boolean;
    /** The exact names expected, where which name is the point and not just that there is one. */
    names?: string[];
    source: string;
  }> = [
    {
      what: 'a gate the closing sentence knows nothing about',
      ungoverned: true,
      source: `
        if (stale.length > 0) {
          console.log('these are stale');
          process.exitCode = 1;
        }
        if (missing.length === 0) {
          console.log('nothing is missing');
        } else {
          console.log('these are missing');
          process.exitCode = 1;
        }
      `,
    },
    {
      what: 'every gate named in the closing sentence',
      ungoverned: false,
      source: `
        if (stale.length > 0) {
          console.log('these are stale');
          process.exitCode = 1;
        }
        if (missing.length > 0) {
          console.log('these are missing');
          process.exitCode = 1;
        }
        if (stale.length === 0 && missing.length === 0) {
          console.log('all of it is fine');
        }
      `,
    },
    {
      what: 'the gate hidden in an else, with the all-clear in the then',
      ungoverned: true,
      source: `
        if (stale.length > 0) {
          process.exitCode = 1;
        }
        if (missing.length === 0) {
          console.log('nothing is missing');
        } else {
          process.exitCode = 1;
        }
      `,
    },
    {
      what: 'the sections handed to the reporter instead',
      ungoverned: false,
      source: `
        if (stale.length > 0) process.exitCode = 1;
        process.exitCode = finish({
          allClear: 'all of it is fine',
          sections: [{ failing: true, lines: missing }],
        });
      `,
    },
    {
      what: 'the exit code read back into the condition',
      ungoverned: false,
      source: `
        if (stale.length > 0) process.exitCode = 1;
        const failed = missing.length > 0 || process.exitCode === 1;
        if (!failed) {
          console.log('all of it is fine');
        }
      `,
    },
    {
      what: 'a run that never claims to be clean',
      ungoverned: false,
      source: `
        console.log(describe(everything));
        if (summarise(answers) === UNREACHABLE) {
          console.error('nobody answered, which says nothing');
          process.exitCode = 1;
        }
      `,
    },
    {
      what: 'an all-clear governed by its own gate, with a note printed after it',
      ungoverned: false,
      source: `
        if (drift.length === 0) {
          console.log('nothing has drifted');
        } else {
          console.log('these have');
          process.exitCode = 1;
        }
        if (unknown.length > 0) {
          console.log('and these are not in the lock at all');
        }
      `,
    },
    {
      what: 'prose that quotes the defect it describes',
      ungoverned: false,
      source: `
        /**
         * This used to set \`process.exitCode = 1\` in a branch of its own and
         * then close on 'all of it is fine', which knew nothing about it.
         *
         *   if (stale.length > 0) process.exitCode = 1;
         */
        // Another line saying process.exitCode = 1, in a comment.
        const shout = 'if (stale.length > 0) process.exitCode = 1;';
        const source = readFileSync(path, 'utf8').replace(/\\{[^}]*\\}/g, ' ');
        if (missing.length === 0) {
          console.log(\`nothing is missing in \${shout} \${source}\`);
        }
      `,
    },
    {
      // The reason `arms()` exists. Read a chain as one statement and the exit
      // is booked to `a`, which the closing sentence does not name either — so
      // the check fails, names an innocent, and the real gate goes unmentioned.
      // MEASURED before the split: this fixture reported ['a'].
      what: 'a gate that lives only in an else-if arm',
      ungoverned: true,
      names: ['stale'],
      source: `
        if (a.length > 0) {
          console.log('these are a');
        } else if (stale.length > 0) {
          console.log('these are stale');
          process.exitCode = 1;
        }
        if (missing.length === 0) {
          console.log('nothing is missing');
        }
      `,
    },
    {
      // The shape of `scripts/audit-claims.mjs`, which stood red for four
      // rounds. Every arm prints; exactly one of them runs. The head is not the
      // sentence the run ends on, it is the sentence ONE outcome ends on, and
      // the outcome that set the code ended on its own.
      what: 'an all-clear that is one arm of the chain that failed',
      ungoverned: false,
      names: [],
      source: `
        if (problems.length === 0 && actual.size === 0) {
          console.log('nothing was measured, so nothing was checked');
        } else if (problems.length > 0 || red.size > 0) {
          console.log('these numbers disagree');
          process.exitCode = 1;
        } else {
          console.log('nothing found');
        }
      `,
    },
    {
      // The blind spot, written down rather than papered over. This source has
      // the defect: with `drift` empty it prints 'nothing to compare against',
      // sets the code, and then closes on 'nothing is missing'. The gate says
      // nothing, because a bare `else` carries no condition and there is no
      // name to attribute the exit to. Borrowing the head's names instead would
      // book the exit to `drift` — a name that IS governed here — and the
      // check would then be answering a question about the wrong variable.
      // Silence is the honest reading; a confident wrong one is not.
      what: 'a bare else that sets the code',
      ungoverned: false,
      names: [],
      source: `
        if (drift.length > 0) {
          console.log('these have drifted');
        } else {
          console.log('nothing to compare against');
          process.exitCode = 1;
        }
        if (missing.length === 0) {
          console.log('nothing is missing');
        }
      `,
    },
    {
      // The shape that went unread until 2026-08-06, and the reason the note
      // about it had to live inside one of the audits: this reader knew one
      // spelling of a decision to fail. Read top to bottom, the run prints
      // 'nothing is missing' — an all-clear over `missing`, which is true —
      // and then leaves on `stale`, which that sentence has never heard of.
      // The last line on screen says fine and the code says 1. That is the
      // incident, spelled `process.exit`.
      what: 'a gate that ends the run, below the sentence that says all is well',
      ungoverned: true,
      names: ['stale'],
      source: `
        if (missing.length === 0) {
          console.log('nothing is missing');
        }
        if (stale.length > 0) {
          console.log('these are stale');
          process.exit(1);
        }
      `,
    },
    {
      // The innocent, and the reason the widened reader is scoped by order
      // rather than let loose. The same three lines as above, moved above the
      // all-clear: now they are a precondition. When this arm runs, the process
      // is gone before `problems` is so much as computed, so the sentence below
      // is not a sentence this run ended on — it is a sentence this run never
      // reached. MEASURED on `scripts/audit-variants.mjs`, which is exactly
      // this and was named for `SRC, existsSync` before the order rule.
      what: 'a precondition that ends the run above everything it prints',
      ungoverned: false,
      names: [],
      source: `
        if (!existsSync(SRC)) {
          console.error('No source directory. Clone the repositories, or pass --src.');
          process.exit(1);
        }
        if (problems.length === 0) {
          console.log('all of it is fine');
        }
      `,
    },
  ];

  it('tells the shapes apart', () => {
    for (const fixture of fixtures) {
      const reading = read(fixture.source);
      expect(reading.ungoverned.length > 0, fixture.what).toBe(fixture.ungoverned);
    }
  });

  it('names the arm that set the code, not the question asked first', () => {
    // Whether a defect was found is the weaker half. Which name it is reported
    // against is what a reader acts on, and it is where this check was wrong:
    // it printed `unreadable` for a file whose gate is `red`.
    for (const fixture of fixtures) {
      if (!fixture.names) continue;
      expect([...read(fixture.source).ungoverned].sort(), fixture.what).toEqual(
        [...fixture.names].sort(),
      );
    }
  });

  it('reads every arm of a chain, or is silent about none of them', () => {
    // `arms()` bails out — `break` — on anything it cannot parse, and a bail
    // returns the arms found so far. A bail on the head would return nothing,
    // every gate in that file would vanish, and the check would go green by
    // failing to look: the exact shape of defect this whole file is about,
    // arriving in the reader instead of the read. So it is asserted over the
    // real directory rather than trusted.
    for (const { name, source } of audits) {
      for (const branch of branches(blanked(source))) {
        const split = arms(branch);
        expect(split.length, `${name}: a chain with no arms`).toBeGreaterThan(0);
        expect(split[0].condition, `${name}: the head arm is the branch`).toBe(branch.condition);
        expect(split[0].consequent, `${name}: the head arm is the branch`).toBe(branch.consequent);
        // Nothing that the whole chain does may be invisible to all its arms.
        if (SETS_THE_CODE.test(branch.whole))
          expect(
            split.some((arm) => SETS_THE_CODE.test(arm.consequent)),
            `${name}: a chain sets the code in no arm of itself`,
          ).toBe(true);
      }
    }
  });

  it('is not fooled by prose into seeing a gate that is not there', () => {
    // One fixture above is the one this repository actually contains: a
    // doc-comment quoting `process.exitCode = 1`, a string holding the same
    // characters, and a regular expression full of braces. A line search would
    // report a gate over `stale`, which is declared nowhere in that file, and
    // the innocent it named would be the audit that wrote the incident up.
    //
    // Named rather than taken as `fixtures[fixtures.length - 1]`, which is how
    // it was written and which was already wrong before anything was appended:
    // the last entry was 'a bare else that sets the code', a source with no
    // gate for a different reason, so the assertion passed on the wrong
    // subject. A positional reference into a list somebody will extend is a
    // test that quietly changes what it is about.
    const prose = fixtures.find((one) => one.what === 'prose that quotes the defect it describes');
    expect(prose, 'the prose fixture is still in the list').toBeDefined();
    const reading = read(prose!.source);
    expect(reading.gates.size, 'a comment is not a gate').toBe(0);
    expect(reading.closing, 'the all-clear is still found').not.toBeNull();
  });
});
