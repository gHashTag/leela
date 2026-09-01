/**
 * When a frame is drawn, and why it is not a loop.
 *
 * A board game is still for most of its life. A permanent
 * `requestAnimationFrame` costs a phone battery for nothing, so frames are
 * drawn on demand: once after anything changes, and repeatedly only while
 * something is still moving.
 *
 * The reason this is a module of its own, and not four lines inside the
 * renderer, is a defect it took a running browser to see. `OrbitControls.update()`
 * dispatches a `change` event. The renderer listened for `change` and drew by
 * calling `update()` again — so `update` called the listener, the listener
 * called `update`, and the first resize on boot overflowed the stack before a
 * single frame reached the canvas. The app opened on a blank white page.
 *
 * Both of this app's test files passed the entire time, because neither of them
 * touches WebGL and the recursion lives in the wiring between two things that
 * are each fine. So the wiring is here, with no three.js in it, where a test can
 * hold it: `reentrantDrawDoesNotRecurse` feeds a `step` that calls `draw` and
 * requires it to return.
 */

/** Where frames come from. Injected so the tests do not need a browser. */
export interface Clock {
  request(callback: () => void): number;
  cancel(handle: number): void;
}

export interface Frames {
  /**
   * Draw one frame now, and keep drawing while `step` says something moves.
   *
   * Safe to call from inside `step`: the inner call asks for a later frame
   * rather than starting a second one.
   */
  draw(): void;
  /** Drop any frame that has been asked for and not yet drawn. */
  stop(): void;
  /** Whether a frame is waiting to be drawn. Never more than one. */
  pending(): boolean;
}

/** The browser's own, as a `Clock`. */
export const animationClock = (): Clock => ({
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
});

/**
 * @param step draws one frame, and returns whether anything is still moving.
 *             Damping is the usual reason: the camera keeps easing for a few
 *             frames after the hand comes off, and then it stops, and so does
 *             this.
 */
export function frames(step: () => boolean, clock: Clock): Frames {
  // 0 means nothing is scheduled. Real handles from `requestAnimationFrame`
  // start at 1, and a test clock is held to the same promise.
  let handle = 0;
  let drawing = false;

  const schedule = (): void => {
    if (handle === 0) handle = clock.request(onFrame);
  };

  const onFrame = (): void => {
    handle = 0;
    draw();
  };

  const draw = (): void => {
    // Re-entrancy, not recursion. This is the call that used to blow the stack.
    if (drawing) {
      schedule();
      return;
    }

    drawing = true;
    try {
      if (step()) schedule();
    } finally {
      // In a `finally` because `step` renders, and a WebGL context that has
      // been lost throws from `render`. One bad frame should cost one frame,
      // not every frame after it.
      drawing = false;
    }
  };

  return {
    draw,
    stop() {
      if (handle !== 0) {
        clock.cancel(handle);
        handle = 0;
      }
    },
    pending: () => handle !== 0,
  };
}
