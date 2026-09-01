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
import { ModelError, ModelTimeout } from './model';
import {
  type AboutContext,
  type JourneyEntry,
  type Message,
  type PlanContext,
  PromptError,
  aboutPrompt,
  engagementPrompt,
  questionPrompt,
  reportPrompt,
  type Arrival,
} from './prompts';

export interface GuideOptions {
  model: LanguageModel;
  /** Applied to every call unless overridden. */
  completion?: CompletionOptions;
  /**
   * How long to wait before giving up, in milliseconds.
   * A player staring at a chat needs an answer or an apology, not a spinner.
   *
   * Enforced here rather than asked for. See `ask`.
   */
  timeoutMs?: number;
  /** Where failures are reported. */
  log?: (message: string, error: unknown) => void;
  /**
   * How long to stay silent after a failure a retry cannot fix.
   *
   * Not forever: a balance is topped up and a key is replaced without anyone
   * restarting the bot, and a companion that needs a restart to notice is one
   * more thing to remember at the worst moment.
   */
  silenceMs?: number;
  /** Injected so the cool-down can be tested without waiting for it. */
  now?: () => number;
}

export const DEFAULT_TIMEOUT_MS = 20_000;
export const DEFAULT_SILENCE_MS = 30 * 60_000;

/**
 * Statuses that mean a human has to do something.
 *
 * 401 the key is wrong, 402 the balance is empty, 403 the key is not allowed
 * here, 404 there is no such model. None of them will be different on the next
 * report, and this bot answered a live 402 on every report while the player
 * waited for the round trip to fail.
 *
 * 400 is deliberately not here. A request can be malformed for one prompt —
 * too long, an odd character — and silencing the companion for half an hour
 * over a single bad prompt is worse than trying the next one. 429 and 5xx are
 * the weather.
 */
const NEEDS_A_HUMAN = new Set([401, 402, 403, 404]);

/** What an operator would want to know about the companion. */
export interface GuideStatus {
  available: boolean;
  /** Why not, in terms someone can act on. Absent when it is available. */
  reason?: string;
  /** Reports answered with the fallback without calling anything. */
  skipped: number;
}

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

/**
 * The same moment, for a question asked off the board.
 *
 * `fallbackText` names the plan the player can sit with in the meantime, and
 * there is no plan here to name. The catalogue already has the sentence for a
 * companion that is not answering — `/ask` with no guide configured says it —
 * so it is reused rather than becoming a twenty-third translation job for a
 * new key that would say the same thing.
 */
export function aboutFallbackText(language: Language): string {
  return messageFor(language, 'ask.silent');
}

/**
 * The useful sentence left when the proactive model is absent or unavailable.
 *
 * Unlike the conversational fallback, this never announces an outage to a
 * player who did not ask for a model. The plan excerpt is still in the same
 * message; this bridge merely names the reflection or movement it can open.
 */
export function engagementFallbackText(options: EngagementOptions): string {
  return messageFor(
    options.language,
    options.reportOwed ? 'nudge.agentReport' : 'nudge.agentRoll',
  );
}

export interface AskOptions {
  language: Language;
  plan: number;
  /**
   * Whether the player is standing on this plan or was sent it.
   *
   * `standing` by default, because that is what every path but the hand-over
   * does. A received square is somebody else's: the prompt says so, and stops
   * describing an arrival that never happened.
   */
  arrival?: Arrival;
  /** What the player is playing for — the frame the reports answer. */
  intention?: string;
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

/** Context for the one message in which the companion speaks first. */
export interface EngagementOptions extends AskOptions {
  reportOwed: boolean;
}

/**
 * What `about` needs: no plan and no journey, because the player is standing
 * on no square. See `AboutContext` in `prompts.ts` for why the rules arrive
 * from the caller rather than living here.
 */
export interface AboutOptions {
  language: Language;
  /** The rules of the board, rendered by whoever holds the engine. */
  rules: string;
  /** Earlier turns of this conversation, oldest first. */
  history?: ReadonlyArray<Message>;
}

export class Guide {
  private readonly model: LanguageModel;
  private readonly completion: CompletionOptions;
  private readonly timeoutMs: number;
  private readonly log: (message: string, error: unknown) => void;
  private readonly silenceMs: number;
  private readonly now: () => number;

  /** When the companion may try again. 0 means now. */
  private silentUntil = 0;
  private silentReason: string | undefined;
  private skipped = 0;

  constructor({
    model,
    completion = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    log = (message, error) => console.error(`[guide] ${message}`, error),
    silenceMs = DEFAULT_SILENCE_MS,
    now = Date.now,
  }: GuideOptions) {
    this.model = model;
    this.completion = completion;
    this.timeoutMs = timeoutMs;
    this.log = log;
    this.silenceMs = silenceMs;
    this.now = now;
  }

  /**
   * Whether the companion is answering, and why not.
   *
   * The bot logs this beside the fallback, so "the companion hiccuped" and
   * "this deployment has never had a working key" stop looking the same in a
   * log — which is how a 402 went unnoticed until someone read the balance.
   */
  status(): GuideStatus {
    const silent = this.silentUntil > this.now();
    return {
      available: !silent,
      reason: silent ? this.silentReason : undefined,
      skipped: this.skipped,
    };
  }

  /** Respond to a player's report on the plan they are standing on. */
  async reflect(report: string, options: AskOptions): Promise<Reflection> {
    return this.ask(
      () => reportPrompt(contextOf(options), report, options.history),
      () => fallbackText(contextOf(options)),
    );
  }

  /** Answer a question about a plan. */
  async answer(question: string, options: AskOptions): Promise<Reflection> {
    return this.ask(
      () => questionPrompt(contextOf(options), question, options.history),
      () => fallbackText(contextOf(options)),
    );
  }

