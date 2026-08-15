import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { workspacePackages } from '../../../scripts/lib/claims.mjs';
import { blank, callsTo } from '../../../scripts/lib/source.mjs';

/**
 * Reading a source file in a check.
 *
 * A dozen tests in this repository assert things about source rather than about
 * behaviour, and they are how most of the defects in the last twenty passes were
 * found. They are also where the mistakes have been: four in one night, all of
 * one shape — a pattern that reads the file as text without knowing what text
 * is. Twice it accused code that was right; twice it would have let a defect
 * through.
 *
 * So the two operations they share live in one place. This is that place's own
 * test, and it matters more than most: everything else rests on it.
 *
 * **What is swept, and what used to be.** The claim above is about *this
 * repository*, and the sweep under `one blanker, not five` walked
 * `join(HERE, '..', '..')` — which is `apps/`. Half a repository: 120 test
 * files seen, 79 in `packages/` not. Replaying its own two patterns over the
 * half it could not see named three files, one of them a hand-rolled blanker
 * that removes rather than blanks. A rule stated over a repository and run over
 * a directory is the shape this file exists to close, written into the file
 * that closes it.
 *
 * The set now comes from `workspacePackages` in `scripts/lib/claims.mjs`, which
 * exists for exactly this: the paragraph above it records four hand-kept source
 * lists that were wrong, two of them by *omission*, which is the kind that
 * reads as a pass. Measured on the day it changed: the same 120 files as
 * before, and 79 more.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
/** The repository, which is what the sweeps below are stated over. */
const REPO = join(HERE, '..', '..', '..');
const APP = readFileSync(join(HERE, '..', 'src', 'App.tsx'), 'utf8');

describe('blanking a comment', () => {
  it('leaves an index into the result an index into the file', () => {
    /**
     * The mistake that reported a defect in code carrying the very explanation
     * it demanded: writes were found in a stripped copy and their reasons read
     * out of the original, at positions that had drifted apart by every comment
     * between.
     */
    const source = 'const a = 1;\n/* a comment\n   over two lines */\nconst b = 2;\n';

    expect(blank(source)).toHaveLength(source.length);
    expect(blank(source).split('\n')).toHaveLength(source.split('\n').length);
    expect(blank(source).indexOf('const b')).toBe(source.indexOf('const b'));
  });

  it('takes out what a comment says, so prose cannot be read as code', () => {
    // These files document the defects they fixed. A comment saying *this used
    // to be `resolveLanguage(undefined)`* reads to a regular expression exactly
    // like the defect still being there.
    const source = "// this used to be resolveLanguage(undefined)\nconst x = resolveLanguage(deviceLocale());";

    expect(blank(source)).not.toContain('resolveLanguage(undefined)');
    expect(blank(source)).toContain('resolveLanguage(deviceLocale())');
  });

  it('does not mistake a URL for a comment', () => {
    const source = "const home = 'https://t27.ai/leela/';";
    expect(blank(source)).toBe(source);
  });

  it('leaves what a string says, because a check may forbid a sentence', () => {
    const source = "const said = 'The 72 plans';";
    expect(blank(source)).toContain('The 72 plans');
  });

  it('blanks a real file down to less than it was, and no shorter', () => {
    // The guard against a blanker that does nothing: `App.tsx` is more comment
    // than most files, so the two lengths must be equal and the content not.
    expect(blank(APP)).toHaveLength(APP.length);
    expect(blank(APP).replace(/\s/g, '')).not.toBe(APP.replace(/\s/g, ''));
    expect(blank(APP).replace(/\s/g, '').length).toBeLessThan(APP.replace(/\s/g, '').length);
  });
});

