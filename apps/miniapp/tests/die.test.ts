import { describe, expect, it } from 'vitest';
import { MAX_ROLL } from '@leela/engine';
import { MAX_FACE, MIN_FACE, faceFor, settle, spinDegrees, spinMs, type DieFaces } from '../src/die';

/**
 * The die the published app throws.
 *
 * `components/Dice/index.tsx` is a pressable image: you tap the die, it spins,
 * and it settles on the face you threw. The mini app had a button reading
 * "Roll" — the player was told what they threw in a sentence and never saw it.
 *
 * Two things are worth keeping out of the DOM and are asserted here: that the
 * die always shows something, and that the spin is a function of the value the
 * way the original makes it one.
 */

const FACES: DieFaces = ['/1', '/2', '/3', '/4', '/5', '/6'];

describe('the face', () => {
  it('is the one thrown, for every value the die can show', () => {
    for (let value = MIN_FACE; value <= MAX_FACE; value += 1) {
      expect(faceFor(value, FACES)).toBe(`/${value}`);
    }
  });

  it('covers everything the engine can roll', () => {
    // Not a coincidence worth relying on silently: the die has as many faces
    // as the engine has values, and a seventh value would have nowhere to go.
    expect(MAX_FACE).toBe(MAX_ROLL);
  });

  it('is never nothing, whatever it is asked for', () => {
    // A blank square where the die was reads as a broken app rather than as a
    // throw that failed.
    for (const value of [0, 7, -1, 99, 2.7, NaN, Infinity, -Infinity]) {
      const face = faceFor(value, FACES);
      expect(FACES, String(value)).toContain(face);
    }
  });

  it('truncates rather than rounds, so 2.9 is a two', () => {
    expect(faceFor(2.9, FACES)).toBe('/2');
  });
});

describe('the spin', () => {
  it('is the original formula: value over two, times five hundred', () => {
    for (let value = MIN_FACE; value <= MAX_FACE; value += 1) {
      expect(spinMs(value)).toBe((value / 2) * 500);
      expect(spinDegrees(value)).toBe(value * 360);
    }
  });

  it('makes a six feel like a six', () => {
    // The property, rather than the six numbers: a larger throw takes longer
    // and turns further, which is the whole reason the duration is tied to the
    // value instead of being a constant.
    for (let value = MIN_FACE; value < MAX_FACE; value += 1) {
      expect(spinMs(value + 1)).toBeGreaterThan(spinMs(value));
      expect(spinDegrees(value + 1)).toBeGreaterThan(spinDegrees(value));
    }
  });

  it('always finishes, whatever it is handed', () => {
    // An animation of NaN milliseconds never ends, and the die would stay
    // disabled with the game waiting behind it.
    for (const value of [0, -1, 99, NaN, Infinity, -Infinity, 2.5]) {
      const ms = spinMs(value);
      expect(Number.isFinite(ms), String(value)).toBe(true);
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(spinMs(MAX_FACE));

      const degrees = spinDegrees(value);
      expect(Number.isFinite(degrees), String(value)).toBe(true);
      expect(degrees).toBeGreaterThan(0);
    }
  });
});

describe('waiting for the spin to settle', () => {
  /**
   * The throw used to be applied after a bare `setTimeout(duration)`. A browser
   * throttles and then freezes the timers of a page nobody is looking at, so a
   * mini app switched away from mid-spin — a notification, a lock screen, a
   * glance at another chat — came back with the die disabled, the throw never
   * applied and the board never moved. Dead until reloaded, with nothing on
   * screen to say why. It happened here, in a hidden browser pane, which is how
   * it was found.
   *
   * The rule is that a spin is decoration: the wait ends when the spin can no
   * longer be seen, because the game must not depend on an animation being
   * watched to the end.
   */

  /** A world with a clock and a curtain, both under the test's control. */
  function world(startHidden = false) {
    let hidden = startHidden;
    const timers = new Map<number, { at: number; fire: () => void }>();
    const listeners = new Set<() => void>();
    let now = 0;
    let next = 1;

    return {
      host: {
        setTimeout: (fire: () => void, ms: number) => {
          const id = next;
          next += 1;
          timers.set(id, { at: now + ms, fire });
          return id;
        },
        clearTimeout: (handle: unknown) => {
          timers.delete(handle as number);
        },
        isHidden: () => hidden,
        onVisibilityChange: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
      advance(ms: number) {
        now += ms;
        for (const [id, timer] of [...timers]) {
          if (timer.at <= now) {
            timers.delete(id);
            timer.fire();
          }
        }
      },
      hide() {
        hidden = true;
        for (const listener of [...listeners]) listener();
      },
      show() {
        hidden = false;
        for (const listener of [...listeners]) listener();
      },
      pending: () => timers.size,
      watching: () => listeners.size,
    };
  }

  const resolved = async (promise: Promise<void>) => {
    let done = false;
    void promise.then(() => {
      done = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    return done;
  };

  it('waits the spin out when someone is watching', async () => {
    const w = world();
    const waiting = settle(1250, w.host);

    w.advance(1249);
    expect(await resolved(waiting)).toBe(false);

    w.advance(1);
    expect(await resolved(waiting)).toBe(true);
  });

  it('does not wait at all when the page is already hidden', async () => {
    // Nothing to watch, so nothing to wait for — and the throw lands at once.
    const w = world(true);
    expect(await resolved(settle(1250, w.host))).toBe(true);
    expect(w.pending()).toBe(0);
  });

  it('stops waiting the moment the page is hidden', async () => {
    // The defect itself: this is where the timer would have frozen and the
    // throw would never have been applied.
    const w = world();
    const waiting = settle(1250, w.host);

    w.advance(100);
    w.hide();

    expect(await resolved(waiting)).toBe(true);
  });

  it('keeps waiting when the page is merely redrawn or re-shown', async () => {
    // A visibility event that leaves the page visible is not a reason to cut
    // the spin short: the player is looking at it.
    const w = world();
    const waiting = settle(1250, w.host);

    w.show();
    expect(await resolved(waiting)).toBe(false);

    w.advance(1250);
    expect(await resolved(waiting)).toBe(true);
  });

  it('settles once, whichever comes first', async () => {
    // Both paths firing must not resolve twice or leave a timer behind: a die
    // that settles twice applies the throw twice.
    const w = world();
    const waiting = settle(1000, w.host);

    w.hide();
    w.advance(1000);

    await waiting;
    expect(w.pending()).toBe(0);
  });

  it('leaves nothing behind, whichever way it ends', async () => {
    for (const end of ['timer', 'hidden'] as const) {
      const w = world();
      const waiting = settle(500, w.host);
      if (end === 'timer') w.advance(500);
      else w.hide();
      await waiting;

      expect(w.watching(), end).toBe(0);
      expect(w.pending(), end).toBe(0);
    }
  });

  it('never rejects, because a throw is not cancellable', async () => {
    const w = world();
    const waiting = settle(0, w.host);
    w.advance(0);
    await expect(waiting).resolves.toBeUndefined();
  });
});
