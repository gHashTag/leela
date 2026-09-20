/** The authenticated bridge from the Telegram board to the chat's room. */

import {
  MAX_SEATS,
  hasWon,
  isPlayableState,
  isSessionOver,
  ruleSetById,
  type MoveEvent,
  type Session,
} from '@leela/engine';
import { hopsFor, type Thrown } from './play';
import { FREE_MOVES } from '@leela/journal';

export interface SharedPlayerContext {
  intention: string | null;
  reports: Array<{ plan: number; text: string; at: number }>;
  access: SharedAccess;
}

export interface SharedTier { id: 'month' | 'halfyear' | 'year'; stars: number; days: number }
export interface SharedAccess {
  enabled: boolean;
  mayRoll: boolean;
  freeMoves: number;
  movesUsed: number;
  left: number | null;
  entitledUntil: number | null;
  tiers: SharedTier[];
}

/** The mobile paywall's honest default: the shortest available commitment. */
export function defaultTier(tiers: readonly SharedTier[]): SharedTier | null {
  return tiers.reduce<SharedTier | null>(
    (shortest, tier) => shortest === null || tier.days < shortest.days ? tier : shortest,
    null,
  );
}

export interface SharedSnapshot {
  chatId: string;
  started: boolean;
  language: string;
  ruleset: string;
  turnIndex: number;
  rollCount: number;
  rollsTaken: number;
  lastThrower: number | null;
  players: Session['players'];
  rolls: number[][];
}

export interface SharedMove {
  playerId: string;
  roll: number;
  event: MoveEvent;
  keepsTurn: boolean;
}

export interface SharedReply {
  snapshot: SharedSnapshot;
  move: SharedMove | null;
  replies: string[];
  accepted: boolean;
  player: SharedPlayerContext;
  invoiceUrl: string | null;
}

export interface SharedGame {
  chatId: string;
  initData: string;
  userId: string;
  endpoint: string;
  snapshot: SharedSnapshot | null;
  player: SharedPlayerContext;
  error: string | null;
}

declare global {
  // Written by `boot.ts` before this app's large entry is imported.
  var __leelaSharedGame: SharedGame | undefined;
}

const integer = (value: unknown, from = 0): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= from;

const eventOf = (value: unknown): value is MoveEvent => {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    integer(event.roll, 1) && event.roll <= 6 &&
    integer(event.from) && integer(event.to) &&
    typeof event.direction === 'string' &&
    typeof event.isGameStart === 'boolean' &&
    typeof event.isGameFinished === 'boolean' &&
    typeof event.isThreeSixesReset === 'boolean' &&
    typeof event.isBlocked === 'boolean' &&
    typeof event.wasComplete === 'boolean' &&
    typeof event.grantsExtraTurn === 'boolean' &&
    (event.jumpedFrom === null || integer(event.jumpedFrom))
  );
};

/** Refuse a partial or hand-written room rather than painting it. */
export function snapshotFrom(value: unknown): SharedSnapshot | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.chatId !== 'string' || !row.chatId ||
    typeof row.started !== 'boolean' ||
    typeof row.language !== 'string' ||
    typeof row.ruleset !== 'string' ||
    !integer(row.turnIndex) ||
    !integer(row.rollCount) ||
    !integer(row.rollsTaken) ||
    !(row.lastThrower === null || integer(row.lastThrower)) ||
    !Array.isArray(row.players) ||
    row.players.length < 1 || row.players.length > MAX_SEATS ||
    !Array.isArray(row.rolls) || row.rolls.length !== row.players.length
  ) return null;

  try {
    ruleSetById(row.ruleset as Parameters<typeof ruleSetById>[0]);
  } catch {
    return null;
  }

  const ids = new Set<string>();
  for (const player of row.players) {
    if (typeof player !== 'object' || player === null) return null;
    const held = player as Record<string, unknown>;
    if (
      typeof held.id !== 'string' || !held.id || ids.has(held.id) ||
      !(held.name === undefined || typeof held.name === 'string') ||
      !isPlayableState(held.state) ||
      !(held.lastRollAt === null || integer(held.lastRollAt)) ||
      !(held.lastReportAt === null || integer(held.lastReportAt)) ||
      typeof held.reportSubmitted !== 'boolean'
    ) return null;
    ids.add(held.id);
  }
  if (row.turnIndex >= row.players.length) return null;
  if (row.lastThrower !== null && row.lastThrower >= row.players.length) return null;

  let counted = 0;
  for (const history of row.rolls) {
    if (!Array.isArray(history) || !history.every((roll) => integer(roll, 1) && roll <= 6)) {
      return null;
    }
    counted += history.length;
  }
  if (counted !== row.rollsTaken || row.rollCount !== row.rollsTaken) return null;

  return row as unknown as SharedSnapshot;
}

