import { deepSeek, nvidia, openAI, openRouter, zAI, ZAI_CODING_BASE_URL, type LanguageModel } from './model';
import { keysFrom, pooled } from './pool';

/** Provider order is shared by every server; stored legacy keys remain available. */
export const COMPANION_PROVIDERS = ['NVIDIA', 'OPENAI', 'DEEPSEEK', 'ZAI', 'OPENROUTER'] as const;

export function companionFromEnvironment(
  env: Record<string, string | undefined>,
  options: { fetch?: typeof globalThis.fetch; log?: (message: string) => void } = {},
): { provider: (typeof COMPANION_PROVIDERS)[number]; model: LanguageModel } | undefined {
  const provider = COMPANION_PROVIDERS.find((name) => env[`${name}_API_KEY`]?.trim());
  if (!provider) return undefined;
  const apiKey = env[`${provider}_API_KEY`]!.trim();
  const model = env[`${provider}_MODEL`]?.trim() || undefined;
  const config = { apiKey, model, fetch: options.fetch };
  switch (provider) {
    case 'NVIDIA': return { provider, model: nvidia(config) };
    case 'OPENAI': return { provider, model: openAI(config) };
    case 'DEEPSEEK': return { provider, model: deepSeek(config) };
    case 'OPENROUTER': return { provider, model: openRouter({ ...config, referer: 'https://github.com/gHashTag/leela', title: 'Leela' }) };
    case 'ZAI': {
      const keys = keysFrom('ZAI_API_KEY', env);
      const modelFor = (key: string) => zAI({ ...config, apiKey: key, baseUrl: env.ZAI_PLAN?.trim() === 'coding' ? ZAI_CODING_BASE_URL : undefined });
      return { provider, model: keys.length === 1 ? modelFor(keys[0]!) : pooled({ keys, modelFor, log: options.log }) };
    }
  }
}
