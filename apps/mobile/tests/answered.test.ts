import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { blank as code } from '../../../scripts/lib/source.mjs';
import { LANGUAGES, messageFor, type MessageKey } from '@leela/content';

/**
 * What the player is told about keeping, and by whom.
 *
 * Two halves of one defect, both found by taking the published app's audit
 * (`docs/published-app-auth-audit.md`) and asking whether its shapes had grown
 * here. Two of them had.
 *
 * **The check was on the write that cannot fail.** Saving the question ran
 * `void keepIntention(intentionKeeper, …)` — the device, whose answer was
 * discarded — beside `if (!saveIntention(store, …))`, which writes to the
 * session's own `Map` and can only fail when there is no store at all. So the
 * branch that spoke was dead, and the one write that can really refuse was the
 * one nobody asked. A player answered the question the game is played to
 * answer, the disk said no, and they were told it was held — then asked again
 * at the next launch as though they never had. The published app's `UserEdit`
 * closes the screen the same way, and this repository has fixed this shape on
 * four other writes.
 *
 * **And the one sentence it did say was the browser's.** `app.reportUnkept`
 * names a browser, a tab and a screen called *My path*. This app has no browser
 * and no tab, and no path view at all — it shows what was written about the
 * square being stood on. At the one moment a player needs a true instruction,
 * it gave one that was impossible on three counts.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(HERE, '..', 'src', 'App.tsx'), 'utf8');

/**
 * The file with what it says about itself blanked out, character for character.
 *
 * Blanked rather than removed, so an index into this is an index into the file:
 * the first version of the last check below found its writes in the stripped
 * text and read their reasons out of the original, and the two had drifted
 * apart by every comment in between — so it reported a defect in code that
 * already carried the explanation it was asking for.
 *
 * Comments have to go at all because this file documents its own defects. One
 * of them quotes `void keepIntention(…)` as the thing that was wrong, and a
 * check reading the file plainly counts that quotation as a fifth write.
 */

