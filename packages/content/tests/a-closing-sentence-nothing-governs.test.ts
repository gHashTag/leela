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
 * this is the check that holds the directory to it as far as it can read, and
 * says on every run how far that is.
 *
 * How far, MEASURED on 2026-08-06 and again the same day after
 * `scripts/audit-claims.mjs` was converted: 20 audits on disk, 10 of them
 * compared — a closing sentence found and a gate held against it — 8 held to a
 * sentence with no gate this reader could see, and 2 not held at all, each for a
 * shape named in `NOT_HELD`. It was 9, 8 and 3 an hour earlier, and the file
 * that moved is the one this reader had named out loud as unreadable: while
 * `audit-claims.mjs` sat under `NOT_HELD.furtherArms` it was printing 'Every
 * number the README states is the number the suites run.' on a run with a
 * failing suite in it, three lines above its own 'The numbers agree. The suites
 * do not all pass.' The thing this reader could not see was a live violation of
 * the guarantee it reads for, which is what an entry in the ledger below is
 * worth: it is not an excuse, it is a list of where to look next.
 *
 * The 10 that are not compared are listed by name and reason in
 * `NOT_CONNECTED` and re-derived on every run, so that number cannot quietly
 * grow. It read 1 of 20 the day before, and passed: the floor under it was
 * `compared.length > 0`, which one file satisfies forever, and the one file was
 * `audit-records.mjs`. A check that holds a directory of twenty to a rule by
 * reading one of them is the shape of defect this file is named for, arriving
 * in the reader instead of the read.
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
 * about. MEASURED on `scripts/audit-claims.mjs` as it stood then — that file has
 * since been converted to the reporter and no longer has the chain, and the
 * measurement is kept because it is why the rule is what it is: reported as
 * exiting on `unreadable`, which is a name that is governed, and which is not
 * even attached to the exit code this check looks for — `unreadable` sets 2. The
 * gate was `red`, one arm lower. So GATES is now read arm by arm.
 *
 * On the closing side, a chain that asks more than one question has no single
 * closing sentence to be governed. Exactly one arm prints, so which sentence a
 * run ends on is decided by which arm ran, and the head condition did not
 * decide that — an `else if` is entered on a question the head never asked.
 * That is a structural property of the chain, not an exemption granted to it:
 * there is no sentence to hold the gates against, so the file is not asked,
 * exactly as a file with no all-clear at all is not asked. `audit-claims.mjs`
 * left by this route until it was converted, and the sentence it was being held
 * to read 'Nothing was measured, so nothing about README was checked.' — the
 * opposite of an all-clear, and accepted as one only because `isAllClearShaped`
 * reads the shape of a condition and never the sentence. `audit-whose.mjs`
 * leaves by it today.
 *
 * That route is structurally sound and it was still where the last live instance
 * of the defect was hiding, which is worth keeping both halves of in mind. The
 * chain in `audit-claims.mjs` genuinely had no single closing sentence to be
 * governed — but its THIRD arm was an unconditional all-clear, and the gate that
 * decided the run was `red`, in a chain forty lines below, which no arm of it
 * asked about. Not asking a file is not the same as clearing it, and the ledger
 * below is the only place that difference is visible.
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
 * ## The two shared gates, which used to be the two largest excuses
 *
 * There are two other correct ways to write this, and until 2026-08-06 both were
 * a reason to SKIP the file: a `NOT_HELD` entry reading 'hands its sections to
 * the reporter, or reads the exit code back', granted to any file whose text
 * matched `/\bfinish\s*\(/` or `/process\.exitCode\s*===/` anywhere at all. That
 * excuse is the reason the run said 1 of 20. It is also the wrong way round, and
 * this is the correction: handing the sections over is not a reason the sentence
 * cannot be checked, it is the STRONGEST gate in the directory. The module
 * decides the sentence and the code in one place — `scripts/lib/report.mjs:101`
 * is `finish({ sections, allClear })` returning `0 | 1`, and its :51 writes the
 * contract down: a caller writing `process.exitCode = finish(...)` cannot
 * disagree with its own last line. So the eight files this check refused to look
 * at were, with one exception, the eight that had got it right, and the check
 * reported that it had compared the one that had not been converted.
 *
 * Both are now read as gates, and both are read structurally rather than by the
 * line:
 *
 *   the reporter — a `finish(...)` call, located by its token and then followed
 *   through `closes()`, whose object argument carries an `allClear` key and
 *   whose return is assigned to `process.exitCode`. Both halves are required:
 *   without the `allClear` the module prints no sentence to be wrong, and
 *   without the assignment the code it computed is dropped on the floor. Two
 *   fixtures hold those two edges, because an excuse granted to `finish(`
 *   appearing anywhere is what was just taken away.
 *
 *   the read-back — a closing sentence whose condition asks `process.exitCode
 *   ===` itself, directly or through a top-level name it was computed into.
 *   `scripts/audit-scripts.mjs:229` is the second: `const failed =
 *   problems.length > 0 || process.exitCode === 1;` and then `if (!failed)`. The
 *   gate is not in the condition, which reads `!failed`; it is one line above,
 *   in what that word was computed from, which is why `bindings()` exists.
 *
 * MEASURED, and it corrects the count this repair was commissioned on: 7 of the
 * 20 audits import `finish` from `lib/report.mjs`, not 9, and all 7 of them
 * write `process.exitCode = finish({` — not 8 of 9. `scripts/lib/report.mjs` is
 * the only module in the repository that exports the name. With
 * `audit-scripts.mjs` reading its code back and `audit-records.mjs` naming its
 * gates in the ordinary way, compared goes 1 -> 9, and no audit was edited to
 * get there. MEASURED again after `scripts/audit-claims.mjs` was converted the
 * same day: 8 importers, 10 compared, and that one WAS edited — it is the file
 * the count was hiding.
 *
 * An excuse is only as sound as its precondition, and this one has a precondition
 * worth checking rather than assuming: `finish` decides from ITS sections. A
 * `process.exitCode = 1` set earlier in the same file is OVERWRITTEN by the
 * assignment — the run decides to fail and then leaves green, which is this
 * file's own defect arriving through the repair for it. `clobbersItsOwnDecision`
 * asks that of every audit; MEASURED, none of the eight writes `process.exitCode
 * = 1` anywhere, and `scripts/audit-book.mjs:45` is the near miss that is not
 * one, because `process.exit(1)` in a precondition leaves where it stands and is
 * never reached by a later assignment.
 *
 * MEASURED and NOT a clobber, though it is the first write of `process.exitCode`
 * in a converted audit that is not the assignment itself, so it is written down
 * rather than left for the next reader to rediscover as a surprise:
 * `scripts/audit-claims.mjs:398` is `if (unreadable.size > 0) process.exitCode =
 * 2;`, BELOW its own `finish` call. Three things make it sound where a 1 in the
 * same place would not be. It writes 2, which is a different question — was
 * there anything to measure — and not a second verdict on the sentence. It
 * stands after the call, so it cannot be erased by it; the direction of the
 * defect is a decision that a later assignment overwrites. And the section that
 * makes its condition true is a failing one, so `finish` has already returned 1
 * on every run that reaches the line: it raises, and can never lower. This
 * reader is deliberately not taught to spell any of that out — `ASSIGNS_THE_CODE`
 * reads `= 1` and this is not one, so the line is invisible to it by
 * construction rather than by exemption.
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
 * MEASURED and left standing, so the next round starts with it in prose rather
 * than in a green run: the eight files counted `vacuous` pass because this reader
 * saw no gate in them, not because they have none. SELF-ATTACK round 3 measured
 * the sharpest case from the excuse side — the whole-file excuse regex that stood
 * at :577 before this round (`HANDS_IT_OVER.test(text) || READS_THE_CODE.test(text)`)
 * does not match `scripts/audit-copies.mjs:291`, which is
 * `process.exit(fresh.length + rotted.length > 0 ? 1 : 0)`. So that file was never
 * excused; it was passed, which is weaker. `SETS_THE_CODE` reads `= 1` and
 * `process.exit(1)` and this is neither: the code is COMPUTED. `audit-copies.mjs`
 * therefore closes on a sentence with nothing held against it, and always has.
 * Unrepaired here on purpose. Reading a computed code means deciding what
 * `fresh.length + rotted.length > 0` is a gate over, and every way of doing that
 * without editing `scripts/` guesses — those files belong to other work this
 * round. It is a miss, not a false alarm, which is the direction to err in, and
 * `VACUOUS` below carries the same note where the classification is made.
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

