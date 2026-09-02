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

import { lastSentenceEnd } from '@leela/content';
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
    /** Provider business code, when a safe scalar was returned. */
    readonly providerCode?: string,
  ) {
    super(message);
    this.name = 'ModelError';
  }
}

/**
 * The model did not answer in time.
 *
 * Separate from a refusal because an operator acts on it differently: a refusal
 * carries a status they can look up, and a deadline that passed says only that
 * something was slow — the model, the network, or an implementation that never
 * intended to stop. It carries no status for the same reason; nothing answered.
 */
export class ModelTimeout extends ModelError {
  constructor(readonly afterMs: number) {
    super(`the model did not answer within ${Math.round(afterMs / 1000)}s`);
    this.name = 'ModelTimeout';
  }
}

export interface ProviderOptions {
  apiKey: string;
  /** Defaults to a small, cheap model — this is a companion, not an oracle. */
  model?: string;
  baseUrl?: string;
  /** Injected so tests never touch the network. */
  fetch?: typeof globalThis.fetch;
}

export interface OpenRouterOptions extends ProviderOptions {
  /** Sent so OpenRouter can attribute the traffic. */
  referer?: string;
  title?: string;
}

/**
 * How much the model is allowed to invent.
 *
 * Both shipped companions run cold: the published app posts `temperature: 0.1`
 * from `ChatScreen`, and `LeelaAiWeb3`'s `generateComment` posts `0.5`. This
 * package's own rule is that the model never supplies the teaching — the
 * canonical text is in the prompt and the model interprets it — and it was
 * running at `0.7`, the highest of the three, because nobody had set it and
 * that is a library default meant for writing prose.
 *
 * The stricter of the two published values, since the stricter one belongs to
 * the app this replaces.
 */
export const DEFAULT_TEMPERATURE = 0.1;

/**
 * How long a reply may be.
 *
 * The published app allows 800 and `LeelaAiWeb3` 1000. Brevity is asked for in
 * the prompt, where it can be judged; a ceiling does not make an answer short,
 * it makes it stop.
 */
export const DEFAULT_MAX_TOKENS = 800;

/**
 * The most of a cut-off reply that is still a whole thought.
 *
 * Trimmed to the last sentence that finished. A player reading "the plan asks
 * you to sit with what you have avoided, and the" has been handed a defect;
 * one sentence fewer is the same answer, finished.
 *
 * If nothing finished, the text is returned as it stands: half a sentence is
 * poor, and nothing at all is worse.
 */
export function whole(text: string): string {
  // The marks come from `@leela/content`, where they are counted off the texts
  // themselves. This list was written here by hand with six of them and
  // without `।` or `۔`, so a Hindi, Marathi, Punjabi, Bengali or Urdu player
  // whose reply ran out of tokens read the half sentence every other language
  // is spared — the exact thing the paragraph above calls a defect.
  const end = lastSentenceEnd(text);
  if (end < 0) return text;

  const trimmed = text.slice(0, end + 1).trim();
  return trimmed.length > 0 ? trimmed : text;
}

export const DEFAULT_MODEL = 'anthropic/claude-3.5-haiku';
export const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';
export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

export const DEFAULT_ZAI_MODEL = 'glm-4.7';
/** Pay-as-you-go. Coding Plan keys need a different path — see `zAI`. */
export const DEFAULT_ZAI_BASE_URL = 'https://api.z.ai/api/paas/v4';
export const ZAI_CODING_BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

interface ChatCompletionsConfig extends Required<Pick<ProviderOptions, 'apiKey' | 'model' | 'baseUrl' | 'fetch'>> {
  /** `openai:gpt-4o-mini` — the provider is part of the identity. */
  id: string;
  /** What to call the reply ceiling. See the note in `chatCompletions`. */
  tokenLimitField: 'max_tokens' | 'max_completion_tokens';
  headers?: Record<string, string>;
}

/**
 * The chat-completions wire format, which both providers here speak.
 *
 * OpenRouter deliberately reimplements OpenAI's endpoint, so this is one
 * client and not two: same path, same body, same reply shape. What differs is
 * the host, the default model, two attribution headers OpenRouter accepts, and
 * the name of the reply ceiling.
 *
 * **The ceiling.** OpenAI has deprecated `max_tokens` and rejects it outright
 * for reasoning models, which is what someone pointing `OPENAI_MODEL` at a
 * newer model would hit — a 400 that reads like a bad key. OpenRouter
 * normalises `max_tokens` across every model it fronts. So each provider sends
 * the name its own API prefers rather than one guess for both.
 *
 * @throws ModelError on a refused request, or a reply with no text in it, with
 *         the status attached so a caller can tell a bad key (401) from a rate
 *         limit (429) from an outage (5xx).
 */
