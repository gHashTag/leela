/**
 * The colours, named and measured rather than chosen by eye.
 *
 * Three pairs were below the threshold, and all three were found by running the
 * app on a simulator rather than by reading it.
 *
 * - **The disabled button was an empty grey strip.** White on `#cdc6ba` is
 *   **1.70:1**. The label was in the markup — `app.reportSave`, "Save" — and
 *   could not be read at all, on the one control a new player must press before
 *   the game will begin. WCAG 1.4.3 exempts an inactive component; it does not
 *   follow that its words should be erased, and the mini app dims a control
 *   without doing that. So the disabled state names a colour of its own.
 * - **The live button was 4.35:1**, under the 4.5 small text needs. Its label
 *   is 14 points at weight 600, which is not *large text* by the rule's
 *   definition, so the larger-text exemption does not apply.
 * - **The square the piece stands on was the same pair at 12 points** —
 *   `standingText` white on `standing` — which is the number of the square a
 *   player is on, on a board of seventy-two.
 *
 * `#b4643c` became `#a4552f`: the same terracotta a shade deeper, which is what
 * the mini app's palette did for `--snake`, `--arrow` and `--win` for the same
 * reason.
 *
 * `contrast.test.ts` measures every pair here and fails below 4.5, and refuses
 * a colour in the stylesheet that this file does not name — a palette half the
 * file ignores is a palette in name only.
 */
export const PALETTE = {
  /** The page. */
  page: '#faf7f2',
  /** A square of the board, and the panel a written account sits in. */
  cell: '#efe9df',
  /** The one strong colour: a live control, and the square the piece is on. */
  accent: '#a4552f',
  onAccent: '#ffffff',
  /** A control that cannot be pressed, and words that must still be readable. */
  shut: '#cdc6ba',
  onShut: '#4a4238',
  /** The line under the board, and the numbers on it. */
  hint: '#6b6255',
  /** A plan's text. */
  text: '#2f2a24',
  /** What the player wrote. */
  entry: '#4a433a',
  /** The edge of a field. */
  rule: '#d8d0c4',
  field: '#ffffff',
} as const;
