import { hasProEntitlement } from './entitlement'

describe('paid access is independent of the online board mode', () => {
  it.each([
    undefined,
    null,
    {},
    { entitlements: {} },
    { entitlements: { active: {} } }
  ])('missing entitlement never grants access (%p)', (info) =>
    expect(hasProEntitlement(info)).toBe(false)
  )
  it('recognizes the active App Store entitlement without an online flag', () => {
    expect(
      hasProEntitlement({ entitlements: { active: { 'pro plan': {} } } })
    ).toBe(true)
  })
  it('does not grant access for an inactive entitlement or an unrelated product', () => {
    expect(
      hasProEntitlement({
        entitlements: { all: { 'pro plan': {} }, active: { other: {} } }
      })
    ).toBe(false)
  })
})
import { it } from '@jest/globals'
