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
    let done = false

    const request = new XMLHttpRequest()
    request.open('POST', `${baseURL}/chat/completions`)
    request.setRequestHeader('Authorization', `Bearer ${OPEN_AI_KEY}`)
    request.setRequestHeader('Content-Type', 'application/json')
    request.setRequestHeader('Accept', 'text/event-stream')
    request.timeout = 120000

    request.onprogress = () => {
      const responseText = request.responseText
      const newText = responseText.substring(buffer.length)
      if (!newText) return

      buffer += newText
      const idx = buffer.indexOf('\n\n')
      if (idx === -1) return

      const chunk = buffer.substring(0, idx)
      buffer = buffer.substring(idx + 2)

      const events = parseSseEvents(chunk)
      for (const event of events) {
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

      // Drain any bytes left after the last progress event.
      if (buffer.trim()) {
        const events = parseSseEvents(buffer)
        for (const event of events) {
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
            reasoning += delta.reasoning_content
          }
          if (delta?.content) {
            content += delta.content
          }
          if (choice?.finish_reason) {
            finishReason = choice.finish_reason
          }
          if (parsed.usage) {
            usage = parsed.usage
          }
        }
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
