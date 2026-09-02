/**
 * Where rooms live between messages.
 *
 * An interface rather than a table, because the bot should be runnable with
 * nothing but a process — and because the Postgres implementation belongs in
 * `@leela/db`, next to the rest of the schema, not here.
 */

import type { Room } from './commands';
import { DAY_MS, extendedTo } from './stars';

/** A table read back, and whether one was refused to give the answer. */
export interface ReadRoom {
  room: Room | null;
  /** True when a row is there and cannot be handed to the engine. */
  unreadable: boolean;
}

export interface RoomStore {
  get(chatId: string): Promise<Room | null>;
  /**
   * The table, and whether there is one that cannot be read.
   *
   * `get` answers `null` to both *no table here* and *there is a table and the
   * engine will not take it*, and two commands act on the difference. `/end`
   * replied *there is no table here* and left the row where it was, so the
   * chat had no way to clear it; `/new` has a guard against replacing a game in
   * progress, and the guard never fired, so the next `/new` wrote a fresh table
   * over every seat at that one — silently, with the reason in a server log
   * nobody at the table can read.
   *
   * Optional, like `roomOf`: a store that keeps rooms in memory cannot have an
   * unreadable one, and saying so by not having the method is this file's own
   * convention.
   */
  read?(chatId: string): Promise<ReadRoom>;

  save(room: Room): Promise<void>;
  delete(chatId: string): Promise<void>;
  /**
   * The table this player is seated at, wherever it is.
   *
   * A room is keyed by the chat it lives in, which is right for every command
   * a player sends at the table. `/ask` is not one of those: the companion
   * answers privately, so the natural place to ask is a private chat — and
   * there is no table there. A player seated in a group was told "take a seat
   * first" while holding one.
   *
   * Optional, like `ReportSink.history`: a store that cannot answer says so by
   * not having the method, and the caller falls back to the chat it is in
   * rather than pretending.
   */
  roomOf?(playerId: string): Promise<Room | null>;
  /**
   * Every table held, in the order they were last played, oldest first.
   *
   * Every method above answers for one chat, because every command arrives in
   * one. The companion's initiative is the first caller with no chat in hand —
   * it visits every seated player once a day — and until it, no store could
   * list what it holds. Optional under the file's own convention: a store that
   * cannot enumerate says so by not having the method, and the initiative
   * visits nobody rather than guessing.
   *
   * The order matters to a caller deduplicating seats: a player at two tables
   * is taken from the one they last played, which is `roomOf`'s answer too.
   */
  allRooms?(): Promise<Room[]>;
}

/**
 * Where a report goes once it is written.
 *
 * Separate from the room store because a report outlives the table it was
 * written at: it belongs to the player's own history of the game.
 */
export interface StoredReport {
  plan: number;
  text: string;
  createdAt: Date;
}

/** Where a move goes, so a game has a history a person can read. */
export interface StepSink {
  record(step: {
    userId: string;
    event: import('@leela/engine').MoveEvent;
    ruleset: import('@leela/engine').RuleSet;
  }): Promise<void>;
  /** Successful moves this player has made, across their kept history. */
  moved(userId: string): Promise<number>;
}

/** The first-player milestones in the paid continuation journey. */
export type PaymentMilestone = 'trial' | 'paywall' | 'invoice' | 'purchase' | 'return';

export interface PaymentFunnelSummary {
  trial: number;
  paywall: number;
  invoice: number;
  purchase: number;
  return: number;
}

/**
 * First milestones only. The player key already identifies every operational
 * row in this database; no writing, username, message, invoice, or charge is
 * copied into this analytics boundary.
 */
export interface PaymentFunnelStore {
  record(userId: string, stage: PaymentMilestone, at: number): Promise<void>;
  summary(): Promise<PaymentFunnelSummary>;
}

/** Telegram entry surfaces whose first touch Leela can verify or own. */
export const ACQUISITION_SOURCES = [
  'direct',
  'public',
  'guest',
  'inline',
  'mini_app',
] as const;
export type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

export interface AcquisitionRecord {
  source: AcquisitionSource;
  /** A bounded owned cohort, never arbitrary Telegram text. */
  campaign: string | null;
  startedAt: number;
}

export interface AcquisitionCount {
  source: AcquisitionSource;
  starts: number;
  purchases: number;
}

/** First-touch attribution. A later surface never rewrites the first. */
export interface AcquisitionStore {
  record(userId: string, acquisition: AcquisitionRecord): Promise<void>;
  /** Operational/test read; no caller logs or returns the player key. */
  of(userId: string): Promise<AcquisitionRecord | null>;
}