export function replyFrom(value: unknown): SharedReply | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const snapshot = snapshotFrom(row.snapshot);
  const player = playerContextFrom(row.player);
  if (
    !snapshot || !player || typeof row.accepted !== 'boolean' ||
    !Array.isArray(row.replies) || !row.replies.every((line) => typeof line === 'string') ||
    !(row.invoiceUrl === null || typeof row.invoiceUrl === 'string')
  ) {
    return null;
  }
  if (row.move === null) {
    return {
      snapshot,
      move: null,
      replies: row.replies as string[],
      accepted: row.accepted,
      player,
      invoiceUrl: row.invoiceUrl,
    };
  }
  if (typeof row.move !== 'object' || row.move === null) return null;
  const move = row.move as Record<string, unknown>;
  if (
    typeof move.playerId !== 'string' ||
    !integer(move.roll, 1) || move.roll > 6 ||
    typeof move.keepsTurn !== 'boolean' ||
    !eventOf(move.event) ||
    move.roll !== move.event.roll
  ) return null;
  return {
    snapshot,
    move: move as unknown as SharedMove,
    replies: row.replies as string[],
    accepted: row.accepted,
    player,
    invoiceUrl: row.invoiceUrl,
  };
}

export function playerContextFrom(value: unknown): SharedPlayerContext | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const access = accessFrom(row.access);
  if (!access || !(row.intention === null || typeof row.intention === 'string') || !Array.isArray(row.reports)) {
    return null;
  }
  const reports: SharedPlayerContext['reports'] = [];
  for (const report of row.reports) {
    if (typeof report !== 'object' || report === null) return null;
    const held = report as Record<string, unknown>;
    if (
      !integer(held.plan, 1) || held.plan > 72 ||
      typeof held.text !== 'string' || held.text.trim().length === 0 ||
      !integer(held.at, 1)
    ) return null;
    reports.push({ plan: held.plan, text: held.text, at: held.at });
  }
  return { intention: row.intention, reports, access };
}

export function accessFrom(value: unknown): SharedAccess | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.enabled !== 'boolean' || typeof row.mayRoll !== 'boolean' ||
    !integer(row.freeMoves) || !integer(row.movesUsed) ||
    !(row.left === null || integer(row.left)) ||
    !(row.entitledUntil === null || integer(row.entitledUntil, 1)) ||
    !Array.isArray(row.tiers)
  ) return null;
  const tiers: SharedTier[] = [];
  for (const value of row.tiers) {
    if (typeof value !== 'object' || value === null) return null;
    const tier = value as Record<string, unknown>;
    if (!['month', 'halfyear', 'year'].includes(String(tier.id)) || !integer(tier.stars, 1) || !integer(tier.days, 1)) return null;
    tiers.push({ id: tier.id as SharedTier['id'], stars: tier.stars, days: tier.days });
  }
  if (!row.enabled && (!row.mayRoll || row.left !== null || tiers.length > 0)) return null;
  return { enabled: row.enabled, mayRoll: row.mayRoll, freeMoves: row.freeMoves, movesUsed: row.movesUsed, left: row.left, entitledUntil: row.entitledUntil, tiers };
}

const endpointFor = (origin: string | undefined): string =>
  `${origin?.replace(/\/+$/, '') ?? ''}/api/game`;

const telegramUserId = (raw: string): string | null => {
  try {
    const user = JSON.parse(new URLSearchParams(raw).get('user') ?? '') as { id?: unknown };
    return typeof user.id === 'number' || typeof user.id === 'string' ? String(user.id) : null;
  } catch {
    return null;
  }
};

