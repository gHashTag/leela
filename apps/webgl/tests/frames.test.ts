import { describe, expect, it } from 'vitest';

import { frames, type Clock } from '../src/frames';

/**
 * The defect this file is about shipped, and both existing test files passed
 * over it: `OrbitControls.update()` dispatches `change`, the renderer listened
 * for `change` and drew by calling `update()` again, and the first resize on
 * boot overflowed the stack before one frame reached the canvas. The app opened
 * on a blank white page and nothing red appeared anywhere.
 *
 * Neither of the two suites touched WebGL, which is exactly why the wiring is a
 * module with no three.js in it. What follows is that recursion, in a test.
 */

/** A clock a test drives by hand. Handles start at 1, as the browser's do. */
const testClock = (): Clock & { run(): void; queued(): number; cancelled(): number[] } => {
  const pending = new Map<number, () => void>();
  const cancelled: number[] = [];
  let next = 1;

  return {
    request(callback) {
      const handle = next;
      next += 1;
      pending.set(handle, callback);
      return handle;
    },
    cancel(handle) {
      cancelled.push(handle);
      pending.delete(handle);
    },
    run() {
      // A copy, because a callback is allowed to ask for the next frame.
      const due = [...pending.entries()];
      pending.clear();
      for (const [, callback] of due) callback();
    },
    queued: () => pending.size,
    cancelled: () => cancelled,
  };
};

describe('drawing a frame', () => {
  it('returns when the step calls draw again, rather than recursing', () => {
    const clock = testClock();
    let steps = 0;
    let held: { draw(): void } | undefined;

    // The listener, as it really was: something inside the render calls back in.
    const board = frames(() => {
      steps += 1;
      held?.draw();
      return false;
    }, clock);
    held = board;

    expect(() => board.draw()).not.toThrow();
    expect(steps).toBe(1);
  });

  it('asks for one more frame when the re-entrant call happened', () => {
    const clock = testClock();
    let steps = 0;
    let held: { draw(): void } | undefined;

    const board = frames(() => {
      steps += 1;
      // Only the first frame announces a change, as damping does when it stops.
      if (steps === 1) held?.draw();
      return false;
    }, clock);
    held = board;

    board.draw();
    expect(board.pending()).toBe(true);

    clock.run();
    expect(steps).toBe(2);
    expect(board.pending()).toBe(false);
  });

  it('keeps drawing while the step says something is still moving', () => {
    const clock = testClock();
    let steps = 0;
    const board = frames(() => {
      steps += 1;
      return steps < 4;
    }, clock);

    board.draw();
    while (board.pending()) clock.run();

    expect(steps).toBe(4);
  });

  it('stops on its own when nothing moves — there is no idle loop', () => {
    const clock = testClock();
    const board = frames(() => false, clock);

    board.draw();

    expect(board.pending()).toBe(false);
    expect(clock.queued()).toBe(0);
  });

  it('never has more than one frame outstanding, however often it is asked', () => {
    const clock = testClock();
    const board = frames(() => true, clock);

    board.draw();
    for (let again = 0; again < 20; again += 1) board.draw();

    expect(clock.queued()).toBe(1);
  });

  it('drops a scheduled frame when stopped, so a disposed board draws nothing', () => {
    const clock = testClock();
    const board = frames(() => true, clock);

    board.draw();
    board.stop();

    expect(board.pending()).toBe(false);
    expect(clock.queued()).toBe(0);
    expect(clock.cancelled()).toHaveLength(1);
  });

  it('is drawable again after a step throws, rather than wedged shut', () => {
    // A WebGL context is lost and `render` raises. One bad frame should cost
    // one frame; leaving the re-entrancy flag set would cost every frame after.
    const clock = testClock();
    let fail = true;
    const board = frames(() => {
      if (fail) throw new Error('context lost');
      return false;
    }, clock);

    expect(() => board.draw()).toThrow('context lost');
    fail = false;
    expect(() => board.draw()).not.toThrow();
  });
});
