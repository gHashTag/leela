/**
 * The companion, on a screen with no bot behind it.
 *
 * `@leela/ai` holds the real one, and it needs a key. This page is served to a
 * browser, and a key in a browser is a key that has been given away — so the
 * companion here is built to be useful with *no* model at all, and better with
 * one. That order matters: the version where the model is the point degrades
 * into an empty box on a train, and the mini app already learned that lesson
 * about its board art.
 *
 * What it says without a model is not invented. It is the canonical text for
 * the plan — the same twenty-two-language dataset every other surface reads —
 * plus the move sentence `describeMove` already writes, plus the question the
 * mini app already asks in `app.reportPlaceholder`. Three things the player is
 * owed anyway, arranged as an opening remark. No new sentence was written for
 * this file, in any language, which is why it works in all of them.
 *
 * **What it does not do is pretend.** There is no typing indicator that is not
 * a request in flight, and no "thinking…" that is not a model being waited on.
 * `source` on every line says where it came from, and `Rests` is the actual
 * context a prompt would be built from rather than a dramatisation of one. A
 * companion that mimes deliberation it is not doing is a companion whose real
 * answers cannot be trusted either.
 */

import {
  type Language,
  type Plan,
  messageFor,
  planFor,
  trimmedDescription,
} from './canon';
import type { Direction, MoveEvent } from '@leela/engine';

/** Who said a line, and on whose authority. */
export type Source =
  /** The canonical text of the plan, or a sentence from the catalogue. */
  | 'canon'
  /** A model answered. */
  | 'model'
  /** A model was asked and could not answer; this is the stand-in. */
  | 'fallback'
  /** The player, now. */
  | 'player'
  /**
   * The player, before.
   *
   * Their own writing from an earlier visit to this square. Marked apart from
   * `player` because it is the same voice at a different time, and a thread
   * that renders the two identically is one where a player reads something they
   * wrote in March as something they just said.
   */
  | 'written';

export interface Line {
  readonly who: 'companion' | 'player';
  readonly text: string;
  readonly source: Source;
  /** The plan this was said about, so the thread can be read back. */
  readonly plan: number;
  /** When this was written, for a line that is not from now. */
  readonly at?: number;
  /**
   * The rest of the plan's text, when `text` is an abridgement of it.
   *
   * Carried on the line rather than fetched by the view, so that what is shown
   * and what can be opened are decided in the same place. Absent when there is
   * no more — a control that opens nothing is worse than no control.
   */
  readonly more?: string;
}

/**
 * What the companion is working from — *how it thinks*, in the only sense that
 * can be shown honestly.
 *
 * These are the fields `@leela/ai`'s `PlanContext` carries into a prompt. Shown
 * rather than described, so a player can see that the answer about plan 34
 * really was given the text of plan 34 and their own last three squares — and
 * see it when one of them is missing, which is when it matters.
 */
export interface Rests {
  readonly plan: number;
  readonly title: string;
  /** Characters of canonical text the answer rests on. Zero is worth seeing. */
  readonly canonChars: number;
  readonly language: Language;
  readonly direction: Direction | '' | null;
  readonly previousPlan: number | null;
  /** Squares walked so far, this game. */
  readonly journey: number;
  /** Whether a model is configured at all. */
  readonly model: string | null;
}

export type Status =
  /** No model configured. Everything below is canon, and says so. */
  | 'offline'
  /** A model is configured and idle. */
  | 'ready'
  /** A request is in flight. */
  | 'thinking'
  /** A model is configured and refusing; `note` says how. */
  | 'silenced';

export interface CompanionView {
  readonly lines: readonly Line[];
  readonly status: Status;
  readonly note: string | null;
  readonly rests: Rests | null;
}

/**
 * A model, as this screen needs it: a question and the context, to text.
 *
 * Deliberately not `LanguageModel` from `@leela/ai`. That takes an API key and
 * builds prompts; this takes whatever a deployment puts in front of it — a
 * proxy, a bot endpoint, a local runtime — and the browser never holds the key.
 */
export type Ask = (question: string, rests: Rests) => Promise<string>;

export interface CompanionOptions {
  language: Language;
  /** Absent means offline, which is a supported way to run. */
  ask?: Ask;
  /** What to call the model on screen. */
  modelName?: string;
}

/** How much of a plan's text the opening remark quotes. */
export const OPENING_CHARS = 320;

export class Companion {
  private readonly language: Language;
  private readonly ask: Ask | null;
  private readonly modelName: string | null;

  private lines: Line[] = [];
  private thinking = false;
  private note: string | null = null;
  private silenced = false;
  private rests: Rests | null = null;
  private journey: number[] = [];