function chatCompletions(config: ChatCompletionsConfig): LanguageModel {
  const { apiKey, model, baseUrl, fetch, headers = {} } = config;

  return {
    id: config.id,

    async complete(messages, options = {}) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...headers,
        },
        body: JSON.stringify({
          model,
          messages,
          [config.tokenLimitField]: options.maxTokens ?? DEFAULT_MAX_TOKENS,
          temperature: options.temperature ?? DEFAULT_TEMPERATURE,
        }),
        signal: options.signal,
      });

      if (!response.ok) {
        let providerCode: string | undefined;
        try {
          const refused = (await response.json()) as {
            code?: unknown;
            error?: { code?: unknown };
          };
          const code = refused.error?.code ?? refused.code;
          if (typeof code === 'string' || typeof code === 'number') providerCode = String(code);
        } catch {
          // A provider refusal does not need its body copied into a log. The
          // HTTP status remains actionable even when the body is not JSON.
        }
        throw new ModelError(
          `the model refused the request (${response.status})${providerCode ? `; provider code ${providerCode}` : ''}`,
          response.status,
          providerCode,
        );
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      };

      const choice = body.choices?.[0];
      const text = choice?.message?.content?.trim();
      if (!text) {
        throw new ModelError('the model returned an empty reply');
      }

      // A reply the ceiling cut off is not a whole reply, and it was being
      // handed to the player as if it were: `finish_reason` was never read, so
      // an answer that stopped mid-word looked exactly like one that finished.
      return choice?.finish_reason === 'length' ? whole(text) : text;
    },
  };
}

/**
 * OpenRouter, over plain fetch.
 *
 * This is what the newest of the six generations used
 * (`NeuroLeelaAgent/services/openRouterService.ts`), which is why it was
 * ported first. The published app called OpenAI directly — see `openAI`.
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

  return chatCompletions({
    apiKey,
    model,
    baseUrl,
    fetch,
    id: `openrouter:${model}`,
    tokenLimitField: 'max_tokens',
    headers: {
      ...(referer ? { 'HTTP-Referer': referer } : {}),
      ...(title ? { 'X-Title': title } : {}),
    },
  });
}

/**
 * OpenAI, over plain fetch.
 *
 * The provider the published app used — `leela/src/constants.ts` posted to
 * `api.openai.com/v1/chat/completions` with `gpt-4-1106-preview`, and
 * `LeelaAiWeb3` did the same with `gpt-4-0314`. Both keys were read out of
 * the client bundle, which is a reason to keep this one server-side.
 *
 * No `HTTP-Referer` or `X-Title`: those are OpenRouter's attribution headers,
 * and OpenAI has no use for them.
 */
export function openAI({
  apiKey,
  model = DEFAULT_OPENAI_MODEL,
  baseUrl = DEFAULT_OPENAI_BASE_URL,
  fetch = globalThis.fetch,
}: ProviderOptions): LanguageModel {
  if (!apiKey) {
    throw new ModelError('an OpenAI API key is required');
  }

  return chatCompletions({
    apiKey,
    model,
    baseUrl,
    fetch,
    id: `openai:${model}`,
    tokenLimitField: 'max_completion_tokens',
  });
}

/**
 * DeepSeek, over plain fetch.
 *
 * A third host on the same client, which is the point of having written one:
 * DeepSeek publishes an OpenAI-compatible endpoint, so adding it is a base URL
 * and a default model. It keeps `max_tokens` — the deprecation that made
 * `openAI` send `max_completion_tokens` is OpenAI's, not the format's, and
 * assuming otherwise would break every model DeepSeek serves.
 */
export function deepSeek({
  apiKey,
  model = DEFAULT_DEEPSEEK_MODEL,
  baseUrl = DEFAULT_DEEPSEEK_BASE_URL,
  fetch = globalThis.fetch,
}: ProviderOptions): LanguageModel {
  if (!apiKey) {
    throw new ModelError('a DeepSeek API key is required');
  }

  return chatCompletions({
    apiKey,
    model,
    baseUrl,
    fetch,
    id: `deepseek:${model}`,
    tokenLimitField: 'max_tokens',
  });
}

/**
 * Z.AI, over plain fetch. A fourth host on the same client.
 *
 * **The trap worth knowing about.** Z.AI sells two kinds of key against two
 * different paths. A Coding Plan key sent to the pay-as-you-go host comes back
 * as error 1113 — which reads as an expired or invalid key, and sends whoever
 * is holding a perfectly good key off to buy another one. Pass
 * `ZAI_CODING_BASE_URL` as `baseUrl` for a Coding Plan key.
 */
export function zAI({
  apiKey,
  model = DEFAULT_ZAI_MODEL,
  baseUrl = DEFAULT_ZAI_BASE_URL,
  fetch = globalThis.fetch,
}: ProviderOptions): LanguageModel {
  if (!apiKey) {
    throw new ModelError('a Z.AI API key is required');
  }

  return chatCompletions({
    apiKey,
    model,
    baseUrl,
    fetch,
    id: `zai:${model}`,
    tokenLimitField: 'max_tokens',
  });
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
