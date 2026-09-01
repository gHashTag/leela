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
 * conditions. `eligible` chooses the word and `compose` shapes it, both pure
 * so every branch is a test rather than a hope. A configured companion adds
 * one brief bridge from the canonical plan to the next action the engine
 * actually accepts; the canonical bridge survives any model failure. Private
 * writing is never sent on a proactive call.
 *
 * What is deliberately absent, with the spec's reasons: streaks (play to
 * protect a number is the opposite of a reflection game), guessed per-user
 * send times (Telegram exposes no timezone), and extra messages. The agent
 * personalizes the one existing daily word; it does not create a campaign.
 */

import { Keyboard } from 'grammy';
import type { ReplyKeyboardMarkup } from 'grammy/types';
import {
  engagementFallbackText,
  type EngagementOptions,
  type Guide,
  type Reflection,
} from '@leela/ai';
import {
  formatWait,
  lastSentenceEnd,
  messageFor,
  planFor,
  type Language,
  type Plan,
} from '@leela/content';
import { hasWon, owesReport } from '@leela/engine';
import { afterReport, launchButton, standingSquare, type Room } from './commands';
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
import type { NudgeConversionCounts, NudgeStore, RoomStore } from './store';

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
 * How many doorstep words a player who never entered may be sent: three.
 *
 * The third arm's whole bound, and a count rather than a window because the
 * player it speaks to carries no timestamp: a seat stamps `lastRollAt` on a
 * throw and `lastReportAt` on a report, and somebody who has done neither has
 * neither. Three invitations and then silence for ever is what a fortnight
 * meant, said in the one unit this player's row actually has.
 */
export const DOORSTEP_WORDS = 3;

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

/**
 * When the next daily word is due, as one sentence.
 *
 * Pure over its inputs so a test holds it, and printed at the moment the chain
 * is armed rather than at startup — because those are two different facts and
 * the banner had only the first.
 *
 * "Last daily word: none yet on this database." is true on the first morning
 * of a deployment AND true of a bot whose scheduler was never armed, and an
 * operator reading it cannot tell which. Said beside this line the pair is
 * unambiguous: none yet, and the next one is at a named hour. Absent this
 * line, none yet and nothing coming.
 */
export function nextWordDue(now: number, hour: number): string {
  const at = new Date(now + msUntilHour(now, hour));
  return `The daily word is armed: next at ${at.toISOString().slice(0, 16).replace('T', ' ')} UTC.`;
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
 *
 * `not-standing` was the first of them and is gone, which is the point of the
 * doorstep arm: it named a state a player could never leave, so the one
 * player in the first production tick was skipped for ever. What replaces it
 * is `doorstep-spent` — the same silence, but only after three invitations
 * were actually sent.
 */
export type SkipReason =
  | 'doorstep-spent'
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
  /** How many doorstep words they have already been sent. */
  doorstepsSent: number;
}

/** Which of the companion's words a tick sends. */
export type Word = 'daily' | 'freshStart' | 'doorstep';

export type Verdict = { send: true; word: Word } | { send: false; because: SkipReason };

/**
 * The sleeping condition, one clause per line of the spec — and the fork that
 * picks which of the three words a morning carries.
 *
 * The arms are disjoint by construction rather than by care: the board state
 * splits them first (standing on no plan selects the doorstep word and can
 * select nothing else), and inside the standing half one activity age selects
 * exactly one word or none. A player whose seat has rolled or reported but is
 * silent carries a timestamp; a player who never has carries none, and an
 * absence is not recent activity: they are lapsed, not fresh.
 */
