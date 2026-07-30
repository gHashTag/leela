/**
 * The die, as the published app throws it.
 *
 * `components/Dice/index.tsx` is a pressable image: you tap the die itself,
 * it spins, and it comes to rest on the face you threw. The mini app had a
 * button reading "Roll" and no die at all — the player was told what they threw
 * in a sentence and never saw it.
 *
 * The two things worth keeping out of the DOM are here: which face to show, and
 * how long the spin lasts. The original ties the spin to the value —
 * `(value / 2) * 500` milliseconds — so a six takes three times as long to
 * settle as a two, and the wait is part of the throw.
 */

/** The six faces, in order, as the bundler's URLs for them. */
export type DieFaces = readonly [string, string, string, string, string, string];

export const MIN_FACE = 1;
export const MAX_FACE = 6;

/**
 * The face for a value.
 *
 * Anything that is not one of the six is the one face: a die has to show
 * something, and a blank square where the die was reads as a broken app rather
 * than as a throw that failed.
 */
export function faceFor(value: number, faces: DieFaces): string {
  const index = Math.trunc(value) - MIN_FACE;
  return faces[index] ?? faces[0];
}

/**
 * How long the spin lasts, in milliseconds.
 *
 * `(value / 2) * 500`, from `handleSpin`. Kept as a function of the value
 * rather than a constant because that is what makes a six feel like a six.
 */
export function spinMs(value: number): number {
  const clamped = Math.min(Math.max(Math.trunc(value) || MIN_FACE, MIN_FACE), MAX_FACE);
  return (clamped / 2) * 500;
}

/**
 * How far it turns.
 *
 * The original animates a value of `n` through an interpolation of one turn,
 * which is `n` turns in `n / 2 * 500` ms. Expressed in degrees so a stylesheet
 * can be handed it.
 */
export function spinDegrees(value: number): number {
  const clamped = Math.min(Math.max(Math.trunc(value) || MIN_FACE, MIN_FACE), MAX_FACE);
  return clamped * 360;
}

/**
 * What a spin needs from the outside world.
 *
 * Injected so the rule can be asserted without a browser and without waiting
 * out a real second and a quarter.
 */
export interface SpinHost {
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  /** True while the page cannot be seen — backgrounded, locked, switched away. */
  isHidden(): boolean;
  onVisibilityChange(listener: () => void): () => void;
}

/**
 * Wait for the spin to settle.
 *
 * The throw used to be applied after a bare `setTimeout(duration)`. A browser
 * throttles and then freezes timers in a page nobody is looking at, so
 * switching away from a Telegram mini app mid-spin — which on a phone is a
 * notification, a lock screen, a glance at another chat — left the die
 * disabled, the throw never applied, and the board never moved. The game was
 * dead until the page was reloaded, with nothing on screen to say why.
 *
 * So the wait ends when the spin can no longer be seen. A spin is decoration;
 * the throw is the game, and the game must not depend on an animation being
 * watched to the end.
 */
export function settle(duration: number, host: SpinHost): Promise<void> {
  // Already hidden when the throw was made: there is nothing to watch, so
  // there is nothing to wait for.
  if (host.isHidden()) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let done = false;

    const finish = (): void => {
      if (done) return;
      done = true;
      host.clearTimeout(handle);
      unsubscribe();
      resolve();
    };

    const unsubscribe = host.onVisibilityChange(() => {
      if (host.isHidden()) finish();
    });

    const handle = host.setTimeout(finish, duration);
  });
}

/** The host a browser provides. */
export function browserSpinHost(view: {
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
  document: Document;
}): SpinHost {
  return {
    setTimeout: (handler, ms) => view.setTimeout(handler, ms),
    clearTimeout: (handle) => view.clearTimeout(handle as ReturnType<typeof setTimeout>),
    isHidden: () => view.document.hidden,
    onVisibilityChange: (listener) => {
      view.document.addEventListener('visibilitychange', listener);
      return () => view.document.removeEventListener('visibilitychange', listener);
    },
  };
}
