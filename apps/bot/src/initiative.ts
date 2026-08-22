/**
 * The companion's initiative: a daily word from the plan you stand on.
 *
 * Everything else in this bot answers; this is the one place it speaks first.
 * Once a day, at a fixed hour, it writes privately to each eligible player —
 * an excerpt of the canon text of the plan they stand on, one line naming
 * where they stand, and one call back into the game. One message, one CTA,
 * and the way out (`/quiet`) said plainly in the first message ever sent.
 *
 * The engine is a set of *skills* — message templates with sleeping
 * conditions. v1 ships one, the plan's daily word; `eligible` is its sleeping
 * condition and `compose` its template, both pure so every branch is a test
 * rather than a hope. The driver around them owns the clock and the sends.
 *
 * What is deliberately absent, with the spec's reasons: streaks (play to
 * protect a number is the opposite of a reflection game), per-user send
 * times (Telegram exposes no timezone), and model-written nudges (a daily
 * model call per player buys spend and variance for no measured need — the
 * canon already owns the words).
 */

import { Keyboard } from 'grammy';
import type { ReplyKeyboardMarkup } from 'grammy/types';
import { lastSentenceEnd, messageFor, planFor, type Language, type Plan } from '@leela/content';
import { hasWon } from '@leela/engine';
import { launchButton, standingSquare, type Room } from './commands';
import { DirectChannels, isBlockedByUser } from './delivery';
/**
 * One day, the unit everything here is counted in — declared in `stars.ts`.
 *
 * Imported rather than declared: the Stars rail needs the same number for the
 * length of an entitlement, and two constants called `DAY_MS` are one idea with
 * two homes, which is what `audit-doubles` exists to refuse. It lives there
 * because it can: that module imports nothing from this app, and a day declared
 * here would reach it only through a cycle.
 */
import { DAY_MS } from './stars';
import type { NudgeStore, RoomStore } from './store';

/**
 * How long a player may be silent and still be written to: fourteen days.
 *
 * The retention finding the spec cites — CURR dominates — read as a rule:
 * make the live loop sticky before resurrecting the lapsed. Somebody who has
 * not touched the game in two weeks is a re-activation problem, and a message
 * they no longer expect is how a channel gets muted for good.
 */
export const LAPSED_AFTER_MS = 14 * DAY_MS;

/**
 * How long the fresh-start door stays open.
 *
 * A comeback word goes only to players lapsed past the daily word's fourteen
 * days and not yet past thirty-five: at most three Mondays fall in that
 * window, so the weekly knock bounds itself and needs no counter, no new
 * column, no migration. Past the window, silence is read as an answer and
 * respected - the research's own line between a landmark and a nag.
 */
export const FRESH_START_UNTIL_MS = 35 * DAY_MS;

/**
 * The default hour the daily word goes out, in UTC because the clock that
 * fires it is UTC: Railway runs its containers on UTC, so 6 here is 09:00 in
 * Moscow — morning where the players are, which is the honest v1 of send-time
 * choice. The hour is one variable to move later, not a per-user model.
 */
export const DEFAULT_NUDGE_HOUR = 6;

/**
 * The configured hour, read the way `miniAppUrl` reads its variable: a pure
 * function of an environment handed in, refusing anything that is not an
 * integer 0..23 by taking the default. An empty variable is a variable unset.
 */
export function nudgeHour(env: Record<string, string | undefined> = process.env): number {
  const set = env.LEELA_NUDGE_HOUR?.trim();
  if (!set) return DEFAULT_NUDGE_HOUR;

  const hour = Number(set);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_NUDGE_HOUR;
}

/** Milliseconds until the next strike of `hour`:00 UTC, always in the future. */
export function msUntilHour(now: number, hour: number): number {
  const at = new Date(now);
  const today = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), hour);
  // Strictly future: a tick that runs exactly on the hour schedules tomorrow's,
  // not another copy of its own.
  return today > now ? today - now : today + DAY_MS - now;
}

/** The UTC day a moment falls in, for "already nudged today". */
function utcDayOf(at: number): number {
  return Math.floor(at / DAY_MS);
}

/**
 * Why a player was not written to. Each is counted in the tick's one summary
 * line, so an operator reads where the day's silence came from.
 *
 * The first six are `eligible`'s sleeping conditions; the last two are what a
 * send itself can answer — a 403 that closes the channel, and a failure that
 * is nobody's refusal.
 */
export type SkipReason =
  | 'not-standing'
  | 'finished'
  | 'no-channel'
  | 'lapsed'
  | 'quieted'
  | 'nudged-today'
  | 'blocked'
  | 'undelivered';

