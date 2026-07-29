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
  MAX_JOURNEY_CHARS,
  MAX_JOURNEY_ENTRIES,
  MAX_JOURNEY_ENTRY_CHARS,
  MAX_PLAN_CHARS,
  PromptError,
  questionPrompt,
  reportPrompt,
  summariseJourney,
  systemPrompt,
  trimToParagraph,
} from './prompts';
export type { JourneyEntry, Message, PlanContext } from './prompts';

export {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  ModelError,
  fixedModel,
  openRouter,
  recordingModel,
} from './model';
export type { CompletionOptions, LanguageModel, OpenRouterOptions } from './model';

export { DEFAULT_TIMEOUT_MS, Guide, fallbackText } from './guide';
export type { AskOptions, GuideOptions, Reflection } from './guide';