describe('finding a call', () => {
  it('reads past a bracket closed inside its own arguments', () => {
    /**
     * The mistake three checks made. `now()`, `asking.trim()` and
     * `plansFor(language)[0]` all close a bracket inside an argument list, and
     * `[^)]*` or `[^;]*?` stops at the first one — so the check reads a shorter
     * call than the one written and accuses correct code.
     */
    const source = 'commands.roll(room, who.id, now(), asked);';

    expect(callsTo(source, 'commands.roll')[0].args).toBe('room, who.id, now(), asked');
  });

  it('reads a call that spans lines', () => {
    const source = 'keepIntention(\n  intentionKeeper,\n  asking.trim(),\n);';
    expect(callsTo(source, 'keepIntention')[0].args).toContain('asking.trim()');
  });

  it('finds every one of them, and only them', () => {
    const source = 'roll(a); unroll(b); roll(c);';
    const calls = callsTo(source, 'roll');

    expect(calls.map((call) => call.args)).toEqual(['a', 'c']);
  });

  it('does not count a call quoted in a comment', () => {
    // The other half of the same rule: a file explaining what it stopped doing
    // must not be read as still doing it.
    const source = '// this was roll(room, id)\nroll(room, id, now(), asked);';
    const calls = callsTo(source, 'roll');

    expect(calls).toHaveLength(1);
    expect(calls[0].args).toContain('asked');
  });

  it('says so rather than returning half a call', () => {
    expect(() => callsTo('roll(a, b', 'roll')).toThrow(/never closed/);
  });

  it('reads what a regular expression read short', () => {
    /**
     * The live one, and the reason this exists rather than being written for a
     * rainy day. `reader.test.ts` matched `resolveLanguage\(([^)]*)\)` over the
     * screen and captured **`deviceLocale(`** — the call truncated at the
     * bracket inside it — then asserted that the truncation did not start with
     * a quote. It passed, on a reading of half a call.
     */
    const source = 'const language = resolveLanguage(deviceLocale());';
    const short = [...source.matchAll(/resolveLanguage\(([^)]*)\)/g)].map(([, args]) => args);

    expect(short, 'what the pattern read').toEqual(['deviceLocale(']);
    expect(callsTo(source, 'resolveLanguage')[0].args, 'what is written').toBe('deviceLocale()');
  });

  it('finds the real calls in the real screen', () => {
    // Over the file rather than a fixture: a helper that works on examples and
    // not on the thing it was written for is worth nothing.
    const kept = callsTo(APP, 'keepDraft');

    expect(kept.length).toBeGreaterThan(0);
    for (const call of kept) expect(call.args).toContain('draftKeeper');
  });
});

/**
 * The documents that are run or produced rather than asserted over, each with
 * the ground it is excused on — and the ground is checked.
 *
 * Two things were wrong with the list this replaces. It named files by their
 * **basename** and matched with `endsWith`, so one waiver covered every file
 * of that name: `the-end-of-a-game.test.ts` is written three times in this
 * repository, and naming the mini app's excused the bot's and the phone's as
 * well. And its own comment promised *"has to exist and has to be one that
 * loads a document"* while the code checked only that it existed — the shape
 * `audit-whose` was caught by the pass before, where a waiver said something
 * nothing read back.
 *
 * `runs` means the markup goes into a live document, which is what makes
 * blanking wrong: it would alter the thing under test. `built` means the file
 * reads pages a build has just produced into a directory of its own — an
 * artefact rather than source, and a comment in one is not a developer's note
 * that could pass for markup.
 */
const EXCUSED: Array<{ file: string; because: 'runs' | 'built' }> = [
  { file: 'apps/miniapp/tests/assembled.test.ts', because: 'runs' },
  { file: 'apps/miniapp/tests/partly-written.test.ts', because: 'runs' },
  { file: 'apps/miniapp/tests/which-square-is-mine.test.ts', because: 'runs' },
  { file: 'apps/miniapp/tests/the-end-of-a-game.test.ts', because: 'runs' },
  { file: 'apps/miniapp/tests/the-same-seat-asked-three-times.test.ts', because: 'runs' },
  { file: 'apps/miniapp/tests/a-copy-of-whose-path.test.ts', because: 'runs' },
  { file: 'apps/docs/tests/build.test.ts', because: 'built' },
];

