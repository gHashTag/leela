import { describe, expect, it } from 'vitest';
import { parseSquare } from '@leela/journal';
import { EMPTY, record, shareSquare, takeSquare, writingsOn } from '../src/journal';

/**
 * One square, which is what people actually pass on.
 *
 * A whole path is a file and an occasion. A square is a message — *this is
 * where I am and this is what it asked of me* — and the bot has had `/take` for
 * it since the day it could read one. The phone could carry a path both ways
 * and not a square either way, which is the door that gets used.
 *
 * Two decisions come with it and neither is new. The frame is not adopted: a
 * shared square carries the sender's question and taking it would let a message
 * set what somebody is playing for. And it is stamped on arrival, because a
 * square carries no time and inventing one puts it at a place in the path where
 * nothing happened — after which `revisited` says a player came back to a
 * square they never left.
 */

const shared = shareSquare(
  41,
  'The human plane (jana-loka)',
  'What it asked of me.',
  'to stop hurrying',
);

describe('a square sent on', () => {
  it('is written the way a person reads it, and read back the same', () => {
    const back = parseSquare(shared);

    expect(back?.plan).toBe(41);
    expect(back?.text).toBe('What it asked of me.');
  });

  it('arrives in the path, on the square it was written about', () => {
    const taken = takeSquare(EMPTY, shared, 500);

    expect(taken.readable).toBe(true);
    expect(taken.added).toBe(true);
    expect(writingsOn(taken.journal, 41).map((entry) => entry.text)).toEqual([
      'What it asked of me.',
    ]);
  });

  it('is stamped when it arrives, because it carries no time of its own', () => {
    const taken = takeSquare(EMPTY, shared, 500);

    expect(taken.journal.entries[0]?.at).toBe(500);
  });

  it('does not arrive twice, however many times it is pasted', () => {
    // Sameness is the square and the words, which is what a person pasting
    // twice means by "the same one" — a second stamp would make `revisited`
    // report a return that never happened.
    const once = takeSquare(EMPTY, shared, 500).journal;
    const twice = takeSquare(once, shared, 900);

    expect(twice.added).toBe(false);
    expect(twice.journal.entries).toHaveLength(1);
  });

  it('never brings the sender’s question with it', () => {
    // The one thing this route must not do. Reading somebody's frame is not
    // taking it on; the mini app's hand-over is the only route that may set a
    // question, because Telegram delivers it from the player's own app.
    const taken = takeSquare(EMPTY, shared, 500);

    expect(JSON.stringify(taken.journal)).not.toContain('to stop hurrying');
    expect(Object.keys(taken).sort()).toEqual(['added', 'journal', 'plan', 'readable']);
  });

  it('names the square that arrived, not the one the reader is standing on', () => {
    // Somebody standing on 6 can be sent 41, and the sentence that follows says
    // which. Reporting the reader's square instead is the shape this repository
    // has now met five times: a sentence that names the wrong thing because it
    // was the value nearest to hand.
    expect(takeSquare(record(EMPTY, 6, 'mine', 1), shared, 500).plan).toBe(41);
    expect(takeSquare(EMPTY, 'not a square', 500).plan, 'and nothing arrived').toBeNull();
  });

  it('says so, and changes nothing, when the words are not a square', () => {
    const mine = record(EMPTY, 6, 'mine', 1);

    for (const rubbish of ['', 'hello', '999. Nowhere\n\nsomething', 'just a sentence']) {
      const taken = takeSquare(mine, rubbish, 500);

      expect(taken.readable, rubbish).toBe(false);
      expect(taken.journal, 'untouched').toBe(mine);
    }
  });

  it('keeps a square whose account ends on a dash line', () => {
    // The defect the format was found with: a closing line beginning with a
    // dash was lifted out of the account and installed as the reader's
    // question. Asserted here because this surface is a new way in.
    const ownWords = shareSquare(
      41,
      'The human plane',
      'I kept circling the same thing.\n— that I am afraid of being ordinary',
      '',
    );

    expect(takeSquare(EMPTY, ownWords, 500).journal.entries[0]?.text).toContain(
      'afraid of being ordinary',
    );
  });
});