/** One player, reduced to the facts the sleeping condition reads. */
export interface Candidate {
  /** The plan they stand on, or null while they wait to enter. */
  standing: number | null;
  /** Whether their game is over — a call back into it would be false. */
  finished: boolean;
  /** Whether the bot has a direct channel: no remembered refusal. */
  reachable: boolean;
  /** When they last rolled or reported, epoch ms. Null if never. */
  lastActiveAt: number | null;
  /** Whether `/quiet` has closed the door. */
  quieted: boolean;
  /** When the daily word last reached them, epoch ms. Null if never. */
  lastNudgedAt: number | null;
}

/** Which of the companion's words a tick sends. */
export type Word = 'daily' | 'freshStart';

export type Verdict = { send: true; word: Word } | { send: false; because: SkipReason };

/**
 * The daily word's sleeping condition, one clause per line of the spec:
 * standing on a real plan, reachable in private, active within fourteen days,
 * not quieted, and not already nudged today — the hard cap that protects the
 * channel. A player whose seat has never rolled or reported carries no
 * timestamp at all, and an absence is not recent activity: they are lapsed,
 * not fresh.
 */
export function eligible(candidate: Candidate, now: number): Verdict {
  if (candidate.standing === null) return { send: false, because: 'not-standing' };
  if (candidate.finished) return { send: false, because: 'finished' };
  if (!candidate.reachable) return { send: false, because: 'no-channel' };
  if (candidate.quieted) return { send: false, because: 'quieted' };
  if (candidate.lastNudgedAt !== null && utcDayOf(candidate.lastNudgedAt) === utcDayOf(now)) {
    return { send: false, because: 'nudged-today' };
  }
  if (candidate.lastActiveAt === null || now - candidate.lastActiveAt > LAPSED_AFTER_MS) {
    // The second arm: past the daily word's reach, a Monday - the fresh-start
    // landmark - may knock, inside its window. The arms are disjoint by
    // construction: one activity age selects exactly one word or none.
    const gone =
      candidate.lastActiveAt === null ||
      now - candidate.lastActiveAt > FRESH_START_UNTIL_MS;
    if (!gone && new Date(now).getUTCDay() === 1) {
      return { send: true, word: 'freshStart' };
    }
    return { send: false, because: 'lapsed' };
  }
  return { send: true, word: 'daily' };
}

/**
 * How much of a plan's text one morning carries.
 *
 * A nudge is read standing up: a bounded excerpt, not the whole plan — the
 * chat already has `/plan` for the whole, paged by `renderPlan`. Five hundred
 * characters is two or three sentences of most plans, enough to be the text
 * and short enough to be a message rather than a page.
 */
export const EXCERPT_CHARS = 500;

/**
 * A plan's body as the excerpts a morning can carry, cut where sentences end.
 *
 * The cut uses `lastSentenceEnd` — the one list of terminators the dataset's
 * twenty-two languages actually use, kept in `@leela/content` because it has
 * been written short twice before. A stretch with no terminator in the whole
 * window is cut hard rather than dropped: something has to give, and a
 * missing excerpt gives everything.
 */
export function excerptsOf(body: string, limit = EXCERPT_CHARS): string[] {
  const text = body.trim();
  if (text.length === 0) return [];
  if (text.length <= limit) return [text];

  const out: string[] = [];
  let rest = text;

  while (rest.length > limit) {
    const end = lastSentenceEnd(rest, limit - 1);
    // Not at index zero: a terminator first in the window ends no sentence,
    // and cutting there would loop without shrinking.
    const at = end > 0 ? end + 1 : limit;
    const piece = rest.slice(0, at).trim();
    if (piece.length > 0) out.push(piece);
    rest = rest.slice(at).trim();
  }

  if (rest.length > 0) out.push(rest);
  return out;
}

/**
 * Which excerpt the next morning reads out.
 *
 * Duolingo's recency penalty, reduced to its cheapest honest form: never the
 * one most recently heard. The counter walks the excerpts in order and wraps,
 * so with two or more the same excerpt never arrives twice in a row. A plan
 * whose whole text fits in one excerpt repeats it, and that is allowed: the
 * alternative is silence about the square the player is standing on.
 *
 * The cursor is per player, not per plan, and the modulo is what makes that
 * safe: a player who moved to a shorter plan between mornings wraps instead
 * of indexing past the end.
 */
export function nextExcerpt(count: number, last: number | null): number {
  if (count <= 0) return 0;
  if (last === null) return 0;
  return (last + 1) % count;
}

export interface Composed {
  text: string;
  /** The excerpt index this message carries — the cursor to remember. */
  excerpt: number;
}

