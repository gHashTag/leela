import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { blank } from '../../../scripts/lib/source.mjs';
import { forgetIntention, loadIntention, saveIntention } from '../src/state';

/**
 * Beginning again is beginning with the question too.
 *
 * `startOver` empties this seat's board, releases the gate and forgets the
 * draft, and it kept the sentence the finished game was *played to answer*. So
 * the new game stood under the old question with `mayThrow` already satisfied
 * by it, and nobody beginning again was asked what they were beginning for.
 *
 * Third surface with the shape. The bot lets go of it on `/end`, the phone on
 * *Start over*, and both were found the same way — by playing to the end and
 * reading what the next game said about itself.
 *
 * Only this seat's. The others are in the middle of their own games on a shared
 * device, and a seat starting again is not a reason to empty theirs.
 */

const MAIN = blank(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'main.ts'), 'utf8'),
);

/** A window's storage, as a Map. */
function windowWith(held = new Map<string, string>()) {
  return {
    held,
    storage: {
      getItem: (key: string) => held.get(key) ?? null,
      setItem: (key: string, value: string) => {
        held.set(key, value);
      },
    },
  };
}

describe('forgetting one seat\'s question', () => {
  it('leaves nothing to load back', () => {
    const { storage } = windowWith();
    saveIntention(storage, 'to see what I keep avoiding', 'p1');
    expect(loadIntention(storage, 'p1')).not.toBe('');

    forgetIntention(storage, 'p1');
    expect(loadIntention(storage, 'p1')).toBe('');
  });

  it('is a different act from keeping, because keeping refuses this', () => {
    /**
     * `saveIntention('')` cannot clear it and should not: it refuses anything
     * `isIntention` refuses, which is what keeps *a little longer, please* out
     * of the store. Two acts, two functions — the same reason `clearDraft` is
     * not `saveDraft(…, '')` where a caller means forget.
     */
    const { storage } = windowWith();
    saveIntention(storage, 'to see what I keep avoiding', 'p1');

    expect(saveIntention(storage, '', 'p1'), 'keeping refuses it').toBe(false);
    expect(loadIntention(storage, 'p1'), 'and leaves it standing').not.toBe('');
    expect(forgetIntention(storage, 'p1')).toBe(true);
  });

  it('touches only the seat it is asked about', () => {
    // A shared device. Two seats, two games, and one of them beginning again.
    const { storage } = windowWith();
    saveIntention(storage, 'the first seat is playing for this', 'p1');
    saveIntention(storage, 'the second seat is playing for that', 'p2');

    forgetIntention(storage, 'p1');

    expect(loadIntention(storage, 'p1')).toBe('');
    expect(loadIntention(storage, 'p2')).toBe('the second seat is playing for that');
  });

  it('says no rather than throwing when there is nowhere to write', () => {
    // A window that cannot store still plays — the rule every other writer in
    // this file follows.
    expect(forgetIntention(undefined, 'p1')).toBe(false);
    expect(() =>
      forgetIntention(
        {
          getItem: () => null,
          setItem: () => {
            throw new Error('quota');
          },
        },
        'p1',
      ),
    ).not.toThrow();
  });
});

describe('what startOver lets go of', () => {
  const START_OVER = MAIN.slice(
    MAIN.indexOf('function startOver()'),
    MAIN.indexOf('function askIntention()'),
  );

  it('forgets the question along with the draft', () => {
    expect(START_OVER, 'the copy on screen').toContain("intention = ''");
    expect(START_OVER, 'the copy in the store').toContain('forgetIntention(localStorage, seated.id)');
    expect(START_OVER, 'the draft, as it always did').toContain('clearDraft(localStorage, seated.id)');
  });

  it('asks it, rather than leaving it behind a die nobody can press', () => {
    /**
     * This app's own rule, written where a hand-off meets a seat that has never
     * answered: *the die is shut until it answers, so the question has to
     * arrive by itself rather than wait behind a control nobody can press.*
     * Clearing without asking would have been that control.
     */
    expect(START_OVER).toContain('askIntention()');
  });

  it('keeps what was written, which is not the game\'s to burn', () => {
    // The other half, and it was already right: entries stay.
    expect(START_OVER).toContain('reported: true');
    expect(START_OVER, 'nothing empties the entries').not.toMatch(/entries:\s*\[\]/);
  });

  it('empties this seat and no other', () => {
    expect(START_OVER).toMatch(/player\.id === seated\.id \? \{ \.\.\.player, state: initialState\(\) \} : player/);
  });
});
