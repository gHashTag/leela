/**
 * An account is stored the same way whichever door it came through.
 *
 * There are two. One is a player writing on a square — `takeSquare`, and behind
 * the surfaces' own writers, which all end in it. The other is a file arriving,
 * which is `parseDocument`. Both decide the same two things: whether there is an
 * account here at all, and what text to keep.
 *
 * They did not agree, and the disagreement was one call. Every writing door
 * trims before it decides; `isReport` measured `text.length` raw. So `''` was
 * refused and `'   '` was not — a difference nobody meant, and the file was then
 * the one door an account with nothing written in it could come through. Once
 * in, it is a square written about: it shows on the board, it is in the path, it
 * is among the squares that came back, and at `MAX_REPORTS` it pushes a real
 * account out.
 *
 * The second half is worse, because it is silent. Sameness is the square and the
 * words, so a path exported, opened in an editor that added a trailing newline,
 * and brought back was a **second** account of a square already written about —
 * and `revisits`, which is what the game exists to produce, would say the player
 * returned to a square they never returned to.
 *
 * So this asks the property rather than the two cases: for an account wrapped in
 * every kind of surrounding whitespace, and for whitespace with no account in
 * it, both doors answer the same. A future door that forgets to trim, or one
 * that starts trimming something else, fails here on the day it is written.
 *
 * Length is deliberately out of scope: `between-the-surfaces.test.ts` holds the
 * clamp across all three applications, and a text long enough to be cut would
 * make this about two rules at once.
 */

import { describe, expect, it } from 'vitest';
import { MAX_REPORT_CHARS, parseDocument, takeSquare, type Report } from '../src/index';

const AT = 1_700_000_000_000;
const PLAN = 5;
const WORDS = 'an account of the fifth square, and what it turned out to be about';

/**
 * The ways a text can be surrounded by nothing.
 *
 * Built rather than listed: a file has been through an editor, and an editor
 * adds a newline at the end, or a tab from a paste, or the padding a formatter
 * leaves behind. The point is not these seven — it is that the two doors do the
 * same thing with all of them.
 */
const SURROUNDINGS = ['', ' ', '  ', '\n', '\t', ' \n', ' '];

const wrapped = SURROUNDINGS.flatMap((before) =>
  SURROUNDINGS.map((after) => ({ what: `${JSON.stringify(before)}…${JSON.stringify(after)}`, before, after })),
);

/** A file carrying exactly one entry, as every application writes one. */
const fileHolding = (text: string) =>
  JSON.stringify({ schemaVersion: 1, app: 'leela', entries: [{ plan: PLAN, text, at: AT }] });

/** What a door keeps, as the one thing both doors can be asked. */
interface Kept {
  kept: boolean;
  text: string | null;
}

const written = (text: string): Kept => {
  const entries = takeSquare([], { plan: PLAN, text }, AT);
  return { kept: entries.length === 1, text: entries[0]?.text ?? null };
};

const readOutOfAFile = (text: string): Kept => {
  const document = parseDocument(fileHolding(text));
  // A file with nothing readable in it is refused whole, which is this format's
  // own rule — so *no account kept* is the same answer either way.
  return { kept: document !== null, text: document?.entries[0]?.text ?? null };
};

describe('an account arriving through either door', () => {
  it('is kept, or not kept, on the same grounds', () => {
    const differing: string[] = [];

    for (const { what, before, after } of wrapped) {
      const text = `${before}${WORDS}${after}`;
      const door = written(text);
      const file = readOutOfAFile(text);

      if (door.kept !== file.kept || door.text !== file.text) {
        differing.push(`${what}: written ${JSON.stringify(door)} vs file ${JSON.stringify(file)}`);
      }
    }

    expect(differing).toEqual([]);
  });

  it('is not kept at all when there is nothing in it', () => {
    const kept: string[] = [];

    for (const { what, before, after } of wrapped) {
      const nothing = `${before}${after}`;
      if (written(nothing).kept) kept.push(`written ${what}`);
      if (readOutOfAFile(nothing).kept) kept.push(`from a file ${what}`);
    }

    // The empty pair is `''`, which is a text with nothing in it too.
    expect(kept).toEqual([]);
  });

  it('reaches a path already holding it as the same account, not a second one', () => {
    // The consequence, asserted where it is felt. Sameness is the square and
    // the words: an account that came back with a newline on it used to be a
    // return to a square the player never left.
    const held: Report[] = [{ plan: PLAN, text: WORDS, at: AT }];

    for (const { what, before, after } of wrapped) {
      const document = parseDocument(fileHolding(`${before}${WORDS}${after}`));
      const entry = document?.entries[0];

      expect({ what, plan: entry?.plan, text: entry?.text }).toEqual({
        what,
        plan: held[0]!.plan,
        text: held[0]!.text,
      });
    }
  });

  it('asks a question these doors can answer differently', () => {
    // The guard against a check that cannot fail. If the padding set were all
    // empty strings, or the account itself were something both doors refuse,
    // everything above would pass over a question nobody asked.
    expect(SURROUNDINGS.filter((one) => one !== '').length).toBeGreaterThan(3);
    expect(written(WORDS)).toEqual({ kept: true, text: WORDS });
    expect(readOutOfAFile(WORDS)).toEqual({ kept: true, text: WORDS });
    expect(WORDS.length).toBeLessThan(MAX_REPORT_CHARS);
  });
});
