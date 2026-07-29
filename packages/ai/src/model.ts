/**
 * Talking to a model, without depending on one.
 *
 * `LanguageModel` is the whole surface: a function from messages to text. That
 * is enough for what this package does, it keeps a provider SDK out of the
 * dependency tree, and it is what lets every test run with no network and no
 * API key.
 *
 * The service this replaces reached for `process.env` inside a static method
 * and threw when nothing was set, so the failure surfaced mid-conversation
 * rather than at startup.
 */

import type { Message } from './prompts';

export interface CompletionOptions {
  /** Hard ceiling on the reply. A companion answers briefly. */
  maxTokens?: number;
  /** 0 is repetitive, 1 is loose. Around 0.7 reads as a person. */
  temperature?: number;
  /** Abort the request when it takes too long. */
  signal?: AbortSignal;
}

export interface LanguageModel {
  /** A name for logs and for telling two configured models apart. */
  readonly id: string;
  complete(messages: Message[], options?: CompletionOptions): Promise<string>;
}

export class ModelError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ModelError';
  }
}

export interface OpenRouterOptions {
  apiKey: string;
  /** Defaults to a small, cheap model — this is a companion, not an oracle. */
  model?: string;
  baseUrl?: string;
  /** Injected so tests never touch the network. */
  fetch?: typeof globalThis.fetch;
  /** Sent so OpenRouter can attribute the traffic. */
  referer?: string;
  title?: string;
}

export const DEFAULT_MODEL = 'anthropic/claude-3.5-haiku';
export const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * OpenRouter, over plain fetch.
 *
 * @throws ModelError on a missing key, a refused request, or a reply with no
 *         text in it — each with the status, so a caller can tell a bad key
 *         (401) from a rate limit (429) from an outage (5xx).
 */
export function openRouter({
  apiKey,
  model = DEFAULT_MODEL,
  baseUrl = DEFAULT_BASE_URL,
  fetch = globalThis.fetch,
  referer,
  title,
}: OpenRouterOptions): LanguageModel {
  if (!apiKey) {
    // Fail here, at configuration time, rather than on the first message.
    throw new ModelError('an OpenRouter API key is required');
  }

  return {
    id: `openrouter:${model}`,

    async complete(messages, options = {}) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(referer ? { 'HTTP-Referer': referer } : {}),
          ...(title ? { 'X-Title': title } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: options.maxTokens ?? 400,
          temperature: options.temperature ?? 0.7,
        }),
        signal: options.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new ModelError(
          `the model refused the request (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
          response.status,
        );
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const text = body.choices?.[0]?.message?.content?.trim();
      if (!text) {
        throw new ModelError('the model returned an empty reply');
      }
      return text;
    },
  };
}

/**
 * A model that returns whatever it is told to.
 *
 * For tests, and for running the game with no key at all — a companion that
 * says one fixed thing is better than a crash on every report.
 */
export function fixedModel(reply: string, id = 'fixed'): LanguageModel {
  return {
    id,
    async complete() {
      return reply;
    },
  };
}

/** Records what it was asked, for asserting on a prompt. */
export function recordingModel(reply = 'noted'): LanguageModel & {
  calls: Array<{ messages: Message[]; options?: CompletionOptions }>;
} {
  const calls: Array<{ messages: Message[]; options?: CompletionOptions }> = [];
  return {
    id: 'recording',
    calls,
    async complete(messages, options) {
      calls.push({ messages, options });
      return reply;
    },
  };
}
