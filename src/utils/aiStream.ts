import { OPEN_AI_KEY, ZAI_PLAN } from '@env'

const ZAI_CODING_BASE_URL = 'https://api.z.ai/api/coding/paas/v4'
const ZAI_DEFAULT_BASE_URL = 'https://api.z.ai/api/paas/v4'
const ZAI_DEFAULT_MODEL = 'glm-4.6'
const SSE_DONE = '[DONE]'

const getBaseURL = () =>
  ZAI_PLAN === 'coding' ? ZAI_CODING_BASE_URL : ZAI_DEFAULT_BASE_URL

export interface ZaiStreamMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ZaiStreamOptions {
  messages: ZaiStreamMessage[]
  model?: string
  maxTokens?: number
  temperature?: number
  thinking?: { type: 'enabled' | 'disabled' }
}

export interface ZaiStreamCallbacks {
  onReasoning?: (chunk: string, fullReasoning: string) => void
  onContent?: (chunk: string, fullContent: string) => void
  onFinish?: (result: ZaiStreamResult) => void
  onError?: (error: Error) => void
}

export interface ZaiStreamResult {
  content: string
  reasoning: string
  finishReason: string
  model: string
  usage?: unknown
}

function parseSseEvents(raw: string) {
  const events = raw.split('\n\n')
  const parsed: unknown[] = []

  for (const event of events) {
    const trimmed = event.trim()
    if (!trimmed) continue

    const data = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('')

    if (!data || data === SSE_DONE) continue

    try {
      parsed.push(JSON.parse(data))
    } catch {
      // Incomplete chunk or ping — wait for the next bytes.
    }
  }

  return parsed
}

export const streamZaiChat = (
  options: ZaiStreamOptions,
  callbacks: ZaiStreamCallbacks
): Promise<ZaiStreamResult> => {
  const baseURL = getBaseURL()
  const model = options.model ?? ZAI_DEFAULT_MODEL
  const body = {
    model,
    messages: options.messages,
    stream: true,
    max_tokens: options.maxTokens ?? 4000,
    temperature: options.temperature ?? 0.1,
    ...(options.thinking ? { thinking: options.thinking } : {})
  }

  return new Promise((resolve, reject) => {
    let reasoning = ''
    let content = ''
    let finishReason = ''
    let usage: unknown
    let buffer = ''
    // How much of responseText has already been copied into `buffer`. Its own
    // counter on purpose: `buffer` shrinks every time an event is parsed out of
    // it, so using `buffer.length` as the read offset re-read text that had
    // already been consumed and fed it through again - duplicating the
    // reasoning and corrupting the JSON that followed.
    let readOffset = 0
    let done = false

    const applyEvent = (event: unknown) => {
      const parsed = event as {
        choices?: {
          delta?: { reasoning_content?: string; content?: string }
          finish_reason?: string
        }[]
        usage?: unknown
      }
      const choice = parsed.choices?.[0]
      const delta = choice?.delta

      if (delta?.reasoning_content) {
        const chunkText = delta.reasoning_content
        reasoning += chunkText
        callbacks.onReasoning?.(chunkText, reasoning)
      }

      if (delta?.content) {
        const chunkText = delta.content
        content += chunkText
        callbacks.onContent?.(chunkText, content)
      }

      if (choice?.finish_reason) {
        finishReason = choice.finish_reason
      }

      if (parsed.usage) {
        usage = parsed.usage
      }
    }

    const request = new XMLHttpRequest()
    request.open('POST', `${baseURL}/chat/completions`)
    request.setRequestHeader('Authorization', `Bearer ${OPEN_AI_KEY}`)
    request.setRequestHeader('Content-Type', 'application/json')
    request.setRequestHeader('Accept', 'text/event-stream')
    /*
     * Three minutes, because this model thinks for a long time.
     *
     * It was two, and the board that asks through this client allows three -
     * so a reasoning pass that ran past 120 seconds was aborted here while the
     * page was still waiting, and the player saw the companion's offline
     * sentence with nothing wrong at either end. Measured runs of this model
     * have spent over twenty thousand characters reasoning before saying a
     * word; two minutes is not a generous budget for that, it is a coin toss.
     *
     * Matched to `TIMEOUT_MS` in the board's `asked.ts`. Two timeouts on one
     * request should not disagree: the shorter one silently wins and the longer
     * one becomes a comment.
     */
    request.timeout = 180000

    request.onprogress = () => {
      const responseText = request.responseText
      if (responseText.length <= readOffset) return

      buffer += responseText.substring(readOffset)
      readOffset = responseText.length

      // Drain every complete event, not just the first: one progress event
      // routinely carries several SSE frames, and the rest used to sit in the
      // buffer until the next chunk happened to arrive.
      let idx = buffer.indexOf('\n\n')
      while (idx !== -1) {
        const chunk = buffer.substring(0, idx)
        buffer = buffer.substring(idx + 2)
        for (const event of parseSseEvents(chunk)) {
          applyEvent(event)
        }
        idx = buffer.indexOf('\n\n')
      }
    }

    request.onload = () => {
      if (done) return

      if (request.status < 200 || request.status >= 300) {
        const message = `Z.AI streaming failed: HTTP ${request.status} — ${request.responseText}`
        const error = new Error(message)
        callbacks.onError?.(error)
        reject(error)
        return
      }

      // Whatever progress never delivered, plus anything after the last blank
      // line. Goes through applyEvent so the final chunk reaches the screen -
      // this path used to update the totals silently, and the last thing the
      // model said never showed up.
      if (request.responseText.length > readOffset) {
        buffer += request.responseText.substring(readOffset)
        readOffset = request.responseText.length
      }

      if (buffer.trim()) {
        for (const event of parseSseEvents(buffer)) {
          applyEvent(event)
        }
        buffer = ''
      }

      done = true
      const result: ZaiStreamResult = {
        content,
        reasoning,
        finishReason: finishReason || 'stop',
        model,
        usage
      }
      callbacks.onFinish?.(result)
      resolve(result)
    }

    request.onerror = () => {
      const error = new Error('Z.AI streaming request failed (network error)')
      callbacks.onError?.(error)
      reject(error)
    }

    request.ontimeout = () => {
      const error = new Error('Z.AI streaming request timed out')
      callbacks.onError?.(error)
      reject(error)
    }

    request.onabort = () => {
      const error = new Error('Z.AI streaming request was aborted')
      callbacks.onError?.(error)
      reject(error)
    }

    request.send(JSON.stringify(body))
  })
}
