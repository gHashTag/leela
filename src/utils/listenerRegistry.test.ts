import {
  activeListenerCount,
  dispose,
  disposeAll,
  disposeScreen,
  getActiveListeners,
  registerListener,
  subscribeTracked
} from './listenerRegistry'

describe('listenerRegistry', () => {
  beforeEach(() => {
    disposeAll()
  })

  it('tracks active listeners', () => {
    const unsubscribe = jest.fn()
    registerListener('TestScreen', unsubscribe)
    expect(activeListenerCount()).toBe(1)
    expect(getActiveListeners()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ screen: 'TestScreen' })
      ])
    )
  })

  it('removes a listener when disposed', () => {
    const unsubscribe = jest.fn()
    const disposeFn = registerListener('TestScreen', unsubscribe)
    disposeFn()
    expect(unsubscribe).toHaveBeenCalled()
    expect(activeListenerCount()).toBe(0)
  })

  it('disposes all listeners with disposeAll', () => {
    const a = jest.fn()
    const b = jest.fn()
    registerListener('ScreenA', a)
    registerListener('ScreenB', b)
    disposeAll()
    expect(a).toHaveBeenCalled()
    expect(b).toHaveBeenCalled()
    expect(activeListenerCount()).toBe(0)
  })

  it('disposes listeners by screen with disposeScreen', () => {
    const a = jest.fn()
    const b = jest.fn()
    registerListener('ScreenA', a)
    registerListener('ScreenB', b)
    disposeScreen('ScreenA')
    expect(a).toHaveBeenCalled()
    expect(b).not.toHaveBeenCalled()
    expect(activeListenerCount()).toBe(1)
  })

  it('wraps a subscription factory with subscribeTracked', () => {
    const unsubscribe = jest.fn()
    const disposeFn = subscribeTracked('FactoryScreen', () => unsubscribe)
    expect(activeListenerCount()).toBe(1)
    disposeFn()
    expect(unsubscribe).toHaveBeenCalled()
    expect(activeListenerCount()).toBe(0)
  })

  it('handles dispose for unknown ids gracefully', () => {
    expect(() => dispose('missing-id')).not.toThrow()
  })
})
