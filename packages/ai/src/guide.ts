/**
 * The companion.
 *
 * Two things it does: respond to a report on the plan a player is standing on,
 * and answer a question about one. Both rest on the canonical text rather than
 * on the model's own idea of what the plan means.
 *
 * Everything that can fail — the network, the key, the model — fails into a
 * usable answer rather than an exception. A game that stops working because a
 * companion is unavailable has its priorities backwards: the reflection is the
 * game, and the companion is a help with it.
 */

import { type Language, messageFor } from '@leela/content';
import type { Direction } from '@leela/engine';
import type { CompletionOptions, LanguageModel } from './model';
import { ModelError } from './model';
import {
  type JourneyEntry,
  type Message,
  type PlanContext,
  PromptError,
  questionPrompt,
  reportPrompt,
} from './prompts';

export interface GuideOptions {
  model: LanguageModel;
  /** Applied to every call unless overridden. */
  completion?: CompletionOptions;
  /**
   * How long to wait before giving up, in milliseconds.
   * A player staring at a chat needs an answer or an apology, not a spinner.
   */
  timeoutMs?: number;
  /** Where failures are reported. */
  log?: (message: string, error: unknown) => void;
}

export const DEFAULT_TIMEOUT_MS = 20_000;

export interface Reflection {
  /** What to show the player. Always non-empty. */
  text: string;
  /** False when the model could not be reached and this is the fallback. */
  fromModel: boolean;
}

/**
 * Shown when the companion cannot answer. Names the plan, so it still helps.
 *
 * In the player's language: this is the sentence they read at the moment the
 * game is least able to explain itself, so English here would compound an
 * outage with confusion.
 */
export function fallbackText(context: PlanContext): string {
  return messageFor(context.language, 'companion.unavailable', { plan: context.plan });
}

export interface AskOptions {
  language: Language;
  plan: number;
  direction?: Direction;
  previousPlan?: number;
  /** Earlier turns of this conversation, oldest first. */
  history?: ReadonlyArray<Message>;
  /**
   * Where the player has been and what they wrote there, oldest first.
   * Summarised into the prompt rather than quoted whole.
   */
  journey?: ReadonlyArray<JourneyEntry>;
}

export class Guide {
  private readonly model: LanguageModel;
  private readonly completion: CompletionOptions;
  private readonly timeoutMs: number;
  private readonly log: (message: string, error: unknown) => void;

  constructor({
    model,
    completion = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    log = (message, error) => console.error(`[guide] ${message}`, error),
  }: GuideOptions) {
    this.model = model;
    this.completion = completion;
    this.timeoutMs = timeoutMs;
    this.log = log;
  }

  /** Respond to a player's report on the plan they are standing on. */
  async reflect(report: string, options: AskOptions): Promise<Reflection> {
    return this.ask(() => reportPrompt(contextOf(options), report, options.history), options);
  }

  /** Answer a question about a plan. */
  async answer(question: string, options: AskOptions): Promise<Reflection> {
    return this.ask(() => questionPrompt(contextOf(options), question, options.history), options);
  }

  /**
   * Build the prompt, call the model, and turn any failure into an answer.
   *
   * A malformed request — an empty report, a plan off the board — is a caller
   * bug and is rethrown. Everything else is the world being unreliable, and
   * the player should not be shown a stack trace for it.
   */
  private async ask(
    build: () => Message[],
    options: AskOptions,
  ): Promise<Reflection> {
    const messages = build(); // PromptError propagates: that is a caller bug.

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const text = await this.model.complete(messages, {
        ...this.completion,
        signal: controller.signal,
      });
      return { text: text.trim(), fromModel: true };
    } catch (error) {
      if (error instanceof PromptError) throw error;
      this.log(
        error instanceof ModelError
          ? `model failed${error.status ? ` (${error.status})` : ''}`
          : 'model failed',
        error,
      );
      return { text: fallbackText(contextOf(options)), fromModel: false };
    } finally {
      clearTimeout(timer);
    }
  }
}

function contextOf(options: AskOptions): PlanContext {
  return {
    plan: options.plan,
    language: options.language,
    direction: options.direction,
    previousPlan: options.previousPlan,
    journey: options.journey,
  };
}