  constructor({ language, ask, modelName }: CompanionOptions) {
    this.language = language;
    this.ask = ask ?? null;
    this.modelName = ask ? (modelName ?? 'model') : null;
  }

  view(): CompanionView {
    return {
      lines: this.lines,
      status: this.thinking
        ? 'thinking'
        : this.ask === null
          ? 'offline'
          : this.silenced
            ? 'silenced'
            : 'ready',
      note: this.note,
      rests: this.rests,
    };
  }

  /** The question put to the player, in their language. */
  invitation(): string {
    return messageFor(this.language, 'app.reportPlaceholder');
  }

  /**
   * The player has landed somewhere. Speak first.
   *
   * Proactive because the game is: the mini app puts *write what this plan
   * brings up before you throw again* between one throw and the next, and a
   * companion that waits to be addressed turns that into a form nobody fills
   * in. Two lines — what happened, and what the plan says — then the question.
   */
  /**
   * @param before what this player wrote here on earlier visits, oldest first.
   *        `writingsOn` in `@leela/journal` decides what belongs to a square.
   */
  arrived(
    plan: number,
    event: MoveEvent | null,
    moveSentence: string,
    before: ReadonlyArray<{ text: string; at: number }> = [],
  ): void {
    this.journey.push(plan);

    const text = planFor(this.language, plan);
    this.rests = {
      plan,
      title: text.title,
      canonChars: (text.description ?? text.body ?? '').length,
      language: this.language,
      direction: event?.direction ?? null,
      previousPlan: event && event.from !== plan ? event.from : null,
      journey: this.journey.length,
      model: this.modelName,
    };

    const short = opening(text);
    const whole = (text.body ?? '').trim();

    this.lines = [
      ...this.lines,
      { who: 'companion', text: moveSentence, source: 'canon', plan },
      // What you said here last time, before what the text says — coming back
      // to a square is the game, and the first thing worth knowing on arrival
      // is that you have been here and what you made of it.
      ...before.map(
        (older): Line => ({
          who: 'player',
          text: older.text,
          source: 'written',
          plan,
          at: older.at,
        }),
      ),
      {
        who: 'companion',
        text: short,
        source: 'canon',
        plan,
        // Only when there is genuinely more than was shown. Comparing the
        // trimmed text against the whole, rather than comparing lengths against
        // `OPENING_CHARS`, because thirteen plans have no description and their
        // opening remark is already the body's first sentences.
        ...(whole.length > short.length ? { more: whole } : {}),
      },
    ];
  }

  /**
   * The player wrote something back.
   *
   * With no model this is still not wasted: the line is kept, the thread reads
   * as a conversation, and what the player wrote is what the mini app would
   * have called a report. It is simply not answered by anything but the canon.
   */
  async say(what: string): Promise<void> {
    const said = what.trim();
    if (said.length === 0) return;
    const rests = this.rests;
    if (!rests) return;

    this.lines = [...this.lines, { who: 'player', text: said, source: 'player', plan: rests.plan }];

    if (!this.ask || this.silenced) {
      // Not an apology and not a silent drop: name the plan, which is what
      // `fallbackText` in `@leela/ai` does for exactly this moment.
      this.lines = [
        ...this.lines,
        {
          who: 'companion',
          text: messageFor(this.language, 'companion.unavailable', { plan: rests.plan }),
          source: 'fallback',
          plan: rests.plan,
        },
      ];
      return;
    }

    this.thinking = true;
    this.note = null;
    try {
      const answer = (await this.ask(said, rests)).trim();
      // Nothing is not an answer. `@leela/ai` learned this from a provider
      // returning 200 with an empty choice, and the fix belongs on both sides.
      if (answer.length === 0) throw new Error('the model answered with nothing');
      this.lines = [
        ...this.lines,
        { who: 'companion', text: answer, source: 'model', plan: rests.plan },
      ];
    } catch (error) {
      this.silenced = true;
      this.note = error instanceof Error ? error.message : String(error);
      this.lines = [
        ...this.lines,
        {
          who: 'companion',
          text: messageFor(this.language, 'companion.unavailable', { plan: rests.plan }),
          source: 'fallback',
          plan: rests.plan,
        },
      ];
    } finally {
      this.thinking = false;
    }
  }

  /** A new game. The thread goes with it; the model's refusal does not. */
  reset(): void {
    this.lines = [];
    this.journey = [];
    this.rests = null;
    this.note = null;
  }
}

/**
 * The opening remark: what this plan is, in the player's language.
 *
 * `description` where the source had one and the body otherwise, cut at a
 * sentence rather than mid-word — the full text is a screen and a half, and the
 * point here is to make the player want to open it, not to make them read it in
 * a chat bubble.
 */
export const opening = (plan: Plan): string =>
  trimmedDescription(plan, OPENING_CHARS);