/**
 * A `const`/`let`/`var` written at the top level, and what it was set to.
 *
 * Needed because the second correct way to write this is not a condition at
 * all: `scripts/audit-scripts.mjs:229` computes `const failed = problems.length
 * > 0 || process.exitCode === 1;` and then closes on `if (!failed)`. The gate
 * and the sentence are connected through a NAME, so a reader that only looks at
 * conditions sees `!failed` — a word it cannot hold against anything — and gives
 * up. Top level for the same reason `branches()` is: a binding inside a helper
 * is about one value it was handed.
 *
 * The window on the slice is a speed limit, not a rule: a declaration's head
 * (`const someName =`) is a few dozen characters, and slicing the whole tail of
 * a ten-thousand-character file at every offset is quadratic for no reading.
 */
function bindings(text: string): Array<{ name: string; init: string; at: number }> {
  const found: Array<{ name: string; init: string; at: number }> = [];
  const HEAD = /^(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=[^=]/;
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
    if (ch !== 'c' && ch !== 'l' && ch !== 'v') continue;
    if (at > 0 && /[A-Za-z0-9_$.]/.test(text[at - 1])) continue;

    const head = HEAD.exec(text.slice(at, at + 96));
    if (!head) continue;

    const from = at + head[0].length - 1;
    let end = from;
    let inner = 0;
    for (; end < text.length; end += 1) {
      const c = text[end];
      if (c === '(' || c === '{' || c === '[') inner += 1;
      else if (c === ')' || c === '}' || c === ']') inner -= 1;
      else if (c === ';' && inner === 0) break;
    }

    found.push({ name: head[1], init: text.slice(from, end), at });
    at = end;
  }

  return found;
}

