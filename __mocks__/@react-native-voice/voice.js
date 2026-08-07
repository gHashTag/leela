const handlers = {
  onSpeechResults: null,
  onSpeechError: null
}

export default {
  destroy: jest.fn().mockResolvedValue(undefined),
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  isAvailable: jest.fn().mockResolvedValue(true),
  set onSpeechResults(fn) {
    handlers.onSpeechResults = fn
  },
  get onSpeechResults() {
    return handlers.onSpeechResults
  },
  set onSpeechError(fn) {
    handlers.onSpeechError = fn
  },
  get onSpeechError() {
    return handlers.onSpeechError
  }
}