/**
 * The daily word, assembled: the excerpt, one line naming where the player
 * stands, one call back into the game — and, the first time only, the way
 * out, at the end, naming `/quiet`.
 *
 * Takes the `Plan` rather than fetching it, exactly as `commands.ts` uses
 * `planFor` at the call site and hands the found plan on. That keeps this
 * pure over its inputs — a body with no text at all (a language a rebuild
 * dropped a plan from falls back inside `planFor`, but an empty body is still
 * a body) simply sends the standing line and the call, because a message
 * whose excerpt is missing is thinner, not wrong.
 */
export function compose(
  language: Language,
  plan: Plan,
  lastExcerpt: number | null,
  said: { firstNudge: boolean; word?: Word },
): Composed {
  const pieces = excerptsOf(plan.body);
  const index = nextExcerpt(pieces.length, lastExcerpt);
  const excerpt = pieces[index];

  const lines = [
    // A comeback opens with the landmark, not the lesson: the research's
    // fresh-start framing - a clean slate offered, nothing counted or lost.
    ...(said.word === 'freshStart' ? [messageFor(language, 'nudge.freshStart'), ''] : []),
    ...(excerpt ? [excerpt, ''] : []),
    messageFor(language, 'nudge.standing', { plan: plan.plan, title: plan.title }),
    messageFor(language, 'nudge.cta'),
    ...(said.firstNudge ? ['', messageFor(language, 'nudge.wayOut')] : []),
  ];

  return { text: lines.join('\n'), excerpt: index };
}

/** What one tick did, for the summary line and for tests. */
export interface TickSummary {
  sent: number;
  skipped: Partial<Record<SkipReason, number>>;
}

/**
 * The one method of the bot api a tick spends, narrowed to what it sends —
 * so grammY's `Api` satisfies it structurally and a test satisfies it with an
 * object literal, the same reason `StreamAsk` is a shape and not a class.
 */
export interface NudgeApi {
  sendMessage(
    chatId: string,
    text: string,
    other?: {
      reply_markup?: ReplyKeyboardMarkup;
      link_preview_options?: { is_disabled: boolean };
    },
  ): Promise<unknown>;
}

export interface InitiativeOptions {
  api: NudgeApi;
  store: RoomStore;
  /** The per-player memory, from the same storage the games live in. */
  nudges: NudgeStore;
  /**
   * The same allow-list the transport keeps, shared rather than copied: a 403
   * the bot met answering `/path` is a morning this must not spend, and a
   * refusal this earns is one `deliver` must not try again.
   */
  channels: DirectChannels;
  /** Where the launch button opens — `miniAppUrl()`, handed in pure. */
  launchUrl: string;
  /** The UTC hour the word goes out. `nudgeHour()`'s answer. */
  hour?: number;
  now?: () => number;
  /** Injected so a test never waits for morning, as storage.ts injects its own. */
  schedule?: (run: () => void, inMs: number) => () => void;
  log?: (message: string) => void;
}

export interface Initiative {
  /** One pass over every seated player. Exposed so a test owns the clock. */
  runTick(at: number): Promise<TickSummary>;
  /** Arm the daily chain. Idempotent: the supervisor may start polling twice. */
  start(): void;
  stop(): void;
}

/**
 * When this seat last did anything the game records.
 *
 * Not derived: the engine stamps `lastRollAt` on every counted throw and
 * `lastReportAt` on every filed report, both persisted per seat in
 * `session_players` and round-tripped by `roomFromRows`. The later of the two
 * is the real per-player signal — no session `updated_at` proxy needed.
 */
function lastActivityOf(seat: { lastRollAt: number | null; lastReportAt: number | null }): number | null {
  if (seat.lastRollAt === null && seat.lastReportAt === null) return null;
  return Math.max(seat.lastRollAt ?? 0, seat.lastReportAt ?? 0);
}