/**
 * The keys written directly in an object literal, ignoring nested ones.
 *
 * Asked of one thing only — whether the object handed to the reporter carries an
 * `allClear`, which is the sentence the run closes on. Depth-counted from the
 * brace, so a key inside a section does not answer for the call.
 *
 * ASSUMED and harmless: a bare identifier standing before the `:` of a ternary
 * at the top level of the literal would be read as a key. Nothing is asked of
 * the key set except whether `allClear` is in it, and `allClear` is not a name
 * anything in these files branches on.
 */
function keysOf(text: string, brace: number): Set<string> {
  const end = closes(text, brace);
  const keys = new Set<string>();
  if (end === -1) return keys;
  let depth = 0;

  for (let at = brace + 1; at < end; at += 1) {
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
    if (at > brace + 1 && /[A-Za-z0-9_$.]/.test(text[at - 1])) continue;
    const key = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*:/.exec(text.slice(at, Math.min(end, at + 64)));
    if (!key) continue;
    keys.add(key[1]);
    at += key[0].length - 1;
  }

  return keys;
}

/** A binding named `finish` imported from somewhere. */
const IMPORTS_THE_REPORTER = /\bimport\s*\{[^}]*\bfinish\b[^}]*\}\s*from/;

/**
 * `process.exitCode =` standing immediately before an offset.
 *
 * Anchored with `$` against the source SLICED AT THE CALL, so it can only be
 * satisfied by the characters that actually precede that call. It is not a line
 * search: a `process.exitCode = finish({` written anywhere else in the file
 * cannot answer for this one, and a call spread over three lines answers for
 * itself.
 */
const ASSIGNED_TO_THE_CODE = /process\s*\.\s*exitCode\s*=\s*$/;

type ReporterCall = {
  /** Offset of the `finish` token, so ORDER against a closing sentence can be asked. */
  at: number;
  /** Whether what it returns is put into `process.exitCode`. */
  assigned: boolean;
  /** The keys of the object literal it was handed. */
  keys: Set<string>;
};

/**
 * Every call of the shared reporter, found structurally.
 *
 * The token `finish` is located, and everything after that is bracket matching:
 * the call's parentheses through `closes()`, the object literal inside them, its
 * top-level keys. A call whose argument is not an object literal — a variable, a
 * spread — comes back with no keys rather than being guessed at.
 *
 * The import itself is not a call: `import { finish } from ...` has `}` after
 * the token, not `(`.
 */
