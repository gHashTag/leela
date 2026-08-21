import { useColorScheme } from 'react-native'

/**
 * One palette and one measure, for every screen.
 *
 * The app had neither. `constants.ts` holds sixteen colours named after what
 * they *are* — `classicRose`, `mustard`, `brightTurquoise` — rather than after
 * what they are *for*, none of them answering to light or dark; and the screens
 * hold literals besides. `#50E3C2` appears five times in `screens/` next to a
 * `primary` that is the same value.
 *
 * A name that describes a colour cannot survive a second scheme: there is no
 * dark `classicRose`. A name that describes a role can — `text` is black on
 * paper and white on the void, and every screen that asks for `text` follows
 * without being edited.
 *
 * **The values are the board's own.** `apps/webgl/src/style.css` and
 * `theme.ts` already decided what this game looks like in each light, and those
 * decisions were measured rather than picked — the comments there record three
 * separate defects from carrying a colour onto a ground it was not measured
 * for. A screen next to the board must not be a different shade of the same
 * idea, so these are copied deliberately and named as copies.
 */

/**
 * The roles a screen may ask for, named for what they are *for*.
 *
 * Declared rather than inferred from one of the two grounds: `typeof DARK`
 * carries that ground's literal values into the type, so the light palette -
 * every value different, which is the point - does not fit its own shape.
 */
export interface Palette {
  /** The page. */
  readonly bg: string
  /** A card or a sheet on the page. */
  readonly surface: string
  /** Something lifted off that: a selected row, a well. */
  readonly raised: string
  /** Anything that must be read. */
  readonly text: string
  /** Anything read second: helpers, counters, captions. */
  readonly hint: string
  /** A hairline between two things. */
  readonly rule: string
  /** The one strong colour: a live control, a chosen row. */
  readonly accent: string
  /** Words on top of the accent. */
  readonly onAccent: string
  /** A refusal, a loss, a snake. */
  readonly danger: string
  /**
   * The way out of something the player is not obliged to finish.
   *
   * The app's own magenta, kept deliberately. `accent` is the colour of the
   * thing you are meant to do — *Next*, *Buy*, the die — and a way past it in
   * the same colour disappears into the page: on the welcome screen the skip
   * link, drawn in accent over a pale card, could not be found at all.
   *
   * One role, one colour, both schemes. Not a literal in a screen: that is how
   * the magenta got into eleven files in the first place.
   */
  readonly escape: string
}

/** The two grounds. Both measured, neither inverted from the other. */
const DARK: Palette = {
  bg: '#000000',
  surface: '#0b0d0f',
  raised: '#14171a',
  text: '#ffffff',
  hint: '#888888',
  rule: 'rgba(255, 255, 255, 0.08)',
  accent: '#00ff88',
  onAccent: '#000000',
  danger: '#f08a72',
  escape: '#ff5cf7'
}

const LIGHT: Palette = {
  bg: '#f7f4ee',
  surface: '#ffffff',
  /*
   * A card, not ivory.
   *
   * This was `#efeae0` - a warm cream that read as its own colour rather than
   * as a lift off the page, and beside anything pure white it looked yellowed.
   * The onboarding card is the clearest case: white ground, cream card, and the
   * pair argues.
   *
   * Lighter and much less yellow. It is still darker than `bg`, so the metaphor
   * holds - `raised` is a surface lifted above the page, and if it ever became
   * lighter than the page it would stop being that.
   */
  raised: '#f3f1ed',
  text: '#1a1712',
  hint: '#6b6255',
  rule: 'rgba(26, 23, 18, 0.12)',
  accent: '#0a7d4a',
  onAccent: '#ffffff',
  danger: '#b23a1f',
  // Deeper than the night's, because a bright magenta on paper is unreadable
  // at this size - the same rule every other pair here follows.
  escape: '#c40fa8'
}

/**
 * The measure, in the game's own proportion.
 *
 * Powers of phi, which is the constant this whole project is built on — and
 * the same ladder `style.css` uses, so a gap on the board and a gap on a screen
 * beside it are the same gap rather than two people's guesses.
 *
 * The screens they replace used 20, 60, 12, 5 and 30 in one file. A number
 * chosen per view is a number nobody can align to.
 */
export const SPACE = {
  /** Between a mark and its label. */
  xs: 6,
  /** Inside a control. */
  sm: 10,
  /** The default gap, and the page's own margin. */
  md: 16,
  /** Between blocks that are not related. */
  lg: 26,
  /** Around something that stands alone. */
  xl: 42
} as const

/** Type, on the same ladder. */
export const TYPE = {
  small: 13,
  body: 16,
  title: 20,
  head: 26,
  hero: 33
} as const

/** A control's least touchable height, which is Apple's number and not ours. */
export const TOUCH = 44

/** The corner every card, field and button shares. */
export const RADIUS = 14

export const paletteFor = (dark: boolean): Palette => (dark ? DARK : LIGHT)

/**
 * The palette for whatever the phone is set to.
 *
 * A hook rather than a constant read once: `useColorScheme` re-renders when the
 * setting changes, and a palette captured at import time leaves a screen in
 * yesterday's scheme until it is remounted.
 */
export const useTheme = (): Palette => paletteFor(useColorScheme() === 'dark')