/**
 * And the files that blank for themselves, each on a ground the shared blanker
 * cannot meet.
 *
 * A separate list rather than two more entries above, because these are excused
 * from a different rule: they may write their own blanker, not read a source
 * raw. Folding the two lists would hand each file the other's waiver.
 *
 * `records.test.ts` builds a *mutant* of a source file — it deletes the lines
 * on which a name appears and asserts the deletion is noticed — and needs one
 * array entry per line of the original to do it. Its own paragraph is the
 * ground and states the reason `blank` will not serve: `codeIn` replaces a
 * block comment with a single space, so a nine-line doc-comment becomes one
 * character and every line number after it moves. It blanks a block comment
 * **in place** instead, which is the very property this rule is about, arrived
 * at for a different purpose. Its paragraph also says which way a disagreement
 * with the shared reader falls: blank too much and the mutant loses an
 * occurrence and the row fails; blank too little and a live line survives and
 * the first assertion goes red. A copy that has thought about being a copy.
 *
 * And the other kind: a file that keeps the discredited reader as the *control*
 * it is measured against. `one-set-of-flags.test.ts` used
 * `.replace(/\/\*[\s\S]*?\*\//g, '')` to read a tsconfig for as long as it has
 * existed — a strip that removes rather than blanks — and the pass that
 * replaced it with the shared blanker put the old one back beside it, over a
 * fixture, to show what the two answers are. That is this repository's own
 * rule: an assertion nobody has seen fail is not evidence. It is the same
 * exception this file takes for itself in the sweep below — `file !==
 * join(HERE, 'source.test.ts')`, because the mistaken patterns are written out
 * here to prove they are mistaken; the difference is that this one is named and
 * grounded rather than spelled as a filename comparison.
 */
const HAND_ROLLED: Array<{ file: string; because: 'aligned' | 'measured' }> = [
  { file: 'packages/content/tests/records.test.ts', because: 'aligned' },
  { file: 'packages/engine/tests/one-set-of-flags.test.ts', because: 'measured' },
];