function reporterCalls(text: string): ReporterCall[] {
  const found: ReporterCall[] = [];
  const token = /\bfinish\b/g;
  let hit: RegExpExecArray | null;

  while ((hit = token.exec(text))) {
    const at = hit.index;
    let before = at - 1;
    while (before >= 0 && /\s/.test(text[before])) before -= 1;
    // `report.finish(` is a method of something else, not this module's export.
    if (before >= 0 && text[before] === '.') continue;

    let open = at + 'finish'.length;
    while (open < text.length && /\s/.test(text[open])) open += 1;
    if (text[open] !== '(') continue;
    const shut = closes(text, open);
    if (shut === -1) continue;

    let brace = open + 1;
    while (brace < shut && /\s/.test(text[brace])) brace += 1;

    found.push({
      at,
      assigned: ASSIGNED_TO_THE_CODE.test(text.slice(0, at)),
      keys: text[brace] === '{' ? keysOf(text, brace) : new Set<string>(),
    });
  }

  return found;
}

/**
 * The call whose all-clear the module is answering for.
 *
 * `scripts/lib/report.mjs:101` is `finish({ sections, allClear })` returning
 * `0 | 1`, and its :51 states the contract in as many words: a caller writing
 * `process.exitCode = finish(...)` cannot disagree with its own last line. Both
 * halves have to be there. The `allClear` is the sentence — without it the
 * module prints no verdict at all and there is nothing to be wrong. The
 * assignment is the gate — a run that computes the code and drops it has decided
 * nothing.
 */
const governingReporterCall = (text: string): ReporterCall | null =>
  reporterCalls(text).find((call) => call.assigned && call.keys.has('allClear')) ?? null;

/**
 * A decision to fail that the reporter's own assignment erases.
 *
 * The excuse granted below is that the module decides the sentence and the code
 * together — but it decides them from ITS sections only. `process.exitCode = 1`
 * set earlier in the file, then `process.exitCode = finish(...)` returning 0
 * because no failing section spoke, is that same 1 overwritten: the run leaves
 * green having decided to fail. That is this file's own defect, arriving through
 * the repair for it, so the precondition of the excuse is checked rather than
 * assumed.
 *
 * MEASURED on 2026-08-06: none of the eight audits that hand their sections over
 * writes `process.exitCode = 1` at all, so this names nobody today.
 * `scripts/audit-book.mjs:45` is the near miss and is not one —
 * `process.exit(1)` in a precondition leaves where it stands and is never
 * reached by a later assignment. `scripts/audit-claims.mjs:398` is the other,
 * and is not one either: it writes 2, below the call rather than above it, on a
 * condition whose own section is failing — so it raises a code `finish` had
 * already set to 1. The header says why in full.
 */
function clobbersItsOwnDecision(text: string): boolean {
  const call = governingReporterCall(text);
  return call !== null && ASSIGNS_THE_CODE.test(text.slice(0, call.at));
}

/** How a closing sentence is connected to the decision to fail, when no condition names it. */
type SharedGate = {
  /** Offset of the sentence, for the same order question every other gate is asked. */
  at: number;
  /** What to print in the ledger: the gate, in the file's own spelling. */
  what: string;
};

/**
 * The two ways a file can be governed without a condition this reader can name.
 *
 * Both used to be an excuse — one `NOT_HELD` entry reading 'hands its sections
 * to the reporter, or reads the exit code back' — and that was the largest
 * silence in this check: MEASURED before the repair, 1 of 20 audits was compared
 * and 8 of the 11 not held left by this door. The excuse was also the wrong way
 * round. Handing the sections over is not a reason the sentence cannot be
 * checked; it is the strongest gate in the directory, written once in a module
 * instead of seven times by hand. A reader that skips exactly the files that got
 * it right, and then prints how many it compared, prints 1.
 *
 * The order rule is the same one `ASSIGNS_THE_CODE` explains: whichever of these
 * prints last is the sentence the run ends on, so a shared gate standing ABOVE
 * an emptiness-shaped closing sentence does not answer for it. MEASURED: every
 * one of the seven reporter calls is the last top-level statement of its file,
 * and `scripts/audit-book.mjs:43` — the one emptiness-shaped `if` that stands in
 * such a file — is above the call and prints through `console.error`, so it is
 * not a closer either way.
 *
 * MEASURED again with the eighth, `scripts/audit-claims.mjs`, which is the first
 * converted audit whose `finish` call is NOT the last top-level statement: an
 * `if (unreadable.size > 0) process.exitCode = 2;` follows it. The order rule is
 * unaffected, because that line prints nothing — a statement that says nothing
 * cannot be the sentence a run ends on. The two emptiness-shaped conditions left
 * in that file are the arms of one `if / else if` that pushes its sentences into
 * a section rather than printing them, so `closers` rejects them twice over and
 * the call answers for a file with no closer at all.
 */
