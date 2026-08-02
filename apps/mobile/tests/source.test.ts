import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
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
 */

const HERE = dirname(fileURLToPath(import.meta.url));
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
   */
  const TESTS = join(HERE, '..', '..');

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

  const files = testFiles(TESTS);

  it('finds the tests at all, or this proves nothing', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('leaves nobody writing their own', () => {
    const own = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      // A local blanker: a replace over the comment syntax, in a file that is
      // not the shared module's own test.
      return (
        file !== join(HERE, 'source.test.ts') &&
        /replace\(\/\\\/\\\*/.test(source)
      );
    });

    expect(own.map((file) => file.replace(TESTS, ''))).toEqual([]);
  });

  /**
   * A check that *runs* a document rather than asserting about it.
   *
   * These load `index.html` into happy-dom and play the app through it. Blanking
   * would alter the thing under test, which is the opposite of what it is for —
   * so the rule is about **asserting** over source, and the exception is named
   * rather than left to a pattern to miss.
   */
  const RUNS_IT = ['assembled.test.ts', 'partly-written.test.ts', 'build.test.ts'];

  it('makes every check that asserts over source blank it first', () => {
    /**
     * The shape. A check that reads `src/` and asserts over the text has to see
     * code and not prose — and the ones that did not were not wrong today, they
     * were wrong on the next comment somebody wrote. Ten of them.
     */
    const unblanked = files.filter((file) => {
      if (RUNS_IT.some((runs) => file.endsWith(runs))) return false;

      const source = readFileSync(file, 'utf8');
      const reads = /readFileSync\([^)]*['"`][^'"`]*(src|index\.html)/.test(source);
      return reads && !source.includes('blank(') && !source.includes('blank as code');
    });

    expect(unblanked.map((file) => file.replace(TESTS, ''))).toEqual([]);
  });

  it('names the ones that run a document rather than reading it', () => {
    // The guard against the exception growing quietly: each named file has to
    // exist and has to be one that loads a document.
    for (const runs of RUNS_IT) {
      const named = files.filter((file) => file.endsWith(runs));
      expect(named.length, runs).toBeGreaterThan(0);
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
