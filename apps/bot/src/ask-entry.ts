/**
 * Standalone ask route for the web board (t27.ai/apps/leela).
 * Same wire as apps/bot serveAsk — model + ZAI stream, no Telegram.
 * The model key arrives through the EnvironmentFile; never in this file.
 */
import { serveAsk, type Streamed } from './serve'
import {
  DEFAULT_ZAI_BASE_URL,
  DEFAULT_ZAI_MODEL,
  ModelError,
  ZAI_CODING_BASE_URL,
  zAI,
  type LanguageModel,
} from '@leela/ai'

// Provider selection: AI_PROVIDER=nvidia wins when its key is present;
// Z.AI stays as the fallback. Both speak the OpenAI chat wire.
const useNvidia = (): boolean =>
  process.env.AI_PROVIDER === 'nvidia' && Boolean(process.env.NVIDIA_API_KEY)

const model: LanguageModel = useNvidia()
  ? ({
      // OpenAI-compatible: the provider client only needs the base and key.
      ...zAI({
        apiKey: process.env.NVIDIA_API_KEY as string,
        model: process.env.AI_MODEL,
        baseUrl: process.env.AI_BASE_URL,
      }),
      modelId: process.env.AI_MODEL ?? 'nvidia/llama-3.1-70b-instruct',
    } as LanguageModel)
  : zAI({
      apiKey: process.env.ZAI_API_KEY as string,
      model: process.env.ZAI_MODEL,
      baseUrl: process.env.ZAI_PLAN === 'coding' ? ZAI_CODING_BASE_URL : undefined,
    })

function nvidiaStream(apiKey: string): (ask: { system: string; question: string; maxTokens: number; signal?: AbortSignal }) => Promise<AsyncIterable<Streamed>> {
  const baseUrl = process.env.AI_BASE_URL ?? 'https://integrate.api.nvidia.com/v1'
  const nvidiaModel = process.env.AI_MODEL ?? 'nvidia/llama-3.1-70b-instruct'

  return async ({ system, question, maxTokens, signal }) => {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: nvidiaModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: question },
        ],
        max_tokens: maxTokens,
        temperature: 0.6,
        stream: true,
      }),
      signal,
    })

    if (!upstream.ok || !upstream.body) {
      const detail = upstream.ok ? 'no body' : await upstream.text().catch(() => '')
      throw new ModelError(
        `the model refused the request (${upstream.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        upstream.status,
      )
    }

    return deltasOf(upstream.body)
  }
}

function zaiStream(apiKey: string): (ask: { system: string; question: string; maxTokens: number; signal?: AbortSignal }) => Promise<AsyncIterable<Streamed>> {
  const baseUrl = process.env.ZAI_PLAN === 'coding' ? ZAI_CODING_BASE_URL : DEFAULT_ZAI_BASE_URL
  const zaiModel = process.env.ZAI_MODEL ?? DEFAULT_ZAI_MODEL

  return async ({ system, question, maxTokens, signal }) => {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: zaiModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: question },
        ],
        max_tokens: maxTokens,
        temperature: 0.6,
        stream: true,
        thinking: { type: 'enabled' },
      }),
      signal,
    })

    if (!upstream.ok || !upstream.body) {
      const detail = upstream.ok ? 'no body' : await upstream.text().catch(() => '')
      throw new ModelError(
        `the model refused the request (${upstream.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        upstream.status,
      )
    }

    return deltasOf(upstream.body)
  }
}

async function* deltasOf(body: ReadableStream<Uint8Array>): AsyncIterable<Streamed> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let cut = buffer.indexOf('\n\n')
      while (cut !== -1) {
        const frame = buffer.slice(0, cut)
        buffer = buffer.slice(cut + 2)
        cut = buffer.indexOf('\n\n')

        const data = frame
          .split('\n')
          .filter((row) => row.startsWith('data:'))
          .map((row) => row.slice(5).trim())
          .join('')
        if (!data || data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>
          }
          const delta = parsed.choices?.[0]?.delta
          if (delta?.reasoning_content) yield { thinking: delta.reasoning_content }
          if (delta?.content) yield { text: delta.content }
        } catch {
          // A half-delivered frame is not an error; the next read completes it.
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

const stream = useNvidia()
  ? nvidiaStream(process.env.NVIDIA_API_KEY as string)
  : process.env.ZAI_API_KEY
    ? zaiStream(process.env.ZAI_API_KEY)
    : undefined

serveAsk({ model, stream })