  /** Offer one plan-grounded next step without waiting for a question. */
  async engage(options: EngagementOptions): Promise<Reflection> {
    return this.ask(
      () => engagementPrompt(contextOf(options), options.reportOwed),
      () => engagementFallbackText(options),
    );
  }

  /**
   * Answer a question about the game from a player standing on no square.
   *
   * `reflect` and `answer` rest on a plan's text; there is no plan here, so
   * the answer rests on the rules the caller renders from the engine. The
   * machinery behind it is the same on purpose — the deadline, the silence,
   * the fallback — because a refused key silences the companion as a whole,
   * and a route that kept calling around the silence would spend the round
   * trips the cool-down exists to save.
   */
  async about(question: string, options: AboutOptions): Promise<Reflection> {
    const context: AboutContext = { language: options.language, rules: options.rules };
    return this.ask(
      () => aboutPrompt(context, question, options.history),
      () => aboutFallbackText(options.language),
    );
  }

  /**
   * Build the prompt, call the model, and turn any failure into an answer.
   *
   * A malformed request — an empty report, a plan off the board — is a caller
   * bug and is rethrown. Everything else is the world being unreliable, and
   * the player should not be shown a stack trace for it.
   *
   * The fallback arrives as a function rather than being built from the
   * options, because the options no longer agree on a shape: a plan prompt
   * falls back to a sentence that names the plan, and `about` has no plan to
   * name. Deferred so the sentence is only rendered on the paths that show it.
   */
  private async ask(
    build: () => Message[],
    fallback: () => string,
  ): Promise<Reflection> {
    const messages = build(); // PromptError propagates: that is a caller bug.

    // Already known to be unanswerable. Do not spend the player's time proving
    // it again: the fallback was decided the moment the key was refused.
    if (this.silentUntil > this.now()) {
      this.skipped += 1;
      return { text: fallback(), fromModel: false };
    }

    // The deadline is kept by this package, not asked of the model.
    //
    // It used to be a bare `controller.abort()`, which is a *request*: it stops
    // a model that wired `options.signal` through and does nothing at all to one
    // that did not. `LanguageModel` is deliberately the whole surface — "a
    // function from messages to text", so that anyone can put an SDK behind it —
    // and an SDK wrapper that takes its abort signal somewhere else, or ignores
    // it, is an easy and silent thing to write.
    //
    // Then the await never returned. Not a slow answer and not a fallback: the
    // player was shown nothing, forever, which is the one outcome this whole
    // class exists to prevent. Racing the clock makes the promise true for
    // *every* model. The abort still fires, so a model that does listen stops
    // working on an answer nobody will read.
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new ModelTimeout(this.timeoutMs));
      }, this.timeoutMs);
    });

    try {
      const text = await Promise.race([
        this.model.complete(messages, { ...this.completion, signal: controller.signal }),
        deadline,
      ]);
      // A call that worked ends any silence: whoever fixed it need not restart.
      this.silentUntil = 0;
      this.silentReason = undefined;

      /**
       * Nothing is not an answer, and this type promises one.
       *
       * `Reflection.text` says *what to show the player, always non-empty*, and
       * this line handed back `''` whenever the model did: a filtered response,
       * a completion cut at zero tokens, a provider answering 200 with an empty
       * choice. All of them arrive as success.
       *
       * Downstream that is worse than a failure. The bot sends the text, and an
       * empty message is the one thing Telegram refuses — the reply throws, the
       * player is shown *something went wrong, try again in a moment*, and
       * trying again asks the same model the same prompt. The fallback exists
       * for exactly this and was skipped because the call did not throw.
       *
       * `fromModel: false`, because it did not come from the model. That flag
       * is what the bot logs the companion's silence on.
       */
      const said = text.trim();
      if (said.length === 0) {
        this.log('the model answered with nothing', new Error('empty completion'));
        return { text: fallback(), fromModel: false };
      }

      return { text: said, fromModel: true };
    } catch (error) {
      if (error instanceof PromptError) throw error;

      const status = error instanceof ModelError ? error.status : undefined;

      if (status !== undefined && NEEDS_A_HUMAN.has(status)) {
        // Loud, and once per cool-down rather than once per report.
        this.silentUntil = this.now() + this.silenceMs;
        this.silentReason = reasonFor(status, this.silenceMs);
        this.log(`companion silenced: ${this.silentReason}`, error);
      } else if (error instanceof ModelTimeout) {
        this.log(`model timed out after ${this.timeoutMs}ms`, error);
      } else {
        this.log(`model failed${status ? ` (${status})` : ''}`, error);
      }

      return { text: fallback(), fromModel: false };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** A refusal, in terms an operator can act on rather than a status code. */
function reasonFor(status: number, silenceMs: number): string {
  const what =
    status === 401
      ? 'the key was refused'
      : status === 402
        ? 'the account has no balance'
        : status === 403
          ? 'the key is not allowed to use this model'
          : 'there is no such model';
  const minutes = Math.round(silenceMs / 60_000);
  return `${what} (${status}); trying again in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * The options a caller gives, as the context a prompt is built from.
 *
 * Copied field by field, which is a restated list — the defect this repository
 * has met six times — and it bit at once: `arrival` was added to both types and
 * dropped here, so the fix that stops the companion being told a player stands
 * on a square somebody sent them would have been dead code, silently.
 *
 * `carriesEveryOption` in the tests builds every field and reads them back out
 * of the prompt, so a seventh field cannot be added and forgotten.
 */
function contextOf(options: AskOptions): PlanContext {
  return {
    plan: options.plan,
    language: options.language,
    arrival: options.arrival,
    direction: options.direction,
    previousPlan: options.previousPlan,
    intention: options.intention,
    journey: options.journey,
  };
}
