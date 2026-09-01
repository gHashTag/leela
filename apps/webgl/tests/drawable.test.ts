import { describe, expect, it, vi } from 'vitest';

import { canDraw } from '../src/drawable';

/**
 * NOTES.md weak point 5: WebGL was assumed, and a browser that refuses it got
 * a black rectangle and no sentence. The probe below decides between a board
 * and a page that says why there is none, so its wrong answers cost either a
 * blank screen (false yes) or a board withheld from someone who could have
 * had one (false no). Both are checked here.
 */
describe('asking whether this browser will draw', () => {
  /** A canvas as the probe uses one: nothing but `getContext`. */
  const canvasThat = (getContext: (kind: string) => unknown): HTMLCanvasElement =>
    ({ getContext }) as unknown as HTMLCanvasElement;

  /** A context object shaped like a real one. */
  const context = { getParameter: () => 0 };

  it('says yes when webgl2 answers', () => {
    expect(canDraw(() => canvasThat((kind) => (kind === 'webgl2' ? context : null)))).toBe(true);
  });

  it('falls back through webgl and the experimental name', () => {
    expect(canDraw(() => canvasThat((kind) => (kind === 'webgl' ? context : null)))).toBe(true);
    expect(
      canDraw(() => canvasThat((kind) => (kind === 'experimental-webgl' ? context : null))),
    ).toBe(true);
  });

  it('says no when every context is refused', () => {
    expect(canDraw(() => canvasThat(() => null))).toBe(false);
  });

  it('says no to a blocker that answers with a hollow object', () => {
    // Privacy extensions hand back something truthy with nothing on it; a
    // check for null alone calls that a working board and paints black.
    expect(canDraw(() => canvasThat(() => ({})))).toBe(false);
    expect(canDraw(() => canvasThat(() => ({ getParameter: 'not a function' })))).toBe(false);
  });

  it('says no rather than throwing when getContext throws', () => {
    expect(
      canDraw(() =>
        canvasThat(() => {
          throw new Error('blocked by policy');
        }),
      ),
    ).toBe(false);
  });

  it('says no rather than throwing when the canvas cannot even be made', () => {
    expect(
      canDraw(() => {
        throw new Error('no document here');
      }),
    ).toBe(false);
  });

  it('asks a canvas it does not keep, so the real one stays contextless', () => {
    // A context taken here would be the context three.js then cannot have:
    // an element hands out one kind for its lifetime.
    const make = vi.fn(() => canvasThat(() => context));
    canDraw(make);
    expect(make).toHaveBeenCalledTimes(1);
  });
});
