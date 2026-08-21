import { readFileSync } from 'fs'
import { join } from 'path'

import { FREE_THROWS } from './pricing'

/**
 * The two sides of the bridge must agree about the free allowance, and no
 * translation may hold an opinion about it.
 *
 * Both halves of this file guard a defect that actually shipped: the board gave
 * three throws, ten translation files promised two reports, and nothing
 * anywhere compared the two sentences.
 */

const LOCALES = [
  'ar',
  'bn',
  'en',
  'fr',
  'mr',
  'ms',
  'ru',
  'te',
  'tr',
  'uk'
] as const

/** Every digit a translator might reach for, not just the Latin ones. */
const ANY_DIGIT = /[0-9٠-٩۰-۹०-९০-৯౦-౯]/

const localeAt = (lang: string) =>
  JSON.parse(
    readFileSync(join(__dirname, 'locales', lang, 'translation.json'), 'utf8')
  )

describe('the free allowance', () => {
  it('is the same number the board enforces', () => {
    // `toll.ts` is where the die is actually stopped. Read rather than
    // remembered: a constant copied by hand is a constant that drifts, which is
    // exactly how the app came to promise two of something the game counted
    // three of.
    const toll = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        'leela',
        'apps',
        'webgl',
        'src',
        'toll.ts'
      ),
      'utf8'
    )
    const declared = toll.match(/FREE_THROWS\s*=\s*(\d+)/)
    expect(declared).not.toBeNull()
    expect(Number(declared?.[1])).toBe(FREE_THROWS)
  })

  it('is a number the player could actually reach', () => {
    // A trial of zero is a paywall with extra steps; a trial of fifty is not a
    // trial. This is a sanity rail, not a preference.
    expect(FREE_THROWS).toBeGreaterThan(0)
    expect(FREE_THROWS).toBeLessThan(20)
  })
})

describe('what the paywall says in every language', () => {
  it('never spells the count out, so it cannot be wrong in one language only', () => {
    // The count arrives through interpolation. A digit written into the
    // sentence is the defect this file exists for: it was `2` in all ten files
    // while the game gave three, and the sentence read plausibly in each of
    // them.
    for (const lang of LOCALES) {
      const strings = localeAt(lang)
      const claims = [
        strings.descriptionSubscriptions,
        strings.subscriptionHelper?.message
      ].filter(Boolean) as string[]

      // Something must be there to check, in every language.
      expect(claims.length).toBeGreaterThan(0)

      for (const claim of claims) {
        expect(claim).toContain('{{count}}')
        // The interpolation is removed before looking, or its own braces would
        // never contain a digit anyway and a real one could hide beside it.
        expect(ANY_DIGIT.test(claim.replace(/\{\{count\}\}/g, ''))).toBe(false)
      }
    }
  })

  it('promises Pro only where every language has the words for it', () => {
    // A feature listed in English and missing in Telugu renders as its own key
    // - `proFeatureExplainer.features.guide.title` - printed at the player in
    // the middle of a purchase.
    const english = localeAt('en').proFeatureExplainer.features
    const keys = Object.keys(english)
    expect(keys.length).toBeGreaterThan(0)

    for (const lang of LOCALES) {
      const features = localeAt(lang).proFeatureExplainer?.features
      expect(features).toBeDefined()
      for (const key of keys) {
        expect(features[key]?.title).toBeTruthy()
        expect(features[key]?.body).toBeTruthy()
      }
    }
  })
})
