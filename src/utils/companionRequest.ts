import type { ZaiStreamMessage } from './aiStream'

/** Match the production API limits without changing the player's latest words. */
export function companionRequest(messages: ZaiStreamMessage[]) {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
  if (system.length > 8000)
    throw new Error('Companion context exceeds 8000 characters')
  const turns = messages.filter((m) => m.role !== 'system')
  const latest = turns[turns.length - 1]
  if (!latest || latest.role !== 'user' || !latest.content.trim()) {
    throw new Error('Companion requires a question')
  }
  if (latest.content.length > 5000)
    throw new Error('Please keep your question within 5000 characters')
  let question = latest.content
  let history = `user: ${latest.content}`
  for (let index = turns.length - 2; index >= 0; index--) {
    const candidate = `${turns[index].role}: ${turns[index].content}\n\n${history}`
    if (candidate.length > 5000) break
    history = candidate
    question = candidate
  }
  return { system, question }
}