async function request(
  endpoint: string,
  initData: string,
  chatId: string,
  action: 'read' | 'roll' | 'intention' | 'report' | 'invoice',
  fetcher: typeof fetch,
  text?: string,
  tier?: SharedTier['id'],
): Promise<SharedReply> {
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ initData, chatId, action, ...(text === undefined ? {} : { text }), ...(tier === undefined ? {} : { tier }) }),
  });
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  if (!response.ok) {
    throw new Error(typeof body?.error === 'string' ? body.error : `game server answered ${response.status}`);
  }
  const parsed = replyFrom(body);
  if (!parsed) throw new Error('the game server returned an unreadable table');
  return parsed;
}

/** Load only when the bot put a table id on the launch. */
export async function preloadSharedGame({
  href,
  initData,
  origin,
  fetcher = fetch,
}: {
  href: string;
  initData: string;
  origin?: string;
  fetcher?: typeof fetch;
}): Promise<SharedGame | null> {
  const chatId = new URL(href).searchParams.get('chat');
  if (!chatId) return null;
  const endpoint = endpointFor(origin);
  const userId = telegramUserId(initData);
  const linked: SharedGame = {
    chatId,
    initData,
    userId: userId ?? '',
    endpoint,
    snapshot: null,
    player: { intention: null, reports: [], access: { enabled: false, mayRoll: true, freeMoves: FREE_MOVES, movesUsed: 0, left: null, entitledUntil: null, tiers: [] } },
    error: null,
  };
  if (!initData || !userId) {
    return { ...linked, error: 'Open this board from the bot button again.' };
  }
  try {
    const loaded = await request(endpoint, initData, chatId, 'read', fetcher);
    return { ...linked, snapshot: loaded.snapshot, player: loaded.player };
  } catch (error) {
    return { ...linked, error: String(error instanceof Error ? error.message : error) };
  }
}

/** Refresh server-owned access after Telegram closes an invoice. */
export async function readSharedGame(game: SharedGame, fetcher: typeof fetch = fetch): Promise<SharedReply> {
  return request(game.endpoint, game.initData, game.chatId, 'read', fetcher);
}

/** Ask the authenticated bot backend for one Telegram Stars invoice URL. */
export async function invoiceSharedGame(game: SharedGame, tier: SharedTier['id'], fetcher: typeof fetch = fetch): Promise<SharedReply> {
  return request(game.endpoint, game.initData, game.chatId, 'invoice', fetcher, undefined, tier);
}

/** Ask the room to roll its deterministic die; never choose a value here. */
export async function rollSharedGame(
  game: SharedGame,
  fetcher: typeof fetch = fetch,
): Promise<SharedReply> {
  return request(game.endpoint, game.initData, game.chatId, 'roll', fetcher);
}

/** Change the same question `/intention` reads in chat. */
export async function setSharedIntention(
  game: SharedGame,
  text: string,
  fetcher: typeof fetch = fetch,
): Promise<SharedReply> {
  return request(game.endpoint, game.initData, game.chatId, 'intention', fetcher, text);
}

/** File through the same report gate and durable path as `/report`. */
export async function reportSharedGame(
  game: SharedGame,
  text: string,
  fetcher: typeof fetch = fetch,
): Promise<SharedReply> {
  return request(game.endpoint, game.initData, game.chatId, 'report', fetcher, text);
}

export const sharedSession = (snapshot: SharedSnapshot): Session => ({
  id: snapshot.chatId,
  players: snapshot.players,
  turnIndex: snapshot.turnIndex,
  rules: ruleSetById(snapshot.ruleset as Parameters<typeof ruleSetById>[0]),
  rollCount: snapshot.rollCount,
});

/** Turn animation data derived from the old state and the server's new one. */
export function sharedTurn(
  before: Session,
  reply: SharedReply,
): { turn: Thrown; threw: number } | null {
  if (!reply.move) return null;
  const session = sharedSession(reply.snapshot);
  const threw = before.players.findIndex(({ id }) => id === reply.move?.playerId);
  const previous = before.players[threw];
  const moved = session.players.find(({ id }) => id === reply.move?.playerId);
  if (!previous || !moved || threw < 0) throw new Error('the moved seat is not at this table');

  return {
    threw,
    turn: {
      roll: reply.move.roll,
      hops: hopsFor(previous.state, reply.move.roll, moved.state, reply.move.event),
      event: reply.move.event,
      session,
      seatId: reply.move.playerId,
      moved,
      rollsAgain: reply.move.keepsTurn,
      won: hasWon(moved.state),
      tableOver: isSessionOver(session),
    },
  };
}