export function createInitiative({
  api,
  store,
  nudges,
  channels,
  launchUrl,
  hour = DEFAULT_NUDGE_HOUR,
  now = Date.now,
  schedule = (run, inMs) => {
    const timer = setTimeout(run, inMs);
    // A morning word is not a reason to keep the process alive.
    timer.unref?.();
    return () => clearTimeout(timer);
  },
  log = console.log,
}: InitiativeOptions): Initiative {
  /**
   * The launch keyboard, mirrored from `bot.ts`'s `keyboard()` for launches:
   * a **reply** keyboard, because that is the only markup whose mini app can
   * `sendData` back — and resized, or one button takes half a phone screen.
   * Telegram's one restriction on it is that it may not go to a group, and
   * this engine never writes to one: every send below is to a user's own chat.
   */
  function launchKeyboard(language: Language): Keyboard {
    const button = launchButton(language, launchUrl);
    return new Keyboard().webApp(button.label, button.webAppUrl).resized();
  }

  /**
   * One send, with `offerTheBoard`'s rules: private only, a 403 remembered in
   * `channels` so nothing tries this player again, other failures logged and
   * never thrown — a morning that fails must not take the tick down.
   *
   * The retry without markup is the one case the keyboard cannot go there:
   * Telegram refuses a bad `web_app` URL by failing the **whole call**, and
   * the word must not be lost over its button. The text already names /roll,
   * so the way back survives the keyboard not doing.
   */
  async function deliver(userId: string, language: Language, text: string): Promise<'sent' | 'blocked' | 'undelivered'> {
    const attempts: Array<Parameters<NudgeApi['sendMessage']>[2]> = [
      {
        reply_markup: launchKeyboard(language),
        link_preview_options: { is_disabled: true },
      },
      { link_preview_options: { is_disabled: true } },
    ];

    for (const [attempt, other] of attempts.entries()) {
      try {
        await api.sendMessage(userId, text, other);
        channels.allow(userId);
        return 'sent';
      } catch (error) {
        if (isBlockedByUser(error)) {
          channels.refuse(userId);
          return 'blocked';
        }
        // Said either way: an operator whose LEELA_MINIAPP_URL is wrong
        // learns it here, as they do from `offerTheBoard`.
        const retrying = attempt < attempts.length - 1;
        log(
          `[initiative] send to ${userId} failed` +
            `${retrying ? ', retrying without the keyboard' : ''}: ${String(error)}`,
        );
      }
    }

    return 'undelivered';
  }

  async function runTick(at: number): Promise<TickSummary> {
    const summary: TickSummary = { sent: 0, skipped: {} };
    const skip = (because: SkipReason) => {
      summary.skipped[because] = (summary.skipped[because] ?? 0) + 1;
    };

    /**
     * Every seated player, once. A player at two tables appears in two rooms
     * and must not hear the word twice, so the map keeps the last room seen —
     * the stores enumerate oldest-played first, which makes that the table
     * they most recently played, the same answer `roomOf` gives.
     */
    const rooms = (await store.allRooms?.()) ?? [];
    const seats = new Map<string, { room: Room; seat: Room['session']['players'][number] }>();
    for (const room of rooms) {
      for (const seat of room.session.players) seats.set(seat.id, { room, seat });
    }

    for (const [userId, { room, seat }] of seats) {
      const memory = await nudges.of(userId);

      const verdict = eligible(
        {
          standing: standingSquare(room, userId),
          finished: hasWon(seat.state),
          reachable: channels.canWrite(userId),
          lastActiveAt: lastActivityOf(seat),
          quieted: memory.quieted,
          lastNudgedAt: memory.sentAt,
        },
        at,
      );

      if (!verdict.send) {
        skip(verdict.because);
        continue;
      }

      const plan = planFor(room.language, seat.state.loka);
      const word = compose(room.language, plan, memory.excerpt, {
        firstNudge: memory.sentAt === null,
        word: verdict.word,
      });

      const outcome = await deliver(userId, room.language, word.text);
      if (outcome === 'sent') {
        // Remembered only when it arrived: a failed send has not spent the
        // day, and tomorrow's tick owes this player another knock.
        await nudges.record(userId, { at, excerpt: word.excerpt });
        summary.sent += 1;
      } else {
        skip(outcome);
      }
    }

    // One line an operator reads, not a scroll: who was written to and where
    // the silence came from, reason by reason.
    const reasons = (Object.entries(summary.skipped) as Array<[SkipReason, number]>)
      .map(([because, count]) => `${because} ${count}`)
      .join(', ');
    log(`[initiative] sent ${summary.sent}; skipped: ${reasons || 'none'}`);

    return summary;
  }

  /**
   * The chain: each tick schedules the next strike of the hour, rather than a
   * poll asking every minute whether it is morning yet. `msUntilHour` is
   * strictly future, so a tick that runs on the hour arms tomorrow's.
   */
  let cancel: (() => void) | null = null;
  let stopped = false;

  function arm(): void {
    if (stopped) return;
    cancel = schedule(() => {
      void runTick(now())
        .catch((error) => log(`[initiative] the tick failed: ${String(error)}`))
        .finally(arm);
    }, msUntilHour(now(), hour));
  }

  return {
    runTick,
    start(): void {
      // The supervisor restarts polling after a dropped socket, and each
      // restart says start; a second chain would be a second morning.
      if (cancel !== null || stopped) return;
      arm();
    },
    stop(): void {
      stopped = true;
      cancel?.();
      cancel = null;
    },
  };
}