function sharedGate(text: string, all: Branch[], closer: Branch | null): SharedGate | null {
  const call = governingReporterCall(text);
  if (call !== null && (closer === null || call.at > closer.at))
    return { at: call.at, what: 'process.exitCode = finish({ allClear, sections })' };

  // The read-back: the closing sentence asks the exit code itself, either in its
  // own condition or through a name it was computed into. Every gate spelled
  // `process.exitCode = 1` above it is therefore in that question by
  // construction, whatever it was named.
  const reads = bindings(text).filter((one) => READS_THE_CODE.test(one.init));
  let last: SharedGate | null = null;
  for (const branch of all) {
    if (!branch.whole.includes('console.log')) continue;
    if (READS_THE_CODE.test(branch.condition)) {
      last = { at: branch.at, what: 'closes on process.exitCode === 1, read back directly' };
      continue;
    }
    const names = subjects(branch.condition);
    const via = reads.find((one) => one.at < branch.at && names.has(one.name));
    if (via) last = { at: branch.at, what: `closes on \`${via.name}\`, which reads process.exitCode back` };
  }
  if (last !== null && (closer === null || last.at > closer.at)) return last;

  return null;
}

type Reading = {
  gates: Set<string>;
  closing: Set<string> | null;
  /** The shared gate, when the sentence is connected to the code by something other than a name. */
  shared: SharedGate | null;
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

  const shared = sharedGate(text, all, closer);
  const ungoverned =
    shared !== null || closing === null
      ? []
      : [...gates].filter((name) => !closing.has(name));

  return { gates, closing, shared, ungoverned };
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
  if (reading.shared !== null) return null;
  if (reading.closing !== null) return null;

  const shaped = branches(blanked(source)).filter((branch) => isAllClearShaped(branch.condition));
  if (shaped.length === 0) return NOT_HELD.noEmptiness;
  if (shaped.every(hasFurtherArms)) return NOT_HELD.furtherArms;
  if (shaped.every((branch) => !branch.consequent.includes('console.log'))) return NOT_HELD.silent;
  if (shaped.every((branch) => branch.consequent.includes('process.exitCode')))
    return NOT_HELD.setsCode;
  return NOT_HELD.unclassified;
}

/**
 * A file whose closing sentence was found and whose gates were not.
 *
 * The honest half of a green run, and the one hole this round deliberately left
 * standing. `SETS_THE_CODE` reads two spellings of a decision to fail and
 * `audit-copies.mjs:291` writes a third — `process.exit(fresh.length +
 * rotted.length > 0 ? 1 : 0)`, a code that is COMPUTED — so that file's gates
 * come out empty and its all-clear is compared against nothing. SELF-ATTACK
 * round 3 measured the same thing from the other side: the whole-file excuse
 * that used to stand at the foot of `read()` never matched that line either, so
 * the excuse was weaker than it looked and the pass was vacuous rather than
 * excused. Unrepaired here on purpose: reading a computed code means deciding
 * what `fresh.length + rotted.length > 0` is a gate over, and the alternatives
 * that do not require editing `scripts/` all guess.
 */
const VACUOUS = 'held to its closing sentence, but this reader could see no gate to hold against it';

/**
 * Every audit this reader cannot connect to a gate, with why — the other half of
 * the floor below.
 *
 * This is a roster, which the header above argues against, and the difference is
 * the direction it points. `NOT_HELD` is derived per run because a roster that
 * EXCUSES goes stale into a licence. This one excuses nothing: every reason in
 * it is re-derived from the source on every run and compared, so a file that
 * changes shape fails here instead of being covered for. It exists because the
 * number it replaces — `compared.length > 0` — was satisfied by one file out of
 * twenty for as long as it stood.
 */