/** One completed UTC day's aggregate signals for Stars revenue growth. */
export interface DailyRevenueSnapshot {
  /** UTC day number, with the same epoch as the public-post cohort. */
  day: number;
  /** Whole Stars from successful payments recorded by Leela that day. */
  grossStars: number;
  /** Whole Stars whose local entitlement was marked refunded that day. */
  refundedStars: number;
  /** Successful payment rows, including repeat purchases by one payer. */
  payments: number;
  /** Distinct payers among those successful payment rows. */
  payers: number;
  /** Refund rows recorded that day. */
  refunds: number;
  /** First per-player milestones whose first timestamp falls on this day. */
  funnel: PaymentFunnelSummary;
  /** Starts attributed to this UTC day's public invitation. */
  publicStarts: number;
  /** Whether that invitation was successfully posted at all. */
  publicPosted: boolean;
  /** First starts and first purchases grouped by their first-touch source. */
  acquisition: AcquisitionCount[];
}

/**
 * Durable, aggregate-only financial reporting.
 *
 * There is deliberately no memory implementation. A process that forgets
 * purchases on restart cannot truthfully compare completed days or remember
 * which administrator already received one.
 */
export interface RevenueReportStore {
  day(day: number): Promise<DailyRevenueSnapshot>;
  /** Atomically reserve this recipient/day before crossing into Telegram. */
  claimDelivery(day: number, recipient: string, at: number): Promise<boolean>;
  /** Release only an unconfirmed claim after a known Telegram refusal. */
  releaseDelivery(day: number, recipient: string): Promise<void>;
  /** Confirm a claim after Telegram accepted the message. */
  recordDelivery(day: number, recipient: string, at: number): Promise<void>;
}

/** Per-process funnel memory for non-durable deployments and tests. */
export class MemoryPaymentFunnelStore implements PaymentFunnelStore {
  private readonly reached = new Map<string, Partial<Record<PaymentMilestone, number>>>();

  async record(userId: string, stage: PaymentMilestone, at: number): Promise<void> {
    const held = this.reached.get(userId) ?? {};
    if (held[stage] !== undefined) return;
    this.reached.set(userId, { ...held, [stage]: at });
  }

  async summary(): Promise<PaymentFunnelSummary> {
    const counts: PaymentFunnelSummary = {
      trial: 0,
      paywall: 0,
      invoice: 0,
      purchase: 0,
      return: 0,
    };
    for (const milestones of this.reached.values()) {
      for (const stage of Object.keys(counts) as PaymentMilestone[]) {
        if (milestones[stage] !== undefined) counts[stage] += 1;
      }
    }
    return counts;
  }
}

/** Per-process first-touch attribution for non-durable deployments and tests. */
export class MemoryAcquisitionStore implements AcquisitionStore {
  private readonly first = new Map<string, AcquisitionRecord>();

  async record(userId: string, acquisition: AcquisitionRecord): Promise<void> {
    if (!this.first.has(userId)) this.first.set(userId, acquisition);
  }

  async of(userId: string): Promise<AcquisitionRecord | null> {
    return this.first.get(userId) ?? null;
  }
}

/** A sink that drops moves, for running without storage. */
export const discardSteps: StepSink = {
  async record() {
    // Nothing. The game still plays; the history is simply not kept.
  },
  async moved() {
    // Nothing was kept, so this sink can prove no kept move.
    return 0;
  },
};

/** Moves held for the lifetime of a process when no durable store is open. */
export class MemoryStepSink implements StepSink {
  private readonly steps: Array<{
    userId: string;
    event: import('@leela/engine').MoveEvent;
  }> = [];

  async record(step: {
    userId: string;
    event: import('@leela/engine').MoveEvent;
    ruleset: import('@leela/engine').RuleSet;
  }): Promise<void> {
    this.steps.push({ userId: step.userId, event: step.event });
  }

  async moved(userId: string): Promise<number> {
    return this.steps.filter((step) => step.userId === userId && !step.event.isBlocked).length;
  }
}

