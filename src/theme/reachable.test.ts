import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Everything a player can actually reach follows the phone.
 *
 * The app decides light or dark once, in `Navigation.tsx`, from
 * `useColorScheme()` - the system setting - and hands it to the navigation
 * container. That is the right answer and it was already there. What broke the
 * promise was the screens: a sheet that spelled `white` for its card and
 * `black` for its type opens as a rectangle of daylight on a dark phone no
 * matter what the container was told, and the paywall's sample answer did
 * exactly that, one tap from a purchase.
 *
 * So this checks the surface rather than the setting. Every file below is a
 * screen or a control a player meets today; none of them may name a colour.
 *
 * **`rgba(...)` is allowed and hex is not.** A scrim over a photograph or
 * behind a modal is shadow, not surface: it is black or white *because it is
 * dimming something*, and it stays that way in both schemes. A hex value is
 * always a role wearing a disguise.
 */

/**
 * The reachable surface, as of the 3D board becoming the app.
 *
 * The tab bar renders `null` and nothing navigates to the feed, the flat game,
 * the profile or the poster, so those screens - and the components that belong
 * only to them - are not in this list. They still hold colours of their own.
 * When one of them is given a way back in, it belongs here first.
 */
const REACHABLE = [
  'screens/OnboardingScreen/index.tsx',
  'screens/Tabs/BoardScreen/index.tsx',
  'screens/SubscriptionScreen/index.tsx',
  'screens/SubscriptionScreen/SampleAnswerModal.tsx',
  'components/ProFeatureExplainer/index.tsx',
  'components/PurchaseButton/index.tsx',
  'components/GiftSubscriptionButton/index.tsx',
  'components/PayWhatYouWantOption/index.tsx',
  'components/TrialTimer/index.tsx'
] as const

/** The sixteen colours in `constants.ts`, none of which answers to a scheme. */
const NAMED = [
  'primary',
  'secondary',
  'gray',
  'white',
  'black',
  'dimGray',
  'lightGray',
  'classicRose',
  'mustard',
  'fuchsia',
  'trueBlue',
  'paleBlue',
  'brightTurquoise',
  'red',
  'orange'
]

const sourceOf = (file: string) =>
  readFileSync(join(__dirname, '..', file), 'utf8')

/**
 * The file with its comments removed.
 *
 * Every one of these files explains in prose which colour it used to spell out
 * - "it was `secondary`", "`trueBlue`", "white paper and black type" - and a
 * check that reads the comments fails on the very sentences that record the
 * fix.
 */
const codeOf = (file: string) =>
  sourceOf(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

describe('the screens a player can reach', () => {
  it.each(REACHABLE)('does not spell a colour out: %s', (file) => {
    const code = codeOf(file)
    // `rgba(` is the one form allowed, and only as a scrim.
    const hex = code.match(/'#[0-9a-fA-F]{3,8}'/g) ?? []
    expect(hex).toEqual([])
  })

  it.each(REACHABLE)('takes no colour from `constants`: %s', (file) => {
    const code = codeOf(file)
    // Only the import list matters: `captureException` and `goBack` live in the
    // same module and are perfectly fine to take from it.
    const imports = code.match(/import\s*\{([^}]*)\}\s*from\s*'[^']*constants'/g)
    const taken = (imports ?? [])
      .flatMap((line) => line.replace(/[\s\S]*\{|\}[\s\S]*/g, '').split(','))
      .map((name) => name.trim())
      .filter(Boolean)

    expect(taken.filter((name) => NAMED.includes(name))).toEqual([])
  })

  it.each(REACHABLE)('asks the palette instead: %s', (file) => {
    // A screen with no colours at all would pass the two checks above by saying
    // nothing. Each of these draws something, so each must reach the theme -
    // whether by the hook, by `paletteFor`, or by the measure it shares.
    const code = codeOf(file)
    expect(/useTheme|paletteFor|SPACE|TYPE|RADIUS|TOUCH/.test(code)).toBe(true)
  })
})

describe('the setting itself', () => {
  it('comes from the phone rather than from a stored preference', () => {
    // The container is handed a theme chosen from `useColorScheme()`. If this
    // ever becomes a constant, every screen below it goes with it, and no
    // amount of palette discipline in the screens would show.
    const nav = readFileSync(join(__dirname, '..', 'Navigation.tsx'), 'utf8')
    expect(nav).toMatch(/useColorScheme\(\)\s*===\s*'dark'/)
    expect(nav).toMatch(/theme=\{theme\}/)
  })
})
