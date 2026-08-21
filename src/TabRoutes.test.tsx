import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * The tab bar and the navigator, kept saying the same thing.
 *
 * A route's screen lives in `Navigation.tsx` and its label lives in
 * `TabBar.tsx`, which is the same list written twice. Swapping a screen in one
 * and forgetting the other does not fail: the tab simply names something that
 * is not behind it.
 *
 * Found exactly that way. The 3D board took the slot the online game had left
 * commented out, and `TabBar` went on labelling it `tabRoute.onlineGame` — a
 * tab named for a screen that had not existed there for a year. Then the board
 * moved to the first tab and the same trap was one line away a second time.
 */

const HERE = __dirname
const NAVIGATION = readFileSync(join(HERE, 'Navigation.tsx'), 'utf8')
const TAB_BAR = readFileSync(join(HERE, 'TabBar.tsx'), 'utf8')

/** `TAB_BOTTOM_n` -> the `title` the navigator gives it. */
function titlesInNavigation(): Map<string, string> {
  const found = new Map<string, string>()
  for (const match of NAVIGATION.matchAll(
    /name="(TAB_BOTTOM_\d)"[\s\S]{0,200}?title:\s*'([^']+)'/g
  )) {
    const [, route = '', title = ''] = match
    found.set(route, title)
  }
  return found
}

/** `TAB_BOTTOM_n` -> the label the tab bar prints. */
function labelsInTabBar(): Map<string, string> {
  const found = new Map<string, string>()
  for (const match of TAB_BAR.matchAll(/(TAB_BOTTOM_\d):\s*'([^']+)'/g)) {
    const [, route = '', label = ''] = match
    found.set(route, label)
  }
  return found
}

describe('the tabs are named once', () => {
  it('reads both files, so a rename in either is visible here', () => {
    // The reader itself can go wrong — a changed attribute order would make
    // both maps empty and every assertion below pass on nothing.
    expect(titlesInNavigation().size).toBeGreaterThan(0)
    expect(labelsInTabBar().size).toBeGreaterThan(0)
  })

  it('gives every registered tab the label the tab bar prints for it', () => {
    // Compared as whole maps rather than route by route: jest's `expect` takes
    // no message, so an assertion inside a loop fails without saying which
    // route it was about, and the diff of two objects says it for free.
    const labels = labelsInTabBar()
    const registered = titlesInNavigation()
    const printed = new Map(
      [...registered.keys()].map((route) => [route, labels.get(route)])
    )

    expect(Object.fromEntries(printed)).toEqual(Object.fromEntries(registered))
  })

  it('opens on the board in three dimensions', () => {
    // The app's front door, and the reason this file exists: the game the app
    // opens on is the 3D one.
    expect(NAVIGATION).toContain("initialRouteName={'TAB_BOTTOM_0'}")
    expect(titlesInNavigation().get('TAB_BOTTOM_0')).toBe('tabRoute.board')
    expect(NAVIGATION).toMatch(
      /name="TAB_BOTTOM_0"[\s\S]{0,120}?component=\{BoardScreen\}/
    )
  })
})