export interface ReportSink {
  /**
   * Keep one report.
   *
   * `at` is when it was *written*, which is not always now: a path arriving as
   * a file carries the moment each entry was made, sometimes a year ago. It
   * was not passed, so every imported entry was stamped with the moment of the
   * import — which falsified the whole history and, worse, made the same file
   * arrive as new every time, duplicating a player's path on each send.
   */
  record(report: {
    userId: string;
    plan: number;
    text: string;
    at?: Date;
  }): Promise<void>;
  /**
   * What a player has written, newest first.
   *
   * Optional: a sink that discards reports has nothing to return, and the
   * caller should say so rather than showing an empty history that looks like
   * the player never wrote anything.
   */
  history?(userId: string): Promise<StoredReport[]>;
  /**
   * What this player is playing for, and a way to set it.
   *
   * Optional together, and for the same reason `history` is: a sink that keeps
   * nothing has no question to return, and the caller must say so rather than
   * answer "you have not chosen one" — which would be a different and untrue
   * statement.
   */
  intention?(userId: string): Promise<string | null>;
  setIntention?(userId: string, text: string): Promise<void>;
}

/** Reports in memory. Enough for a single process and for tests. */
export class MemoryReportSink implements ReportSink {
  readonly reports: Array<{ userId: string; plan: number; text: string; createdAt: Date }> = [];

  constructor(private readonly now: () => number = Date.now) {}

  async record(report: {
    userId: string;
    plan: number;
    text: string;
    at?: Date;
  }): Promise<void> {
    const { at, ...rest } = report;
    this.reports.push({ ...rest, createdAt: at ?? new Date(this.now()) });
  }

  async history(userId: string): Promise<StoredReport[]> {
    return this.reports
      .filter((report) => report.userId === userId)
      .map(({ plan, text, createdAt }) => ({ plan, text, createdAt }))
      .reverse();
  }

  private readonly intentions = new Map<string, string>();

  async intention(userId: string): Promise<string | null> {
    return this.intentions.get(userId) ?? null;
  }

  async setIntention(userId: string, text: string): Promise<void> {
    this.intentions.set(userId, text);
  }
}

/** A sink that drops reports, for running the bot without storage. */
export const discardReports: ReportSink = {
  async record() {
    // Nothing. The gate still works; the writing is simply not kept.
  },
  // No `history`: nothing was kept, and saying so beats showing an empty list.
};

/** Which wording bridged a public plan excerpt into reflection. */
export type PublicBridge = 'model' | 'canonical';

/** One anonymous daily public-post cohort. No reader identity crosses this boundary. */
export interface PublicPostRecord {
  day: number;
  plan: number;
  sentAt: number;
  bridge: PublicBridge;
  /** Aggregate starts attributed to this post. */
  starts: number;
}

export interface PublicOutreachStore {
  of(day: number): Promise<PublicPostRecord | null>;
  /** First successful send wins, making restarts and concurrent ticks idempotent. */
  record(post: Omit<PublicPostRecord, 'starts'>): Promise<void>;
  /** Count a known cohort start without retaining the reader. */
  started(day: number): Promise<void>;
}

/** Per-process public-post memory for tests and non-durable deployments. */
export class MemoryPublicOutreachStore implements PublicOutreachStore {
  private readonly posts = new Map<number, PublicPostRecord>();

  async of(day: number): Promise<PublicPostRecord | null> {
    return this.posts.get(day) ?? null;
  }

  async record(post: Omit<PublicPostRecord, 'starts'>): Promise<void> {
    if (this.posts.has(post.day)) return;
    this.posts.set(post.day, { ...post, starts: 0 });
  }

  async started(day: number): Promise<void> {
    const post = this.posts.get(day);
    if (!post) return;
    this.posts.set(day, { ...post, starts: post.starts + 1 });
  }
}

/**
 * What the companion remembers about its own initiative, per player.
 *
 * The daily word (`initiative.ts`) must know three things to knock politely:
 * when it last knocked — so one day carries one message, whatever restarts a
 * tick; which excerpt it read out — so the next is never the one just heard;
 * and whether `/quiet` has closed the door. Kept in the same storage the games
 * live in, in memory when the games are, because the companion's memory should
 * not outlive the games it is a memory of — nor be lost while they survive.
 */
export interface NudgeRecord {
  /** When the daily word was last sent, epoch ms. Null before the first. */
  sentAt: number | null;
  /** Index of the excerpt that send carried. Null before the first. */
  excerpt: number | null;
  /** Whether `/quiet` has turned the daily word off. */
  quieted: boolean;
  /**
   * How many doorstep words this player has been sent — the third arm's whole
   * bound.
   *
   * A count rather than a date, and that is the shape the data forced: the arm
   * speaks to a player who has never thrown, whose seat therefore carries no
   * timestamp at all, and the session's `updated_at` moves whenever anyone
   * else at the table does anything. Three and then silence for ever says what
   * "not after a fortnight" meant, without a clock that lies on a busy table.
   */
  doorsteps: number;
}

/** A record for a player never written to: the four "not yet" answers. */
export const NEVER_NUDGED: NudgeRecord = {
  sentAt: null,
  excerpt: null,
  quieted: false,
  doorsteps: 0,
};

