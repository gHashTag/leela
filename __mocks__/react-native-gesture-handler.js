export const Gesture = {
  Tap: jest.fn(() => ({
    onBegin: jest.fn(function () {
      return this
    }),
    onEnd: jest.fn(function () {
      return this
    })
  })),
  Pan: jest.fn(() => ({
    onUpdate: jest.fn(function () {
      return this
    }),
    onEnd: jest.fn(function () {
      return this
    })
  })),
  Race: jest.fn(function () {
    const handlers = []
    for (let i = 0; i < arguments.length; i++) handlers.push(arguments[i])
    return { gestures: handlers }
  }),
  Simultaneous: jest.fn(function () {
    const handlers = []
    for (let i = 0; i < arguments.length; i++) handlers.push(arguments[i])
    return { gestures: handlers }
  })
}

export const GestureDetector = ({ children }) => children
