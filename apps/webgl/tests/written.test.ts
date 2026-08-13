import { describe, expect, it } from 'vitest';
import { MAX_REPORTS, REPORTS_KEY, writingsOn } from '@leela/journal';

import type { Store } from '../src/kept';
import { add, asFile, readAll, readIntention, takeIn, writeIntention } from '../src/written';

/**
 * What comes back out of storage was put there by another program — an older
 * build of this one, or the mini app, which writes the same key. So every
 * assertion here is about a record that is not what this app would have
 * written, and the shape of the defect is *one bad row costing a year of
 * writing*.
 */

const fakeStore = (start: Record<string, string> = {}): Store & { held: Record<string, string> } => ({
  held: { ...start },
  getItem(key) {
    return this.held[key] ?? null;
  },
  setItem(key, value) {
    this.held[key] = value;
  },
  removeItem(key) {
    delete this.held[key];
  },
});

const refusing = (): Store => ({
  getItem() {
    throw new Error('storage is disabled');
  },
  setItem() {
    throw new Error('storage is disabled');
  },
  removeItem() {
    throw new Error('storage is disabled');
  },
});

const stored = (value: unknown): Store => fakeStore({ [REPORTS_KEY]: JSON.stringify(value) });

const entry = (plan: number, text: string, at: number) => ({ plan, text, at });

describe('what the player has written', () => {
  it('comes back as it went in', () => {
    const store = fakeStore();
    add(store, entry(34, 'This one lands hard.', 1_700_000_000_000));
    expect(readAll(store)).toEqual([entry(34, 'This one lands hard.', 1_700_000_000_000)]);
  });

  it('writes where the other surfaces read', () => {
    const store = fakeStore();
    add(store, entry(9, 'here', 1));
    expect(Object.keys(store.held)).toEqual([REPORTS_KEY]);
  });

  it('comes back oldest first, whatever order it went in', () => {
    const store = stored([entry(3, 'third', 300), entry(1, 'first', 100), entry(2, 'second', 200)]);
    expect(readAll(store).map((r) => r.text)).toEqual(['first', 'second', 'third']);
  });

  /**
   * One bad row costs that row. A file written by another version of another
   * app is the least trustworthy thing this handles, and throwing all of it
   * away over a single entry is losing a year of writing to a typo.
   */
  it('keeps the rows that are reports and drops only the rest', () => {
    const store = stored([
      entry(34, 'real', 100),
      { plan: 99, text: 'off the board', at: 200 },
      { plan: 5, text: '   ', at: 300 },
      { plan: 5, text: 'no time' },
      'not even an object',
      entry(7, 'also real', 400),
    ]);
    expect(readAll(store).map((r) => r.text)).toEqual(['real', 'also real']);
  });

  it('returns nothing rather than throwing on a record that is not a list', () => {
    for (const bad of ['{', 'null', '{"a":1}', '"a string"', '7']) {
      expect(readAll(fakeStore({ [REPORTS_KEY]: bad })), bad).toEqual([]);
    }
  });

  it('returns nothing when nothing was ever written', () => {
    expect(readAll(fakeStore())).toEqual([]);
  });

  /**
   * `localStorage` has a size, and a surface that writes without a bound
   * eventually throws on a save — losing the newest entry, which is the one the
   * player is watching.
   */
  it('drops the oldest at the bound rather than the newest', () => {
    const store = fakeStore();
    for (let at = 1; at <= MAX_REPORTS + 5; at += 1) add(store, entry(1, `entry ${at}`, at));
    const kept = readAll(store);
    expect(kept).toHaveLength(MAX_REPORTS);
    expect(kept.at(-1)?.text).toBe(`entry ${MAX_REPORTS + 5}`);
    expect(kept[0]?.text).toBe('entry 6');
  });

  it('keeps playing when storage refuses, in both directions', () => {
    expect(() => readAll(refusing())).not.toThrow();
    expect(readAll(refusing())).toEqual([]);
    expect(() => add(refusing(), entry(1, 'x', 1))).not.toThrow();
    expect(add(refusing(), entry(1, 'x', 1))).toHaveLength(1);
    expect(readAll(null)).toEqual([]);
    expect(() => add(null, entry(1, 'x', 1))).not.toThrow();
  });

  /** The reason any of this exists: standing on a square again finds it. */
  it('finds what was written on one square and nothing from the others', () => {
    const store = fakeStore();
    add(store, entry(34, 'first time here', 100));
    add(store, entry(9, 'somewhere else', 200));
    add(store, entry(34, 'second time here', 300));

    expect(writingsOn(readAll(store), 34).map((r) => r.text)).toEqual([
      'first time here',
      'second time here',
    ]);
    expect(writingsOn(readAll(store), 68)).toEqual([]);
  });
});

