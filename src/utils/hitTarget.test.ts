import { MIN_TOUCH_SIZE, minTouchTarget } from './hitTarget'

describe('hitTarget', () => {
  it('exports a 44 pt minimum size', () => {
    expect(MIN_TOUCH_SIZE).toBe(44)
  })

  it('provides a centered min-size style', () => {
    expect(minTouchTarget.minWidth).toBe(MIN_TOUCH_SIZE)
    expect(minTouchTarget.minHeight).toBe(MIN_TOUCH_SIZE)
    expect(minTouchTarget.justifyContent).toBe('center')
    expect(minTouchTarget.alignItems).toBe('center')
  })
})