export interface NudgeStore {
  /** What is remembered about this player. Never null: absence is `NEVER_NUDGED`. */
  of(userId: string): Promise<NudgeRecord>;
  /**
   * Remember a send: the moment, which excerpt it carried, and whether it was
   * a doorstep word — the one kind that spends a counted allowance.
   */
  record(userId: string, sent: { at: number; excerpt: number; doorstep?: boolean }): Promise<void>;
  /**
   * Attribute the first accepted action of this kind to the latest delivered
   * word, inside its one-day window. No text or game context is kept.
   */
  convert(userId: string, kind: NudgeConversion, at: number): Promise<boolean>;
  /** `/quiet` — both directions, because coming back is part of the command. */
  setQuieted(userId: string, quieted: boolean): Promise<void>;
}

export type NudgeConversion = 'response' | 'roll';

/** Aggregate outcomes for one delivered daily-word cohort. */
export interface NudgeConversionCounts {
  responses: number;
  rolls: number;
}

/** Nudge memory in memory. Enough for a single process and for tests. */
export class MemoryNudgeStore implements NudgeStore {
  private readonly records = new Map<string, NudgeRecord>();
  private readonly conversions = new Map<
    string,
    { response: number | null; roll: number | null }
  >();

  async of(userId: string): Promise<NudgeRecord> {
    return this.records.get(userId) ?? NEVER_NUDGED;
  }

  async record(userId: string, sent: { at: number; excerpt: number; doorstep?: boolean }): Promise<void> {
    const held = await this.of(userId);
    this.records.set(userId, {
      ...held,
      sentAt: sent.at,
      excerpt: sent.excerpt,
      doorsteps: held.doorsteps + (sent.doorstep ? 1 : 0),
    });
  }

  async convert(userId: string, kind: NudgeConversion, at: number): Promise<boolean> {
    const nudge = await this.of(userId);
    if (nudge.sentAt === null || at < nudge.sentAt || at - nudge.sentAt >= DAY_MS) {
      return false;
    }

    const held = this.conversions.get(userId) ?? { response: null, roll: null };
    if (held[kind] === nudge.sentAt) return false;
    this.conversions.set(userId, { ...held, [kind]: nudge.sentAt });
    return true;
  }

  async setQuieted(userId: string, quieted: boolean): Promise<void> {
    const held = await this.of(userId);
    this.records.set(userId, { ...held, quieted });
  }
}

/**
 * A payment in Telegram Stars, and the stretch of time it bought.
 *
 * One row per payment rather than one per player, unlike `nudges` and
 * `intentions` next door. The reason is the refund: Telegram gives money back
 * per `telegram_payment_charge_id`, so a store that kept only a player's
 * current expiry could not tell which payment a refund was undoing — and a
 * player who has paid twice would lose both stretches for one refund, or
 * neither. Keyed by the charge, this is the same append-and-read shape
 * `reports` and `game_steps` already have, and the player's expiry is derived
 * from it rather than kept beside it, so the two cannot disagree.
 */
export interface Entitlement {
  /** Telegram's own id for the payment, and the only handle a refund has. */
  chargeId: string;
  userId: string;
  /** Which tier was bought, as `stars.ts` names them. */
  tier: string;
  /** What was paid, in whole Stars. */
  stars: number;
  paidAt: number;
  /** When this payment's stretch runs out, epoch ms. */
  until: number;
  /** When it was given back, or null while it stands. */
  refundedAt: number | null;
}

/** A live entitlement: what `subscribed` answers when there is one. */
export interface Subscription {
  /** When it runs out, epoch ms. */
  until: number;
}

/**
 * Where entitlements live.
 *
 * Three methods, so a fake is cheap and so that nothing else in this bot can
 * write one: an entitlement is created by a payment Telegram has confirmed and
 * by nothing else.
 *
 * Both chat rolls and mini-app rolls ask `subscribed` after the player's three
 * successful free moves. The store is therefore part of access control: a
 * confirmed payment opens play until its recorded expiry, on both surfaces.
 */