describe('what the player is playing for', () => {
  it('comes back as it went in', () => {
    const store = fakeStore();
    expect(writeIntention(store, 'To stop bracing for the next thing.')).toBe(true);
    expect(readIntention(store)).toBe('To stop bracing for the next thing.');
  });

  it('is nothing until it is asked', () => {
    expect(readIntention(fakeStore())).toBeNull();
  });

  /**
   * `asIntention` drops rather than shortens — a question cut in half is a
   * different question — and this must not store what it would refuse to read.
   */
  it('refuses what the game cannot hold, and stores nothing', () => {
    const store = fakeStore();
    for (const bad of ['', ' ', 'x', 'y'.repeat(801)]) {
      expect(writeIntention(store, bad), JSON.stringify(bad.slice(0, 8))).toBe(false);
    }
    expect(readIntention(store)).toBeNull();
  });

  it('trims, because a question is what was meant and not what was typed', () => {
    const store = fakeStore();
    writeIntention(store, '   why do I keep arriving here   ');
    expect(readIntention(store)).toBe('why do I keep arriving here');
  });

  it('says no rather than throwing when storage refuses', () => {
    expect(writeIntention(refusing(), 'a real question')).toBe(false);
    expect(readIntention(refusing())).toBeNull();
    expect(writeIntention(null, 'a real question')).toBe(false);
  });
});

describe('carrying the path out and back', () => {
  const withPath = () => {
    const store = fakeStore();
    add(store, entry(34, 'first', 100));
    add(store, entry(9, 'second', 200));
    writeIntention(store, 'what am I circling');
    return store;
  };

  it('writes a file that carries the question with the answers', () => {
    const document = JSON.parse(asFile(withPath()));
    expect(document.app).toBe('leela');
    expect(document.entries).toHaveLength(2);
    expect(document.intention).toBe('what am I circling');
  });

  it('reads its own file back', () => {
    const text = asFile(withPath());
    const fresh = fakeStore();
    const outcome = takeIn(fresh, text);
    expect(outcome?.added).toBe(2);
    expect(readAll(fresh).map((r) => r.text)).toEqual(['first', 'second']);
    expect(readIntention(fresh)).toBe('what am I circling');
  });

  /** A file is not a reason to change what somebody is playing for. */
  it('does not overwrite a question already asked', () => {
    const text = asFile(withPath());
    const mine = fakeStore();
    writeIntention(mine, 'my own question');
    takeIn(mine, text);
    expect(readIntention(mine)).toBe('my own question');
  });

  it('brings nothing in twice', () => {
    const text = asFile(withPath());
    const fresh = fakeStore();
    takeIn(fresh, text);
    const again = takeIn(fresh, text);
    expect(again?.added).toBe(0);
    expect(readAll(fresh)).toHaveLength(2);
  });

  it('refuses a file it cannot vouch for, and keeps what was there', () => {
    const mine = withPath();
    for (const bad of ['', 'not json', '{}', '{"app":"something else"}', '[]']) {
      expect(takeIn(mine, bad), bad).toBeNull();
    }
    expect(readAll(mine)).toHaveLength(2);
  });
});
