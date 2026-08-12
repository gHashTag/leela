import { streamZaiChat } from './aiStream'

/**
 * A stand-in for the streaming XHR. `emit` appends to responseText the way a
 * real response grows - cumulative, never reset - which is exactly the shape
 * the parser got wrong.
 */
class FakeXHR {
  static instance: FakeXHR

  status = 200
  responseText = ''
  onprogress: (() => void) | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeout: (() => void) | null = null
  onabort: (() => void) | null = null
  timeout = 0

  constructor() {
    FakeXHR.instance = this
  }

  open() {}
  setRequestHeader() {}
  send() {}

  emit(text: string) {
    this.responseText += text
    this.onprogress?.()
  }

  finish() {
    this.onload?.()
  }
}

const frame = (delta: Record<string, string>) =>
  `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`

describe('streamZaiChat', () => {
  const original = global.XMLHttpRequest

  beforeEach(() => {
    // @ts-expect-error - the fake implements only what the client touches.
    global.XMLHttpRequest = FakeXHR
  })

  afterEach(() => {
    global.XMLHttpRequest = original
  })

  const run = () => {
    const reasoning: string[] = []
    const content: string[] = []
    const promise = streamZaiChat(
      { messages: [{ role: 'user', content: 'hi' }] },
      {
        onReasoning: (chunk) => reasoning.push(chunk),
        onContent: (chunk) => content.push(chunk)
      }
    )
    return { promise, reasoning, content }
  }

  it('reports each reasoning chunk exactly once across progress events', async () => {
    const { promise, reasoning } = run()
    const xhr = FakeXHR.instance

    // Three deliveries. The offset bug re-read everything already consumed on
    // every call after the first, so chunks arrived repeatedly.
    xhr.emit(frame({ reasoning_content: 'first ' }))
    xhr.emit(frame({ reasoning_content: 'second ' }))
    xhr.emit(frame({ reasoning_content: 'third' }))
    xhr.finish()

    const result = await promise
    expect(reasoning).toEqual(['first ', 'second ', 'third'])
    expect(result.reasoning).toBe('first second third')
  })

  it('drains every frame delivered in one progress event', async () => {
    const { promise, reasoning } = run()
    const xhr = FakeXHR.instance

    // One delivery carrying three frames. Only the first used to be parsed.
    xhr.emit(
      frame({ reasoning_content: 'a' }) +
        frame({ reasoning_content: 'b' }) +
        frame({ reasoning_content: 'c' })
    )
    xhr.finish()

    const result = await promise
    expect(reasoning).toEqual(['a', 'b', 'c'])
    expect(result.reasoning).toBe('abc')
  })

  it('delivers a trailing frame that never got a progress event', async () => {
    const { promise, content } = run()
    const xhr = FakeXHR.instance

    xhr.emit(frame({ content: 'begin ' }))
    // Arrives with the load event: the old drain added it to the total but
    // never told the screen.
    xhr.responseText += frame({ content: 'end' })
    xhr.finish()

    const result = await promise
    expect(content).toEqual(['begin ', 'end'])
    expect(result.content).toBe('begin end')
  })

  it('separates reasoning from the answer', async () => {
    const { promise, reasoning, content } = run()
    const xhr = FakeXHR.instance

    xhr.emit(frame({ reasoning_content: 'thinking' }))
    xhr.emit(frame({ content: 'answer' }))
    xhr.finish()

    const result = await promise
    expect(reasoning).toEqual(['thinking'])
    expect(content).toEqual(['answer'])
    expect(result.reasoning).toBe('thinking')
    expect(result.content).toBe('answer')
  })
})
