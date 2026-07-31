import { describe, expect, it } from 'vitest';
import {
  MAX_REPORTS,
  parseSquare,
  squareText,
  takeSquare,
  type Report,
} from '../src/index';

/**
 * One square, out of the app and back into it.
 *
 * A path leaves as a file and comes back as a file. A *square* left as words —
 * the thing people actually pass on, "this is where I landed and this is what
 * it asked" — and nothing could read one. The app could write a sentence it
 * could not hear.
 *
 * Two things make this different from the file, and both are in the tests:
 *
 * A shared square carries no time. None is invented in the parser — it is
 * stamped when it arrives, which is the only true thing available. Which means
 * the file's sameness rule does not work here: `newEntries` tells one import
 * from a second by the moment each report was written, and two pastes of one
 * square are an hour apart. Left alone, the same square pasted twice would
 * become two entries, and the squares that "came back" would include one nobody
 * returned to — the record the game exists to produce saying something that did
 * not happen.
 */

const TITLES = ['The human plane (jana-loka)', 'Delusion (moha)', 'Земной план', '純粋'];
/**
 * What somebody writes on a square.
 *
 * The list this replaces had a dash *inside* a sentence and a line that looks
 * like a heading — the two shapes somebody thought of — and not the one that
 * broke: an account **ending** on a dash-led line. That is ordinary writing. A
 * closing thought, a quoted line, a signature. Shared from the mini app, the
 * last line was lifted out of the account and installed as the player's
 * intention — the question the whole game is played to answer, taken from
 * words they wrote about a square. An account that was *only* such a line came
 * back as `null`: shared, and answered with "that is not a square".
 *
 * So the endings are generated rather than remembered. Every combination of a
 * body and a closing line, blank line or not, is a thing a person can type.
 */
const BODIES = ['One line.', 'Two lines,\nthe second longer.', 'A paragraph.  '];
const ENDINGS = ['', '\n— a closing thought', '\n\n— a closing thought', '\n- a hyphen one'];

const WRITINGS = [
  ...BODIES.flatMap((body) => ENDINGS.map((ending) => `${body}${ending}`)),
  '— nothing but a closing line',
  'A paragraph.\n\nAnd another, with a — dash inside it — mid-sentence.',
  '41. Looks like a heading but is not one.',
];
const INTENTIONS = ['', 'to stop hurrying', 'to see it through — whatever that turns out to mean'];

describe('a square, written and read back', () => {
  it('comes back as the square it was, whatever was written on it', () => {
    // The shape, over the whole product of what can go into one: the app must
    // be able to read anything the app can write.
    for (let plan = 1; plan <= 72; plan++) {
      for (const title of TITLES) {
        for (const written of WRITINGS) {
          for (const intention of INTENTIONS) {
            const shared = squareText(plan, title, written, intention);
            const back = parseSquare(shared);

            expect(back?.plan, `${plan} / ${written}`).toBe(plan);
            expect(back?.text, `${plan} / ${written}`).toBe(written.trim());
            // And the question is the sender's own, never a line of their
            // account promoted into one.
            expect(back?.intention ?? '', `${plan} / ${written}`).toBe(intention.trim());
          }
        }
      }
    }
  });

  it('never brings the sender’s intention with it', () => {
    // Reading somebody's frame is not adopting it — the same rule that keeps
    // `reported` out of an imported file.
    const shared = squareText(41, 'The human plane', 'What I said.', 'to stop hurrying');
    expect(parseSquare(shared)?.text).toBe('What I said.');
    expect(parseSquare(shared)?.text).not.toContain('to stop hurrying');
  });

  it('refuses what is not a square', () => {
    // A share has been out of the app, through a chat, and possibly through
    // somebody's editor. Anything it cannot vouch for is nothing.
    for (const text of [
      '',
      'hello',
      '41.',
      '41. A title with nothing under it',
      '0. Zero is not a square\n\nsomething',
      '73. Past the end of the board\n\nsomething',
      'The human plane\n\nno number at all',
      '{"schemaVersion":1,"app":"leela","entries":[]}',
    ]) {
      expect(parseSquare(text), JSON.stringify(text)).toBeNull();
    }
  });

  it('survives a trip through a chat that rewrote the line endings', () => {
    const shared = squareText(12, 'Envy', 'Two lines,\nas sent.', '').replace(/\n/g, '\r\n');
    expect(parseSquare(shared)).toEqual({ plan: 12, text: 'Two lines,\nas sent.' });
  });
});

describe('taking a square in', () => {
  const kept: Report[] = [{ plan: 6, text: 'Already here.', at: 1_700_000_000_000 }];
  const square = { plan: 41, text: 'What it asked of me.' };

  it('keeps everything that was already there', () => {
    const after = takeSquare(kept, square, 1_700_000_100_000);
    expect(after).toEqual(expect.arrayContaining(kept));
    expect(after).toHaveLength(kept.length + 1);
  });

  it('adds nothing the second time, however long the wait', () => {
    // The rule the file gets from its timestamps and this cannot: people paste
    // the same thing twice, and a path that doubles is a path nobody trusts.
    // A doubled square is worse than untidy — it invents a return.
    let after = takeSquare(kept, square, 1_700_000_100_000);
    for (const later of [1, 1_000, 86_400_000, 400 * 86_400_000]) {
      after = takeSquare(after, square, 1_700_000_100_000 + later);
    }

    expect(after.filter((entry) => entry.plan === square.plan)).toHaveLength(1);
  });

  it('takes a different account of the same square, which is the game', () => {
    // Coming back and saying something else about 41 is the point. Only the
    // identical words are the same square.
    const first = takeSquare(kept, square, 1_700_000_100_000);
    const second = takeSquare(first, { plan: 41, text: 'And this time, something else.' }, 1_700_000_200_000);

    expect(second.filter((entry) => entry.plan === 41)).toHaveLength(2);
  });

  it('is oldest first, like everything else that is read as a path', () => {
    const after = takeSquare(kept, square, 1_600_000_000_000);
    expect(after.map((entry) => entry.at)).toEqual([...after.map((entry) => entry.at)].sort((a, b) => a - b));
  });

  it('takes nothing from an empty square', () => {
    expect(takeSquare(kept, { plan: 41, text: '   ' }, 1)).toEqual(kept);
  });

  it('stays inside the bound the storage has', () => {
    const many: Report[] = Array.from({ length: MAX_REPORTS }, (_, index) => ({
      plan: ((index % 72) + 1),
      text: `entry ${index}`,
      at: 1_700_000_000_000 + index,
    }));

    const after = takeSquare(many, square, 1_800_000_000_000);
    expect(after).toHaveLength(MAX_REPORTS);
    // The newest survives; the oldest is what a bound drops.
    expect(after.at(-1)?.text).toBe(square.text);
  });
});