describe('what the player is told about keeping comes from the device', () => {
  /**
   * Every sentence about something not being kept, and where it is decided.
   *
   * The shape rather than the two call sites: any such message must sit inside
   * the answer of a write to a keeper. A screen is free to be silent — the
   * board and the draft are kept without a word, each with a written reason —
   * but it may not *speak* on the authority of a store that cannot refuse.
   */
  const spoken = [...code(APP).matchAll(/setSaid\(\s*messageFor\(language, '([\w.]*[Nn]ot[Kk]ept[\w.]*)'/g)];

  it('says it at all', () => {
    // A screen that never mentions a refusal would pass every assertion below
    // by having nothing to check — the shape this repository has been caught by
    // before, where an absence read exactly like a pass.
    expect(spoken.length).toBeGreaterThan(1);
  });

  it('never on the authority of the session, which cannot refuse', () => {
    /**
     * `saveIntention` and `save` write to the `Map` made by `forTheSession`.
     * `setItem` on a `Map` does not throw, so they return false only when there
     * is no store, which there always is. A message decided by them is a
     * message that is never shown.
     */
    expect(code(APP), 'the session decides what is said').not.toMatch(
      /if \(!save(Intention)?\([^)]*\)\) \{\s*setSaid/,
    );
  });

  it('always inside the answer of a write to the device', () => {
    /**
     * Every one of them sits after a `keep…(` and before the `.then` that
     * closes it. Matched by walking back rather than by a pattern with
     * balanced parentheses — the first version of this used `[^)]*` and broke
     * on `asking.trim()`, reporting a defect in code that was already right.
     */
    const source = code(APP);

    for (const [, key] of spoken) {
      const at = source.indexOf(`messageFor(language, '${key}')`);
      const opened = Math.max(
        source.lastIndexOf('keep(', at),
        // The writer that reads first. A path nobody has read is not a path to
        // write over, so the account goes through `keepPath` — which is still a
        // write to the device, and the rule is about where the answer comes
        // from rather than about the name of the function that gives it.
        source.lastIndexOf('keepPath(', at),
        source.lastIndexOf('keepIntention(', at),
        source.lastIndexOf('Promise.all([', at),
      );

      expect(opened, `${key} follows no write to the device`).toBeGreaterThan(-1);
      expect(
        source.slice(opened, at),
        `${key} is not inside a keeper's answer`,
      ).toContain('.then(');
    }
  });

  it('asks the device for the question and for the path', () => {
    // The writes that carry what the player produced. The board and the draft
    // are deliberately silent, each with its reason written down beside it.
    const answered = (call: string) => {
      const at = code(APP).indexOf(call);
      expect(at, `${call} is never called`).toBeGreaterThan(-1);
      return code(APP).slice(at, at + 400);
    };

    expect(answered('keepIntention(intentionKeeper, asking.trim())')).toContain('.then(');
    expect(answered('keep(keeper, taken.journal)')).toContain('.then(');
    expect(answered('keep(keeper, square.journal)')).toContain('.then(');
  });

  it('leaves no write to the device unanswered and unexplained', () => {
    /**
     * The general form. A `void keep…(…)` with no `.then` is a decision to say
     * nothing, and a decision has to be written down — the requirement
     * `audit-drawings` makes of every control drawn shut, after three passes in
     * which one refused and said nothing.
     */
    const source = code(APP);
    const writes = [...source.matchAll(/\bvoid (keep\w*)\(/g)];

    expect(writes.length, 'writes to the device').toBeGreaterThan(2);

    for (const write of writes) {
      const at = write.index ?? 0;
      const answered = source.slice(at, at + 400).includes('.then(');
      if (answered) continue;

      // Silence is allowed and has to be argued for, the requirement
      // `audit-drawings` makes of every control drawn shut. Read out of the
      // original, at the same index, which is what blanking buys.
      const reason = APP.slice(Math.max(0, at - 1200), at);
      expect(
        /is not said here|Not told about here|smaller loss/.test(reason),
        `${write[1]} drops the device's answer with no reason written beside it`,
      ).toBe(true);
    }
  });
});

describe('every sentence it says is true of the device it is held on', () => {
  /**
   * Resolved from the source rather than listed: the keys this screen actually
   * passes to `messageFor`, looked up in the catalogue, and read for words that
   * are false on a phone.
   *
   * `app.reportUnkept` was one of twenty-three and it named a browser, a tab
   * and a screen this app does not have. A sentence borrowed from the surface
   * next door is the eighth sighting of *a sentence naming the wrong thing* in
   * this repository, and the shape is always the same: the words were already
   * written, so nobody wrote new ones.
   */
  const keys = [
    ...new Set([...code(APP).matchAll(/messageFor\(language, '([\w.]+)'/g)].map(([, key]) => key)),
  ] as MessageKey[];

  const NOT_A_PHONE = [
    ['browser', /\bbrowser\b|браузер/i],
    ['a tab', /\btabs?\b|вкладк/i],
    ['a window', /\bwindow\b|окн[оа]/i],
  ] as const;

  /**
   * A screen this app has not got.
   *
   * This was a fourth entry in the table above, forbidding *My path* outright,
   * because the phone had no such view: the sentence about a device refusing a
   * write told the player to save a copy from a screen that did not exist. It
   * does now, so the rule has to say what it meant. Naming a screen is only
   * wrong when the screen is not there, and whether it is there is a fact about
   * the handles, not about a word.
   */
  const NAMES_THE_PATH = /My path|Мо[её]м пути/i;

  it('reads a real handful of them', () => {
    expect(keys.length).toBeGreaterThan(15);
  });

  it.each(NOT_A_PHONE)('never mentions %s', (_what, pattern) => {
    for (const key of keys) {
      for (const language of ['en', 'ru'] as const) {
        const text = messageFor(language, key, { count: 1, plan: 1, seat: 1 });
        expect(pattern.test(text), `${language}/${key}: ${text}`).toBe(false);
      }
    }
  });

  it('names no screen it has not got', () => {
    const named = keys.some((key) =>
      (['en', 'ru'] as const).some((language) => NAMES_THE_PATH.test(messageFor(language, key))),
    );

    if (!named) return;
    expect(APP, 'a sentence names the path and no control opens one').toContain(
      'testID={HANDLE.path}',
    );
  });

  it('has the sentence it needed, in every language a phone can ask for', () => {
    // The gap the borrowing came from: there was no sentence about a device
    // that is not a browser, and none at all about the question.
    for (const language of LANGUAGES) {
      for (const key of ['app.notKept', 'app.intentionNotKept'] as const) {
        expect(messageFor(language, key).length, `${language}/${key}`).toBeGreaterThan(20);
      }
    }
  });

  it('still lets the browser say the browser\'s sentence', () => {
    // The mini app's own is right for the mini app; this is not a rename.
    expect(messageFor('en', 'app.reportUnkept')).toMatch(/browser/);
    expect(messageFor('en', 'app.notKept')).not.toMatch(/browser/);
  });
});