const NOT_CONNECTED: Readonly<Record<string, string>> = {
  'audit-configs.mjs': VACUOUS,
  'audit-copies.mjs': VACUOUS,
  'audit-dataset.mjs': VACUOUS,
  'audit-deployment.mjs': NOT_HELD.noEmptiness,
  'audit-drawings.mjs': VACUOUS,
  'audit-mutants.mjs': VACUOUS,
  'audit-podlock.mjs': VACUOUS,
  'audit-reachable.mjs': VACUOUS,
  // Not `process.exitCode = finish(...)`, and deliberately: it reports on a
  // remote process, so it has a state a file-reading audit has not got —
  // *nothing was established*. `finish` knows 0 and 1; this splits the 1 into
  // *the answer is no* (1) and *there was no answer* (2). The two cannot drift
  // apart unnoticed, because the script throws if `finish` printed an
  // all-clear for a verdict that was not `serving`.
  'audit-serving.mjs': NOT_HELD.noEmptiness,
  'audit-variants.mjs': VACUOUS,
  'audit-whose.mjs': NOT_HELD.furtherArms,
};

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
      const gate =
        reading.shared !== null
          ? reading.shared.what
          : reading.gates.size > 0
            ? `${reading.gates.size} gate name(s)`
            : null;
      return { name, why, gate };
    });

    const compared = ledger.filter((one) => one.why === null && one.gate !== null);
    const vacuous = ledger.filter((one) => one.why === null && one.gate === null);
    const skipped = ledger.filter((one) => one.why !== null);

    console.log(
      `\na closing sentence nothing governs: ${audits.length} audit(s) on disk, ` +
        `${compared.length} compared, ${vacuous.length} held but with no gate this reader could see, ` +
        `${skipped.length} not held.`,
    );
    for (const one of compared) console.log(`  compared  ${one.name} (${one.gate})`);
    for (const one of vacuous) console.log(`  vacuous   ${one.name}`);
    for (const one of skipped) console.log(`  not held  ${one.name} — ${one.why}`);

    // Every file is accounted for exactly once, and none of it by accident.
    expect(compared.length + vacuous.length + skipped.length).toBe(audits.length);

    // No file may be skipped for a reason this file does not name in prose.
    const named = new Set<string>(Object.values(NOT_HELD));
    expect(
      skipped.filter((one) => !named.has(one.why!) || one.why === NOT_HELD.unclassified),
    ).toEqual([]);

    // THE FLOOR, and it is a shape rather than a number: whatever this directory
    // holds, an audit that goes through the shared reporter is held to its own
    // closing sentence. It replaces `compared.length > 0`, which one file
    // satisfied forever — and did, for as long as that line stood: 20 on disk,
    // 1 compared, green.
    const held = new Set(compared.map((one) => one.name));
    const throughTheReporter = audits.filter(
      ({ source }) => governingReporterCall(blanked(source)) !== null,
    );
    expect(
      throughTheReporter.map(({ name }) => name).filter((name) => !held.has(name)),
      'hands its sections to the reporter and is still not held to the sentence the reporter prints',
    ).toEqual([]);

    // The excuse is only sound while nothing else in the file touches the code:
    // `finish` decides from its own sections, so an earlier decision to fail is
    // overwritten by the assignment that grants the excuse.
    expect(
      audits
        .filter(({ source }) => clobbersItsOwnDecision(blanked(source)))
        .map(({ name }) => name),
      'decides to fail and then overwrites that decision with what the reporter returned',
    ).toEqual([]);

    // And the other half of the floor: the files this reader cannot connect to
    // any gate are exactly these, for exactly these reasons. Not an excuse list
    // — the reason is re-derived above and compared, so an entry that stops
    // being true fails here rather than quietly covering for a file. A new audit
    // that arrives unheld, or a held one that drops out, turns this red and
    // names itself; that is the tracking a count cannot do.
    const unconnected = Object.fromEntries(
      [...vacuous, ...skipped].map((one) => [one.name, one.why ?? VACUOUS]).sort(),
    );
    expect(unconnected, 'the audits with no gate this reader can see').toEqual(NOT_CONNECTED);
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
    /**
     * Whether the sentence is connected to the code by something other than a
     * name this reader can read — the reporter, or the code read back. Written
     * where the shape is what the fixture is for, so that granting the excuse
     * and refusing it are both asserted rather than one of them.
     */
    shared?: boolean;
    /** Whether the reporter's own assignment overwrites a decision taken above it. */
    clobbers?: boolean;
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
      // Held, not excused, and the difference is the whole of this round. The
      // module decides the sentence and the code in one place, which is a
      // stronger gate than any of the seven hand-written ones — so this is
      // `compared`, and the assignment is the gate.
      what: 'the sections handed to the reporter instead',
      ungoverned: false,
      shared: true,
      // And the shape it is only safe to grant that to. See
      // `clobbersItsOwnDecision`: the 1 set above is overwritten by whatever
      // `finish` returns, so this source decides to fail and then leaves green.
      // No audit on disk does this; the guard over the directory is asserted
      // empty, and this fixture is the evidence that it fires at all.
      clobbers: true,
      source: `
        if (stale.length > 0) process.exitCode = 1;
        process.exitCode = finish({
          allClear: 'all of it is fine',
          sections: [{ failing: true, lines: missing }],
        });
      `,
    },
    {
      // The same call with nothing above it to overwrite. `finish` is the only
      // thing that decides, which is what the seven audits on disk look like.
      what: 'the sections handed to the reporter, and nothing else touching the code',
      ungoverned: false,
      shared: true,
      clobbers: false,
      source: `
        process.exitCode = finish({
          allClear: 'all of it is fine',
          sections: [{ failing: true, lines: missing }, { failing: true, lines: stale }],
        });
      `,
    },
    {
      // The call is there and the excuse is not, because the guarantee is in
      // what the caller does with the answer. `finish` computes a code and this
      // drops it on the floor; the run leaves green whatever the sections said,
      // and the sentence below is the file's own to be wrong about. This is the
      // shape the excuse used to cover: any file mentioning `finish(` anywhere.
      what: 'the reporter called and its answer thrown away',
      ungoverned: true,
      names: ['stale'],
      shared: false,
      source: `
        if (stale.length > 0) {
          console.log('these are stale');
          process.exitCode = 1;
        }
        finish({ allClear: 'the sections are clean', sections: [{ failing: true, lines: missing }] });
        if (missing.length === 0) {
          console.log('nothing is missing');
        }
      `,
    },
    {
      // Assigned, and still not it: with no `allClear` the module prints no
      // verdict, so it is answering for no sentence. The one on screen was
      // printed by this file and is held to this file's gates.
      what: 'the reporter handed sections but no sentence',
      ungoverned: true,
      names: ['stale'],
      shared: false,
      source: `
        if (stale.length > 0) {
          console.log('these are stale');
          process.exitCode = 1;
        }
        process.exitCode = finish({
          sections: [{ failing: true, lines: missing }],
        });
        if (missing.length === 0) {
          console.log('nothing is missing');
        }
      `,
    },
    {
      // Order, the same rule `ASSIGNS_THE_CODE` explains one way round. The
      // module's sentence is not the last one on screen here, so its guarantee
      // is not a guarantee about the sentence the run ended on.
      what: 'the reporter printing, and then a sentence of the file own below it',
      ungoverned: false,
      names: [],
      shared: false,
      source: `
        process.exitCode = finish({
          allClear: 'the sections are clean',
          sections: [{ failing: true, lines: stale }],
        });
        if (missing.length === 0) {
          console.log('and nothing is missing either');
        }
      `,
    },
    {
      // The other connection, and the reason it cannot be read off a condition:
      // the closing sentence asks `!failed`, a word with no gate in it. The gate
      // is one line up, in what `failed` was computed from. MEASURED shape of
      // `scripts/audit-scripts.mjs:229`, the file the repair was written in and
      // never carried out of.
      what: 'the exit code read back into the condition',
      ungoverned: false,
      shared: true,
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
    // Three questions in one `it`, and the reason is a number published
    // elsewhere: README's per-package table gives `@leela/content` a count and
    // `scripts/audit-claims.mjs` holds the table to the suites, so a new `it` in
    // this package turns that audit red in a file this round does not own. The
    // assertions are therefore labelled rather than split, and a failure still
    // says which of the three it was.
    for (const fixture of fixtures) {
      const reading = read(fixture.source);
      expect(reading.ungoverned.length > 0, fixture.what).toBe(fixture.ungoverned);

      // Held is not excused, and that distinction is the whole of this round.
      // `finish(` used to be an excuse granted to any file that mentioned it, so
      // the seven files that had done the right thing were seven of the files
      // the check refused to look at. The two fixtures that call the reporter
      // WITHOUT the guarantee — the answer dropped, the sentence absent — have
      // to come back unheld, or 'held' is the old excuse under a better name.
      if (fixture.shared !== undefined)
        expect(reading.shared !== null, `${fixture.what}: shared gate`).toBe(fixture.shared);

      // The precondition of that excuse, asserted on a source that breaks it,
      // because a guard nobody has watched fail is not evidence. Over the real
      // directory the same function is asserted to name nobody.
      if (fixture.clobbers !== undefined)
        expect(
          clobbersItsOwnDecision(blanked(fixture.source)),
          `${fixture.what}: overwrites its own decision`,
        ).toBe(fixture.clobbers);
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