export function eligible(candidate: Candidate, now: number): Verdict {
  // The four clauses every word obeys, asked first: a game over, a channel
  // closed, a player who said /quiet, and the one-a-day cap. They come before
  // the board state because they are about the person rather than the square —
  // and because the arms below must each be reached with the channel already
  // known good, or every one of them would have to ask again.
  if (candidate.finished) return { send: false, because: 'finished' };
  if (!candidate.reachable) return { send: false, because: 'no-channel' };
  if (candidate.quieted) return { send: false, because: 'quieted' };
  if (candidate.lastNudgedAt !== null && utcDayOf(candidate.lastNudgedAt) === utcDayOf(now)) {
    return { send: false, because: 'nudged-today' };
  }
  if (candidate.standing === null) {
    // The third arm, and the one the first live tick asked for: a player who
    // took a seat and never threw a six stands on no plan, so a word made of
    // the plan's text has nothing to say to them. This one is not made of it.
    // Bounded by a count, spent only when a doorstep word actually arrives.
    if (candidate.doorstepsSent >= DOORSTEP_WORDS) {
      return { send: false, because: 'doorstep-spent' };
    }
    return { send: true, word: 'doorstep' };
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
 * The doorstep word is the exception it has to be: a player waiting to enter
 * stands on no plan, so it carries neither the excerpt nor the standing line,
 * and its call names the die rather than the square.
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
  said: {
    firstNudge: boolean;
    word?: Word;
    bridge?: string;
    reportOwed?: boolean;
    cta?: string;
  },
): Composed {
  if (said.word === 'doorstep') {
    // No excerpt and no standing line: this player stands on no plan, and a
    // word that told them which plan they were on would be the one untrue
    // thing the engine could say. The cursor is returned unmoved — a doorstep
    // word carries no excerpt, so it must not spend one.
    return {
      text: [
        messageFor(language, 'nudge.doorstep'),
        messageFor(language, 'nudge.doorstepCta'),
        ...(said.firstNudge ? ['', messageFor(language, 'nudge.wayOut')] : []),
      ].join('\n'),
      excerpt: lastExcerpt ?? 0,
    };
  }

  const pieces = excerptsOf(plan.body);
  const index = nextExcerpt(pieces.length, lastExcerpt);
  const excerpt = pieces[index];

  const lines = [
    // A comeback opens with the landmark, not the lesson: the research's
    // fresh-start framing - a clean slate offered, nothing counted or lost.
    ...(said.word === 'freshStart' ? [messageFor(language, 'nudge.freshStart'), ''] : []),
    ...(excerpt ? [excerpt, ''] : []),
    messageFor(language, 'nudge.standing', { plan: plan.plan, title: plan.title }),
    ...(said.bridge ? ['', said.bridge] : []),
    said.cta ??
      (said.reportOwed
        ? messageFor(language, 'nudge.reportCta')
        : messageFor(language, 'nudge.cta')),
    ...(said.firstNudge ? ['', messageFor(language, 'nudge.wayOut')] : []),
  ];

  return { text: lines.join('\n'), excerpt: index };
}

/**
 * The last tick, said as one sentence a person reads at startup.
 *
 * Pure over its input so a test holds it without a process — and separate from
 * the `[initiative]` line the tick itself logs, which is unchanged. That line
 * is for an operator watching live; this is for the one who arrived after the
 * container restarted, which is every reader the tick has ever had. It fires
 * at 06:00 UTC, and in six attempts to read it the log window had rolled past
 * it five times.
 *
 * `null` is a deployment that has never ticked, and it says so rather than
 * printing a sentence with a hole in it.
 */
export interface DailyWordRecord {
  at: number;
  sent: number;
  skipped: Record<string, number>;
  bridges?: Partial<BridgeCounts>;
  conversions?: Partial<NudgeConversionCounts>;
}

export function lastWordSaid(record: DailyWordRecord | null): string {
  if (record === null) return 'Last daily word: none yet on this database.';

  const when = new Date(record.at).toISOString().slice(0, 16).replace('T', ' ');
  const reasons = Object.entries(record.skipped)
    .map(([because, count]) => `${because} ${count}`)
    .join(', ');

  const model = record.bridges?.model ?? 0;
  const canonical = record.bridges?.canonical ?? 0;
  const responses = record.conversions?.responses ?? 0;
  const rolls = record.conversions?.rolls ?? 0;
  return (
    `Last daily word: ${when} UTC — sent ${record.sent}; ` +
    `bridges: model ${model}, canonical ${canonical}; ` +
    `conversions: responses ${responses}, rolls ${rolls}; skipped: ${reasons || 'none'}.`
  );
}

export interface BridgeCounts {
  model: number;
  canonical: number;
}

/** What one tick did, for the summary line and for tests. */
export interface TickSummary {
  sent: number;
  bridges: BridgeCounts;
  skipped: Partial<Record<SkipReason, number>>;
  /** Present only when an open prior cohort held this tick. */
  retryInMs?: number;
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
  /** The same companion the reactive chat uses, narrowed to proactive work. */
  companion?: Pick<Guide, 'engage' | 'status'>;
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
  /**
   * Where the summary is kept so it outlives the log.
   *
   * Optional, and a tick that cannot store one still runs: the daily word is
   * the product and the record is a note about it. Injected rather than
   * reached for, like everything else this engine touches.
   */
  remember?: (at: number, summary: TickSummary) => Promise<void>;
  /** Read the previous durable cohort before this tick replaces its row. */
  previous?: () => DailyWordRecord | null;
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
  companion,
  channels,
  launchUrl,
  hour = DEFAULT_NUDGE_HOUR,
  now = Date.now,
  remember,
  previous,
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
    const summary: TickSummary = {
      sent: 0,
      bridges: { model: 0, canonical: 0 },
      skipped: {},
    };

    // A new tick overwrites the one durable summary row. Say the completed
    // cohort first, after its 24-hour conversion window has closed, so the
    // outcome is observable without keeping a per-player analytics history.
    try {
      const prior = previous?.() ?? null;
      if (prior) {
        if (at - prior.at < DAY_MS) {
          // A changed send hour can make the next scheduled strike arrive in
          // 23 hours. Holding that strike preserves both the player's quiet
          // day and the only durable cohort until its window is complete.
          log('[initiative] previous conversion window is still open; tick held.');
          summary.retryInMs = Math.max(1, prior.at + DAY_MS - at);
          return summary;
        }
        log(`[initiative] ${lastWordSaid(prior)}`);
      }
    } catch (error) {
      // Metrics are a note about the game, never a reason to withhold it.
      log(`[initiative] could not read previous conversions: ${String(error)}`);
    }

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

    // Undefined means the first standing candidate has not asked yet. A
    // fallback from that first call opens the circuit for the rest of this
    // tick: one provider timeout may delay the morning, N timeouts may not.
    let companionAwake: boolean | undefined;

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
          doorstepsSent: memory.doorsteps,
        },
        at,
      );

      if (!verdict.send) {
        skip(verdict.because);
        continue;
      }

      const plan = planFor(room.language, seat.state.loka);
      let bridge: Reflection | null = null;
      let reportOwed: boolean | undefined;
      let cta: string | undefined;

      if (verdict.word !== 'doorstep') {
        reportOwed = owesReport(seat.state, room.session.rules) && !seat.reportSubmitted;
        if (reportOwed) {
          cta = messageFor(room.language, 'nudge.reportCta');
          if (room.session.rules.minReportChars > 0) {
            cta += ` ${messageFor(room.language, 'report.tooShort', {
              count: room.session.rules.minReportChars,
            })}`;
          }
        } else {
          const next = afterReport(room.session, userId, at);
          cta =
            next.say === 'not-your-turn'
              ? messageFor(room.language, 'roll.notYourTurn', {
                  name: room.names[next.holder] ?? next.holder,
                })
              : next.say === 'wait'
                ? messageFor(room.language, 'roll.cooldown', {
                    wait: formatWait(room.language, next.waitMs),
                  })
                : next.say === 'finished'
                  ? messageFor(room.language, 'roll.over')
                  : messageFor(room.language, 'nudge.cta');
        }

        const base: EngagementOptions = {
          language: room.language,
          plan: plan.plan,
          reportOwed,
        };
        bridge = { text: engagementFallbackText(base), fromModel: false };

        // Status is read lazily, so skipped/doorstep candidates do not even
        // wake the companion. Proactive calls receive canonical plan context
        // only — never intention, reports, conversation, or a user id.
        if (companionAwake === undefined) {
          try {
            companionAwake = companion?.status().available ?? false;
          } catch (error) {
            // A custom adapter can fail before the model call itself. Treat
            // that exactly like a provider failure: keep the word canonical
            // and open the tick circuit instead of aborting every delivery.
            log(
              '[initiative] companion status failed; using canonical bridges ' +
                `for this tick: ${String(error)}`,
            );
            companionAwake = false;
          }
        }
        if (companion && companionAwake) {
          try {
            bridge = await companion.engage(base);
            if (!bridge.fromModel) {
              companionAwake = false;
              log(
                `[initiative] companion fell back on plan ${plan.plan}; ` +
                  'using canonical bridges for the rest of this tick.',
              );
            }
          } catch (error) {
            // `Guide` already falls back on world failures. This catches a
            // malformed injected implementation or a store read failure: the
            // morning still carries the canonical bridge, and says why.
            log(
              `[initiative] companion failed for plan ${plan.plan}; ` +
                `using the canonical bridge: ${String(error)}`,
            );
            companionAwake = false;
          }
        }
      }

      const word = compose(room.language, plan, memory.excerpt, {
        firstNudge: memory.sentAt === null,
        word: verdict.word,
        bridge: bridge?.text,
        reportOwed,
        cta,
      });

      const outcome = await deliver(userId, room.language, word.text);
      if (outcome === 'sent') {
        // Remembered only when it arrived: a failed send has not spent the
        // day, and tomorrow's tick owes this player another knock.
        await nudges.record(userId, {
          at,
          excerpt: word.excerpt,
          doorstep: verdict.word === 'doorstep',
        });
        summary.sent += 1;
        if (bridge) summary.bridges[bridge.fromModel ? 'model' : 'canonical'] += 1;
      } else {
        skip(outcome);
      }
    }

    // One line an operator reads, not a scroll: who was written to and where
    // the silence came from, reason by reason.
    const reasons = (Object.entries(summary.skipped) as Array<[SkipReason, number]>)
      .map(([because, count]) => `${because} ${count}`)
      .join(', ');
    // Kept byte-for-byte: specs/008 made this line an operational contract.
    log(`[initiative] sent ${summary.sent}; skipped: ${reasons || 'none'}`);
    log(
      `[initiative] bridges: model ${summary.bridges.model}, ` +
        `canonical ${summary.bridges.canonical}`,
    );

    // Kept as well as said. The line above is read by whoever is watching;
    // this is read by whoever is not, which has been everybody.
    await remember?.(at, summary);

    return summary;
  }

  /**
   * The chain: each tick schedules the next strike of the hour, rather than a
   * poll asking every minute whether it is morning yet. `msUntilHour` is
   * strictly future, so a tick that runs on the hour arms tomorrow's.
   */
  let cancel: (() => void) | null = null;
  let stopped = false;

  function arm(retryInMs?: number): void {
    if (stopped) return;
    // Said each time the chain is armed: once at startup, and once more after
    // every tick, so a log carries the proof that the next morning is coming
    // rather than only that the last one went.
    const inMs = retryInMs ?? msUntilHour(now(), hour);
    log(
      retryInMs === undefined
        ? nextWordDue(now(), hour)
        : `[initiative] held daily word retries in ${inMs}ms.`,
    );
    cancel = schedule(() => {
      void runTick(now()).then(
        (result) => arm(result.retryInMs),
        (error) => {
          log(`[initiative] the tick failed: ${String(error)}`);
          arm();
        },
      );
    }, inMs);
  }

  return {
    runTick,
    start(): void {
      // The supervisor restarts polling after a dropped socket, and each
      // restart says start; a second chain would be a second morning.
      if (cancel !== null || stopped) return;
      log(
        companion
          ? '[initiative] plan-aware companion configured; canonical fallback ready.'
          : '[initiative] no companion configured; canonical plan bridge ready.',
      );
      arm();
    },
    stop(): void {
      stopped = true;
      cancel?.();
      cancel = null;
    },
  };
}