export interface EntitlementStore {
  /**
   * Keep a payment, and say what it bought.
   *
   * The expiry is computed here rather than by the caller because it depends
   * on what the player already holds — see `extendedTo` in `stars.ts`, which
   * both implementations share so the two cannot answer differently.
   */
  record(payment: {
    userId: string;
    chargeId: string;
    tier: string;
    stars: number;
    days: number;
    at: number;
  }): Promise<Entitlement>;
  /** Whether this player holds one at `now`, and until when. Null for none. */
  subscribed(userId: string, now: number): Promise<Subscription | null>;
  /**
   * One payment, by the charge Telegram knows it as.
   *
   * Read before a refund rather than folded into it: a refund is two acts in
   * two systems, and the payer has to be known *before* Telegram is asked, so
   * that a refusal from Telegram leaves this bot's record untouched.
   */
  of(chargeId: string): Promise<Entitlement | null>;
  /**
   * Give a payment back: mark it refunded, so it stops counting.
   *
   * @returns what was refunded, or null when this bot has never heard of that
   *          charge — which an operator must be told rather than shown a
   *          success for a payment nobody here has a record of.
   */
  refund(chargeId: string, at: number): Promise<Entitlement | null>;
}

/** Entitlements in memory. Enough for a single process and for tests. */
export class MemoryEntitlementStore implements EntitlementStore {
  private readonly paid = new Map<string, Entitlement>();

  async record(payment: {
    userId: string;
    chargeId: string;
    tier: string;
    stars: number;
    days: number;
    at: number;
  }): Promise<Entitlement> {
    // A charge already kept is a payment already counted.
    //
    // MEASURED, and it is why this line is here rather than a comment about
    // keys: an update is retried until the bot answers it, so the same
    // `successful_payment` can arrive twice — and writing it twice was not
    // caught by keying the map on the charge. The row was replaced, and the
    // *arithmetic* had already read the first stretch as something to extend,
    // so one payment bought sixty days. The store must be idempotent in what
    // it computes, not only in what it holds.
    const already = this.paid.get(payment.chargeId);
    if (already) return already;

    const live = await this.subscribed(payment.userId, payment.at);
    const entitlement: Entitlement = {
      chargeId: payment.chargeId,
      userId: payment.userId,
      tier: payment.tier,
      stars: payment.stars,
      paidAt: payment.at,
      until: extendedTo(live?.until ?? null, payment.at, payment.days),
      refundedAt: null,
    };

    this.paid.set(entitlement.chargeId, entitlement);
    return entitlement;
  }

  async subscribed(userId: string, now: number): Promise<Subscription | null> {
    let until: number | null = null;
    for (const entitlement of this.paid.values()) {
      if (entitlement.userId !== userId) continue;
      if (entitlement.refundedAt !== null) continue;
      if (entitlement.until <= now) continue;
      if (until === null || entitlement.until > until) until = entitlement.until;
    }
    return until === null ? null : { until };
  }

  async of(chargeId: string): Promise<Entitlement | null> {
    return this.paid.get(chargeId) ?? null;
  }

  async refund(chargeId: string, at: number): Promise<Entitlement | null> {
    const held = this.paid.get(chargeId);
    if (!held) return null;

    const refunded = { ...held, refundedAt: at };
    this.paid.set(chargeId, refunded);
    return refunded;
  }
}

/**
 * Rooms in memory.
 *
 * Fine for a single process and for tests. A restart loses every game in
 * progress, which is why it is not the default in production.
 */
export class MemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, Room>();

  async get(chatId: string): Promise<Room | null> {
    return this.rooms.get(chatId) ?? null;
  }

  async save(room: Room): Promise<void> {
    // Deleted first so the map's order is the order of last play, which is what
    // `roomOf` reads to answer "which of your tables did you mean".
    this.rooms.delete(room.chatId);
    this.rooms.set(room.chatId, room);
  }

  async delete(chatId: string): Promise<void> {
    this.rooms.delete(chatId);
  }

  /**
   * The table this player sits at, most recently played first.
   *
   * `save` re-inserts, so the map's order is the order tables were last
   * touched — the newest is what a player asking a question means.
   */
  async roomOf(playerId: string): Promise<Room | null> {
    let found: Room | null = null;
    for (const room of this.rooms.values()) {
      if (room.session.players.some((player) => player.id === playerId)) found = room;
    }
    return found;
  }

  /** Every table held, oldest-played first — the map's own insertion order. */
  async allRooms(): Promise<Room[]> {
    return [...this.rooms.values()];
  }

  /** Rooms currently held. Exposed for tests and for a health endpoint. */
  get size(): number {
    return this.rooms.size;
  }
}

/**
 * A seed for a new room.
 *
 * Derived from the chat id and a caller-supplied number rather than from
 * `Math.random()`, so a room's die is reproducible from values that are
 * already recorded, and two rooms opened in the same millisecond still differ.
 */
export function seedFor(chatId: string, salt: number): number {
  let hash = 2166136261;
  for (const char of `${chatId}:${salt}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
