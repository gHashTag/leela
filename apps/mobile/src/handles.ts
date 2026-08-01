/**
 * The names a test reaches this app's controls by.
 *
 * The app had none. Eleven controls, not one `testID` and not one
 * `accessibilityLabel`, so nothing outside the process could find the die, the
 * writing box, or the button that starts the game — and nothing inside it could
 * either. A screen reader met the same wall.
 *
 * **Named here rather than typed at each site**, because a name that lives in
 * two places is a name that will differ in one of them: a suite that reaches
 * for `roll` while the screen says `roll-button` fails with *not found*, which
 * reads exactly like the control being gone. `handles.test.ts` holds every one
 * of these to a control in `App.tsx`, and holds every control to having one.
 *
 * They are `testID`s **and** accessibility labels. The first is for a test, the
 * second is for a person who cannot see the screen, and there is no reason for
 * this app to answer only one of them.
 */
export const HANDLE = {
  /**
   * The square the player is standing on, drawn only when there is one.
   *
   * Its presence is the answer to *are they on the board* — the same question
   * `squareToRead` asks, rather than a second one written for a test. A player
   * who has not entered stands on 68 with no square to read, so this is absent;
   * it appears on the throw that puts them in play.
   */
  square: 'standing-on',

  /**
   * The part of the screen that scrolls: the board, the square's text and what
   * the player wrote about it.
   *
   * Named because a walk has to scroll it. Detox finds a scroll view by its
   * native class, and under the new architecture that is
   * `RCTScrollViewComponentView` rather than `RCTScrollView` — a matcher that
   * is right for one renderer and silently finds nothing under the other. A
   * name of our own does not change when React Native does.
   */
  page: 'page',

  /** Opens and closes the rules book. */
  rules: 'rules',

  /** What the player is playing for, and the button that keeps it. */
  intention: 'intention-field',
  intentionSave: 'intention-save',

  /** The account owed for the square just arrived on. */
  report: 'report-field',
  reportSave: 'report-save',

  /** The die. The one control the whole game runs through. */
  roll: 'roll',

  /** This square, as a message somebody else can read. */
  shareSquare: 'share-square',
  /** The whole path, as a file. */
  sharePath: 'share-path',

  /** Taking one back: either a square or a whole path. */
  paste: 'paste-field',
  pasteTake: 'paste-take',

  /** Begin again, keeping what was written. */
  restart: 'restart',
} as const;

export type Handle = (typeof HANDLE)[keyof typeof HANDLE];

/**
 * What the board's own squares are called.
 *
 * A function rather than seventy-two constants: the board is `BOARD_ROWS` and a
 * list written out here would be a second copy of it, which is the defect this
 * repository has spent six passes removing from the *rules*.
 */
export function squareHandle(plan: number): string {
  return `square-${plan}`;
}
