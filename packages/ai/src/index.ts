/**
 * @leela/ai — the companion, resting on the canonical text.
 *
 * The service this replaces asked a model to invent a description of the plan
 * a player had landed on, while the traditional text for that plan sat unused
 * in the repository in 22 languages. Here the model never supplies the
 * teaching; it only helps a player meet it.
 */

export {
  MAX_HISTORY,
  MAX_HISTORY_CHARS,
  MAX_JOURNEY_CHARS,
  MAX_JOURNEY_ENTRIES,
  MAX_JOURNEY_ENTRY_CHARS,
  MAX_INTENTION_CHARS,
  MAX_REPORT_CHARS,
  MAX_RETURN_CHARS,
  MAX_RETURN_ENTRIES,
  MAX_PLAN_CHARS,
  MAX_RULES_CHARS,
  PromptError,
  aboutPrompt,
  engagementPrompt,
  questionPrompt,
  reportPrompt,
  summariseJourney,
  summariseReturns,
  systemPrompt,
  trimToParagraph,
} from './prompts';
export type {
  AboutContext,
  EngagementContext,
  JourneyEntry,
  Message,
  PlanContext,
} from './prompts';

export {
  DEFAULT_BASE_URL,
  DEFAULT_DEEPSEEK_BASE_URL,
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_ZAI_BASE_URL,
  DEFAULT_ZAI_MODEL,
  ZAI_CODING_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  whole,
  ModelError,
  ModelTimeout,
  deepSeek,
  fixedModel,
  openAI,
  openRouter,
  recordingModel,
  zAI,
} from './model';
export type {
  CompletionOptions,
  LanguageModel,
  OpenRouterOptions,
  ProviderOptions,
} from './model';

export {
  DEFAULT_SILENCE_MS,
  DEFAULT_TIMEOUT_MS,
  MAX_ENGAGEMENT_CHARS,
  Guide,
  aboutFallbackText,
  engagementFallbackText,
  fallbackText,
} from './guide';
export type {
  AboutOptions,
  AskOptions,
  EngagementOptions,
  GuideOptions,
  GuideStatus,
  Reflection,
} from './guide';