/** The four grounds, as something a file either does or does not do. */
const GROUNDS = {
  runs: (source: string) => /document\.body\.innerHTML\s*=/.test(source),
  built: (source: string) => /mkdtempSync\(/.test(source),
  // Not *it says it is careful* but *it is*: the replacement maps every
  // character that is not a newline to a space, so the copy keeps the line
  // count it was excused for keeping. A waiver written over a blanker that
  // removes — which is the mistake — fails here.
  aligned: (source: string) => /=>\s*\w+\.replace\(\/\[\^\\n\]\/g, ' '\)/.test(source),
  // A control reads nothing. Every file this one opens goes through the shared
  // blanker, so the copy it keeps is applied to a literal and cannot be what
  // the file learns anything from. The day somebody points the old strip at a
  // real file to save an import, this waiver stops holding.
  measured: (source: string) => {
    const reads = [...source.matchAll(/readFileSync\(/g)].length;
    const through = [...source.matchAll(/blank\(\s*readFileSync\(/g)].length;

    return reads > 0 && reads === through;
  },
};

const listed = (list: Array<{ file: string }>, file: string) => {
  // Absolute in one sweep and repo-relative in the other, so the entry is
  // matched as a whole path or as a tail of one — never as a bare name, which
  // is what let a single waiver cover three files.
  const path = file.replace(/\\/g, '/');
  return list.some((one) => path === one.file || path.endsWith(`/${one.file}`));
};

const excused = (file: string) => listed(EXCUSED, file);

describe('one blanker, not five', () => {
  /**
   * Every check that reads source uses the shared one. It was written by hand
   * four times in four files, and three of those four were wrong in a way that
   * mattered: one blanked `*` and left the prose, one lost the offsets, one had
   * no blanking at all and read a comment as code.
   *
   * Proven rather than argued: with the real `startOver(game, startingSeed())`
   * replaced by a comment mentioning it, `starting-over.test.ts` **passes**
   * without blanking and **fails** with it. Nine checks were one comment away
   * from asserting nothing.
   *
   * Over every workspace the repository has, asked for rather than written
   * down. `join(HERE, '..', '..')` is `apps/`, and a rule whose header says
   * *this repository* ran over half of it for as long as it has existed —
   * `packages/` holds 79 of the 199 test files and none of them were read.
   * `workspacePackages` is the answer four hand-kept lists got wrong before it
   * existed, and it is one import away from anything that needs it.
   */
  const WORKSPACES = workspacePackages({
    exists: (path: string) => existsSync(join(REPO, path)),
    entries: (path: string) => readdirSync(join(REPO, path)),
    isDirectory: (path: string) => statSync(join(REPO, path)).isDirectory(),
  }) as Array<{ path: string; src: string; tests: string | null }>;

  /** Every test file in the workspace, by walking rather than by listing. */
  function testFiles(from: string): string[] {
    return readdirSync(from, { withFileTypes: true }).flatMap((entry) => {
      const path = join(from, entry.name);
      if (entry.isDirectory()) {
        return entry.name === 'node_modules' || entry.name === 'dist'
          ? []
          : testFiles(path);
      }
      return entry.name.endsWith('.test.ts') ? [path] : [];
    });
  }

  const files = WORKSPACES.flatMap((workspace) =>
    workspace.tests ? testFiles(join(REPO, workspace.tests)) : [],
  );

  /** What a failure prints: the path a reader can open, from the repository. */
  const here = (file: string) => relative(REPO, file).replace(/\\/g, '/');

  it('finds the tests at all, or this proves nothing', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('reaches the workspaces that are not this one, which is the point', () => {
    // The half that was missing, asserted as a shape rather than as a count:
    // every workspace with tests contributes to the sweep, so a package added
    // tomorrow is swept without anybody remembering this file. The old root
    // could not have satisfied this — `packages/` was not under it.
    const swept = new Set(files.map((file) => here(file).split('/').slice(0, 2).join('/')));

    expect(
      WORKSPACES.filter((workspace) => workspace.tests).map((workspace) => workspace.path).sort(),
    ).toEqual([...swept].sort());
    expect(swept.size).toBeGreaterThan(2);
  });

  it('leaves nobody writing their own', () => {
    const own = files.filter((file) => {
      // Blanked before it is matched, by the rule it is enforcing. A file that
      // writes a paragraph about the strip it stopped using — which is what
      // `one-set-of-flags.test.ts` now does, at length — is not a file that
      // uses one, and a check that cannot tell the two apart is a check
      // somebody deletes rather than obeys.
      //
      // MEASURED: over the tree today this changes no answer at all. Both
      // readings name the same two files, and both of those are named in code.
      // It is here for the accusation it will not make later.
      const source = blank(readFileSync(file, 'utf8'));
      // A local blanker: a replace over the comment syntax, in a file that is
      // not the shared module's own test and is not excused for needing one.
      return (
        file !== join(HERE, 'source.test.ts') &&
        !listed(HAND_ROLLED, here(file)) &&
        /replace\(\/\\\/\\\*/.test(source)
      );
    });

    expect(own.map(here)).toEqual([]);
  });

  /**
   * A check that *runs* a document rather than asserting about it.
   *
   * These load `index.html` into happy-dom and play the app through it. Blanking
   * would alter the thing under test, which is the opposite of what it is for —
   * so the rule is about **asserting** over source, and the exception is named
   * rather than left to a pattern to miss.
   */


  /**
   * How this sweep recognises a read of a source file.
   *
   * Hoisted out of the check below so it can be asked a question of its own —
   * see the test after it, which is about what this pattern cannot see.
   */
  const READS = /readFileSync\([^)]*['"`][^'"`]*(src|index\.html)/;

  it('makes every check that asserts over source blank it first', () => {
    /**
     * The shape. A check that reads `src/` and asserts over the text has to see
     * code and not prose — and the ones that did not were not wrong today, they
     * were wrong on the next comment somebody wrote. Ten of them.
     */
    const unblanked = files.filter((file) => {
      if (excused(file)) return false;

      const source = readFileSync(file, 'utf8');
      return READS.test(source) && !source.includes('blank(') && !source.includes('blank as code');
    });

    expect(unblanked.map(here)).toEqual([]);
  });

  /**
   * The second thing this sweep cannot see, found by widening it and measured
   * before it was written down.
   *
   * The escape above is `source.includes('blank(')` over the **raw** file, so a
   * file that only *mentions* the blanker in prose satisfies it. Read the same
   * way the rule itself demands — blanked first — and the sweep names
   * `packages/engine/tests/every-rule-is-asked.test.ts`, which reads
   * `packages/engine/src/rulesets.ts` and every source under `apps/` and
   * `packages/` raw, and whose only `blank(` is in its header.
   *
   * And it is **not** a defect there, which is the half worth writing down.
   * That file hands its sources to `readsOf` from `scripts/lib/unread.mjs`,
   * which skips comment lines itself, and its header says in so many words that
   * blanking was tried and rejected — `blank` keeps what a string SAYS, so an
   * audit citing a field name still reads as a program reading it. It delegates
   * the comment question rather than ignoring it.
   *
   * So the sweep would be right about the letter and wrong about the file, and
   * tightening it here would turn a suite this change does not own red over a
   * decision that file argues for at length. Pinned at its measured size
   * instead, over fixtures, so closing it is a deliberate act with a red test
   * in front of it — the same treatment the gap above gets.
   */
  it('takes a mention of the blanker for a use of it, which is a gap', () => {
    const raw = (source: string) =>
      READS.test(source) && !source.includes('blank(') && !source.includes('blank as code');

    // One file that reads a source and hands it to a reader of its own that
    // handles comments; one that reads a source and matches over it. The escape
    // cannot tell them apart, because both spell `blank(` in prose.
    //
    // Written as expressions rather than as `const text = readFileSync(…)`, and
    // that is a measurement rather than a style: the first draft used the
    // declaration form and the repo-wide sweep further down this file named
    // **this file** for it. `blank` keeps what a string says — deliberately,
    // for checks that forbid a sentence — so example code inside a fixture
    // string reads to that sweep exactly like code. A third blind spot of the
    // same family, found by tripping it.
    const delegates = "/** blank() keeps what a string says, so readsOf is used instead. */\nreadsOf(field, [readFileSync(join(ROOT, 'src', 'rulesets.ts'), 'utf8')]);";
    const pretends = "// blank( is what this ought to use\nawait check(readFileSync(join(ROOT, 'src', 'rulesets.ts'), 'utf8'));";

    expect({ delegates: raw(delegates), pretends: raw(pretends) }).toEqual({
      delegates: false,
      pretends: false,
    });
  });

  /**
   * And a read the sweep above cannot see, pinned at its measured size.
   *
   * MEASURED, and it is the reason this rule found nothing in `bot.test.ts` for
   * as long as both have existed. `registered()` there read `src/bot.ts` and
   * matched `bot.command\('([a-z]+)'` over it with no blanking at all — exactly
   * the defect this sweep is for — and the sweep reported all clear, because
   * the read was spelled `readFileSync(resolve(process.cwd(), 'src/bot.ts'))`
   * and `[^)]*` stops at the bracket that closes `process.cwd()`, before the
   * quote it needs to find. Two spellings of one read: one the rule polices,
   * one it is blind to. The file was only ever named on the day its path was
   * anchored to `import.meta.url` — the fix made it visible, not defective.
   *
   * So the check that exists to stop a comment being read as code was itself
   * one bracket away from asserting nothing, and the way out of it was a
   * spelling nobody chose for that reason.
   *
   * Left open on purpose rather than papered over, and the reason is a boundary
   * rather than a judgement: widening the pattern to `[^;]*?` names
   * `apps/miniapp/tests/reports.test.ts`, which reads source and does not blank
   * it — a real find, in a file this change does not own. It is a defect to
   * close with that file in hand, not one to close by making somebody else's
   * suite red. This test holds the gap to its size in the meantime: closing it
   * is a deliberate act with a red test in front of it, and this comment says
   * what to expect when it goes red.
   */
  it('is blind to a read spelled through the working directory, which is a defect', () => {
    // The same read of the same file, written the two ways this repository
    // writes it. Over fixtures rather than over the tree, so this names nobody
    // and cannot go red because somebody moved a file.
    const anchored = "const source = readFileSync(new URL('../src/bot.ts', import.meta.url), 'utf8');";
    const throughCwd = "const source = readFileSync(resolve(process.cwd(), 'src/bot.ts'), 'utf8');";

    expect({ anchored: READS.test(anchored), throughCwd: READS.test(throughCwd) }).toEqual({
      anchored: true,
      throughCwd: false,
    });
  });

  /**
   * Both lists, held to the same two rules.
   *
   * Written over `[...EXCUSED, ...HAND_ROLLED]` rather than once per list,
   * because a second copy of a waiver check is a second place for a list to be
   * added and the check not to be — which is the omission this whole pass is
   * about, one level up.
   */
  const WAIVERS = [...EXCUSED, ...HAND_ROLLED];

  it('names one file each, and only files that exist', () => {
    // A name that matches nothing is a waiver for a file somebody deleted, and
    // a name that matches two is a waiver somebody else inherited.
    for (const one of WAIVERS) {
      const matches = files.filter((file) => file.replace(/\\/g, '/').endsWith(`/${one.file}`));
      expect(matches.length, one.file).toBe(1);
    }
  });

  it('excuses each of them on a ground it can be seen to have', () => {
    // The half the comment promised and the code did not do. A file added here
    // to quiet the rule, while asserting over source like everything else, is
    // the waiver-shaped defect this repository has now met twice.
    const wrong: string[] = [];

    for (const one of WAIVERS) {
      const match = files.find((file) => file.replace(/\\/g, '/').endsWith(`/${one.file}`));
      if (!match) continue;

      if (!GROUNDS[one.because](readFileSync(match, 'utf8'))) {
        wrong.push(`${one.file}: excused as ${one.because}, and does not`);
      }
    }

    expect(wrong).toEqual([]);
  });

  it('has a ground for each waiver that some file could fail', () => {
    // A predicate that answers yes to anything is a waiver with no ground at
    // all, and it would pass the check above in silence. Every ground is asked
    // about a file that plainly does not have it.
    const nothing = 'const x = 1;\n';

    for (const [because, holds] of Object.entries(GROUNDS)) {
      expect({ because, of: holds(nothing) }).toEqual({ because, of: false });
    }
  });
});

describe('a document has comments too', () => {
  /**
   * `blank` was written for modules and a check that reads `index.html` got the
   * text raw. That is the same defect this file exists about, one syntax over:
   * `shared-link.test.ts` asserts the game's page carries a description and an
   * Open Graph set, and the tags it looks for sit directly under a comment that
   * names every one of them. Commented out, they would have satisfied it.
   *
   * One blanker, two comment syntaxes — rather than a second function nobody
   * finds when they need it.
   */
  it('blanks an HTML comment and keeps the markup around it', () => {
    const page = '<title>Leela</title>\n<!-- <meta name="description" content="x"> -->\n<meta charset="utf-8">';
    const blanked = blank(page, 'html');

    expect(blanked).toContain('<title>Leela</title>');
    expect(blanked).toContain('<meta charset="utf-8">');
    expect(blanked, 'the tag inside the comment is gone').not.toContain('name="description"');
  });

  it('blanks a CSS comment and keeps the rules around it', () => {
    /**
     * The third syntax, and it cost the same thing twice before it existed.
     * `.cell.win { color: transparent }` was commented out whole and the check
     * that the winning square keeps no number painted over it still passed;
     * and `.board`'s `aspect-ratio` was read out of a note above the live
     * declaration, so a test compared the value somebody had replaced.
     */
    const sheet = '.a { color: red }\n/* .b { color: blue } */\n.c { color: green }';
    const blanked = blank(sheet, 'css');

    expect(blanked).toContain('.a { color: red }');
    expect(blanked).toContain('.c { color: green }');
    expect(blanked, 'the rule inside the comment is gone').not.toContain('color: blue');
  });

  it('leaves a double slash alone in a stylesheet, because it is not a comment there', () => {
    // The reason `css` is its own mode rather than the module blanker reused:
    // `//` starts a comment in a module and nothing in a stylesheet.
    const sheet = '.a { content: "before // after" }';

    expect(blank(sheet, 'css')).toBe(sheet);
    expect(blank(sheet), 'the module blanker does take it').not.toBe(sheet);
  });

  it('keeps every offset, as the module blanker does', () => {
    // A check that finds something in the blanked text and reads around it in
    // the original is reading a different place.
    const page = '<a>\n<!-- two\n   lines -->\n<b>';
    expect(blank(page, 'html')).toHaveLength(page.length);
    expect(blank(page, 'html').split('\n')).toHaveLength(page.split('\n').length);
  });

  it('leaves a module alone when asked for a module', () => {
    // The default is unchanged: every existing caller passes one argument.
    const code = 'const x = 1; // a note\n/* and a block */\nconst y = 2;';

    expect(blank(code)).toContain('const x = 1;');
    expect(blank(code)).not.toContain('a note');
    expect(blank(code, 'html'), 'html knows nothing of those').toContain('a note');
  });
});

/**
 * Everyone who reads a source file reads it with the comments taken out.
 *
 * `blank` exists because a comment saying *this used to be
 * `resolveLanguage(undefined)`* reads to a regular expression exactly like the
 * defect still being there. The test above proves it works. This one asks
 * whether it is used, which is a different question and the one that was open:
 * `no-rules.test.ts` stripped the source for every check that looks for a rule
 * *being there* and read it raw for the single check that looks for the engine
 * being there — so a comment mentioning the import would have satisfied the
 * assertion that the phone still asks the engine at all.
 *
 * Swept across every test in the repository rather than fixed where it was
 * found, because the next file to read a source will be written by somebody who
 * has not read this one.
 */
describe('a claim about source text', () => {
  /** Every test file in the repository, wherever it lives. */
  function testFiles(from: string): string[] {
    const found: string[] = [];

    for (const entry of readdirSync(from, { withFileTypes: true })) {
      if (['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) continue;

      const path = join(from, entry.name);
      if (entry.isDirectory()) found.push(...testFiles(path));
      else if (/\.test\.(ts|tsx|mjs)$/.test(entry.name)) found.push(path);
    }

    return found;
  }

  it('is made about code, in every test that makes one', () => {
    const raw: string[] = [];

    for (const file of testFiles(REPO)) {
      const text = readFileSync(file, 'utf8');

      // A source file read into a name, and that name matched against.
      for (const read of text.matchAll(
        /const\s+(\w+)\s*=\s*(blank\()?readFileSync\([^;]*?\.(ts|tsx|mjs)['"][^;]*?\)/g,
      )) {
        const [, name = '', stripped] = read;
        const asserted = new RegExp(`expect\\(\\s*${name}\\b[\\s\\S]{0,30}?\\.(toContain|toMatch)`);

        if (!stripped && asserted.test(text)) raw.push(`${file.slice(REPO.length + 1)}: ${name}`);
      }
    }

    expect(raw).toEqual([]);
  });

  /**
   * And a document is read as a document.
   *
   * The rule above sweeps modules; the one further up asks only whether `blank`
   * was *called*. Neither asks whether the blanker was given the syntax of the
   * file it was handed — so `named.test.ts` read `index.html` with the module
   * blanker for as long as it has existed, and an HTML comment stayed visible
   * to every regular expression in it.
   *
   * Both directions were measured before this was written. A control that
   * exists only inside a comment was demanded to be translated, which is a
   * false failure somebody debugging would have to work out. And the way out of
   * the writer dialog was put inside a comment, and *"gives every one of them a
   * control that closes it"* **passed** — a check written because a player was
   * left in a dialog with nothing to press, satisfied by a comment.
   *
   * Asked with the balanced-parentheses reader rather than a pattern: the call
   * is `blank(readFileSync(resolve(HERE, 'index.html'), 'utf8'), 'html')`, and
   * `[^)]*` stops at the first bracket of three.
   */
  /**
   * The documents this sweep is not about, each named with its reason.
   *
   * Named rather than left to a pattern, which is how the sibling rule above
   * handles the same distinction: a list somebody has to add to is a list
   * somebody has to justify adding to.
   */
  /**
   * The syntaxes that are not modules, and what `blank` calls each.
   *
   * A table so the next one is a line rather than a second copy of this check.
   * Both are here because both were read wrongly and it cost something: a
   * dialog with no way out passed, and a stylesheet handed back the value
   * somebody had replaced.
   */
  const SYNTAX_OF: Record<string, string> = { html: 'html', css: 'css' };

  // The same list, and it has to be: a document that is run or produced is
  // excused from being blanked *and* from being blanked as a document. Two
  // lists of the same files is two places for one of them to be forgotten.

  it('is made about a document with the document syntax', () => {
    const wrong: string[] = [];

    for (const file of testFiles(REPO)) {
      const text = readFileSync(file, 'utf8');
      const here = file.slice(REPO.length + 1);

      for (const [extension, syntax] of Object.entries(SYNTAX_OF)) {
        // Every read of a document, and whether a blanker was told what it is.
        for (const call of callsTo(text, 'blank') as Array<{ args: string }>) {
          if (!new RegExp(`\\.${extension}['"]`).test(call.args)) continue;
          // The trailing comma is allowed: a call broken over lines gets one
          // from the formatter, and the first version of this check read that
          // as a missing argument.
          if (!new RegExp(`,\\s*['"]${syntax}['"],?\\s*$`).test(call.args.trim())) {
            wrong.push(`${here}: a .${extension} blanked as something else`);
          }
        }

        // And a read that never reached a blanker at all. `blank(readFileSync(…`
        // is the shape above, so what is left is a raw one. Four of these were
        // found by writing the check: two counting over `index.html`, and two
        // over the stylesheet.
        if (excused(here)) continue;

        const reads = new RegExp(`(blank\\(\\s*)?readFileSync\\([^;]*?\\.${extension}['"]`, 'g');
        for (const read of text.matchAll(reads)) {
          if (!read[1]) wrong.push(`${here}: a .${extension} read raw`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });

  it('finds the document reads it is looking for, so that sweep is about something too', () => {
    // The same guard the module sweep has, and one per syntax rather than one
    // in total: with `html` alone reading, the `css` half of the check above
    // would pass over a question nobody asked, which is the state it was
    // written to end.

    for (const extension of Object.keys(SYNTAX_OF)) {
      const reads = new RegExp(`readFileSync\\([^;]*?\\.${extension}['"]`);
      const reading = testFiles(REPO).filter((file) => reads.test(readFileSync(file, 'utf8')));

      expect({ extension, reading: reading.length > 2 }).toEqual({ extension, reading: true });
    }
  });

  it('finds the reads it is looking for, so the sweep is about something', () => {
    // Zero source-reading tests would make the assertion above pass on a
    // repository that never reads a source file at all.
    const reading = testFiles(REPO).filter((file) =>
      /blank\(readFileSync\(/.test(readFileSync(file, 'utf8')),
    );

    expect(reading.length).toBeGreaterThan(5);
  });
});
