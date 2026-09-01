/**
 * Whether this browser will draw the board at all.
 *
 * NOTES.md names it as weak point 5: WebGL is assumed, and where a browser
 * refuses it — a locked-down build, a blocklisted driver, a privacy extension
 * that spoofs the context away — the page is simply black with nothing said.
 * The rest of the app does not need a canvas: the plans are text, the
 * companion is a conversation, the die is arithmetic. So the honest answer is
 * not a blank screen and not a refusal to load; it is the sheet, working,
 * with one sentence about the half that cannot be drawn.
 *
 * Asked of a throwaway canvas rather than of the real one, because a context
 * taken here would be the context `three` then cannot have: a canvas element
 * hands out one kind of context for its lifetime.
 */
export function canDraw(make: () => HTMLCanvasElement): boolean {
  try {
    const probe = make();
    const context =
      probe.getContext('webgl2') ??
      probe.getContext('webgl') ??
      probe.getContext('experimental-webgl');
    // Some blockers answer with an object that has no methods rather than
    // with null, so the probe asks for something every real context has.
    return Boolean(
      context && typeof (context as WebGLRenderingContext).getParameter === 'function',
    );
  } catch {
    // A throwing getContext is a refusal like any other, and a page that dies
    // proving it cannot draw has told the player less than a black screen.
    return false;
  }
}
