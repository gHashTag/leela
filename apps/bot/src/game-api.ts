/**
 * The chat table as an authenticated Telegram Mini App endpoint.
 *
 * The browser is a renderer and a control. The room in `RoomStore` remains the
 * record: reads are snapshots of it and throws go through the same
 * `commands.roll` function as `/roll` before the updated room is saved.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  type MoveEvent,
  type Session,
} from '@leela/engine';
import { asIntention } from '@leela/journal';
import { messageFor } from '@leela/content';
import * as commands from './commands';
import { accessFor, type PlayerAccess } from './access';
import { roomHistory } from './room-history';
import { invoiceFor, type PricedTier } from './stars';
import { MemoryEntitlementStore, type EntitlementStore, type ReportSink, type RoomStore, type StepSink } from './store';

export const GAME_PATH = '/api/game';
export const INIT_DATA_MAX_AGE_MS = 60 * 60 * 1000;
const FUTURE_SKEW_MS = 30 * 1000;
const MAX_INIT_DATA_BYTES = 16 * 1024;

export interface TelegramPlayer {
  id: string;
  name: string;
}

/** Validate Telegram's signed query string and return the player it names. */
export function playerFromInitData(
  raw: string,
  botToken: string,
  now: number = Date.now(),
): TelegramPlayer | null {
  if (!raw || !botToken || Buffer.byteLength(raw, 'utf8') > MAX_INIT_DATA_BYTES) return null;

  const data = new URLSearchParams(raw);
  const writtenHash = data.get('hash');
  if (!writtenHash || !/^[0-9a-f]{64}$/i.test(writtenHash)) return null;

  // `signature` is Telegram's third-party Ed25519 proof. It is not part of the
  // bot-token HMAC data-check-string, just as `hash` itself is not.
  const check = [...data.entries()]
    .filter(([key]) => key !== 'hash' && key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = createHmac('sha256', secret).update(check).digest();
  const supplied = Buffer.from(writtenHash, 'hex');
  if (supplied.length !== calculated.length || !timingSafeEqual(supplied, calculated)) return null;

  const authSeconds = Number(data.get('auth_date'));
  if (!Number.isInteger(authSeconds)) return null;
  const age = now - authSeconds * 1000;
  if (age < -FUTURE_SKEW_MS || age > INIT_DATA_MAX_AGE_MS) return null;

  try {
    const user = JSON.parse(data.get('user') ?? '') as {
      id?: unknown;
      first_name?: unknown;
      last_name?: unknown;
      username?: unknown;
    };
    if ((typeof user.id !== 'number' && typeof user.id !== 'string') || String(user.id) === '') {
      return null;
    }
    const name = [user.first_name, user.last_name]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join(' ') || (typeof user.username === 'string' ? user.username : String(user.id));
    return { id: String(user.id), name };
  } catch {
    return null;
  }
}

export interface GameSnapshot {
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

/**
 * Rebuild the readable per-seat dice history from the room's seed and count.
 * The stored session is still authoritative; this replay is display data.
 */
export function snapshotOf(room: commands.Room): GameSnapshot {
  const { rolls, lastThrower } = roomHistory(room);

  return {
    chatId: room.chatId,
    started: room.started,
    language: room.language,
    ruleset: room.session.rules.id,
    turnIndex: room.session.turnIndex,
    rollCount: room.session.rollCount,
    rollsTaken: room.rollsTaken,
    lastThrower,
    players: room.session.players,
    rolls,
  };
}

export interface GameMove {
  playerId: string;
  roll: number;
  event: MoveEvent;
  keepsTurn: boolean;
}

export interface GameReply {
  snapshot: GameSnapshot;
  move: GameMove | null;
  replies: string[];
  accepted: boolean;
  player: GamePlayerContext;
  invoiceUrl: string | null;
}

export interface GamePlayerContext {
  intention: string | null;
  reports: Array<{ plan: number; text: string; at: number }>;
  access: PlayerAccess;
}

export interface GameRouteOptions {
  botToken: string;
  store: RoomStore;
  reports: ReportSink;
  entitlements?: EntitlementStore;
  stars?: readonly PricedTier[] | null;
  createInvoiceLink?: (invoice: ReturnType<typeof invoiceFor>) => Promise<string>;
  steps?: StepSink;
  now?: () => number;
  allowedOrigins: readonly string[];
  broadcast?: (chatId: string, text: string, html: boolean) => Promise<void>;
  log?: (line: string, error?: unknown) => void;
}

export type GameRoute = (request: Request) => Promise<Response>;

/** Build the authenticated endpoint without opening a socket. */
export function gameRoute({
  botToken,
  store,
  reports,
  entitlements = new MemoryEntitlementStore(),
  stars = null,
  createInvoiceLink,
  steps,
  now = Date.now,
  allowedOrigins,
  broadcast = async () => undefined,
  log = console.error,
}: GameRouteOptions): GameRoute {
  // One write at a time per table. Two HTTP requests can arrive together even
  // though Telegram messages are normally processed in order.
  const tails = new Map<string, Promise<void>>();

  const locked = async <T>(chatId: string, run: () => Promise<T>): Promise<T> => {
    const before = tails.get(chatId) ?? Promise.resolve();
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = before.then(() => held);
    tails.set(chatId, tail);
    await before;
    try {
      return await run();
    } finally {
      release();
      if (tails.get(chatId) === tail) tails.delete(chatId);
    }
  };

  const contextOf = async (room: commands.Room, userId: string): Promise<GamePlayerContext> => ({
    intention: reports.intention ? await reports.intention(userId) : null,
    reports: reports.history
      ? (await reports.history(userId)).map(({ plan, text, createdAt }) => ({
          plan,
          text,
          at: createdAt.getTime(),
        }))
      : [],
    access: await accessFor(room, userId, entitlements, stars, now()),
  });

  return async (request) => {
    const origin = request.headers.get('origin') ?? '';
    const allowed = allowedOrigins.includes(origin);
    const cors: Record<string, string> = allowed
      ? {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
        }
      : {};
    const json = (body: unknown, status = 200): Response =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...cors },
      });
    const refuse = (status: number, error: string): Response => json({ error }, status);

    if (new URL(request.url).pathname !== GAME_PATH) return refuse(404, 'no such route');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!allowed) return refuse(403, origin ? `${origin} may not play here` : 'an origin is required');
    if (request.method !== 'POST') return refuse(405, 'POST only');

    const body = (await request.json().catch(() => null)) as {
      initData?: unknown;
      chatId?: unknown;
      action?: unknown;
      text?: unknown;
      tier?: unknown;
    } | null;
    if (!body || typeof body.initData !== 'string' || typeof body.chatId !== 'string') {
      return refuse(400, 'the body must carry initData and chatId');
    }
    if (!['read', 'roll', 'intention', 'report', 'invoice'].includes(String(body.action))) {
      return refuse(400, 'action must be read, roll, intention, report, or invoice');
    }

    const player = playerFromInitData(body.initData, botToken, now());
    if (!player) return refuse(401, 'Telegram launch data is invalid or expired');

    const act = async (): Promise<Response> => {
      const room = await store.get(body.chatId as string);
      if (!room) return refuse(404, 'this chat has no table');
      if (!room.session.players.some(({ id }) => id === player.id)) {
        return refuse(403, 'this player is not seated at that table');
      }

      if (body.action === 'read') {
        return json({
          snapshot: snapshotOf(room),
          move: null,
          replies: [],
          accepted: true,
          player: await contextOf(room, player.id),
          invoiceUrl: null,
        } satisfies GameReply);
      }

      if (body.action === 'invoice') {
        if (!stars || !createInvoiceLink || typeof body.tier !== 'string') {
          return refuse(409, 'this deployment has no payable Stars offer');
        }
        let invoice: ReturnType<typeof invoiceFor>;
        try {
          invoice = invoiceFor(room.language, stars, body.tier);
        } catch {
          return refuse(400, 'that Stars tier is not offered');
        }
        try {
          const invoiceUrl = await createInvoiceLink(invoice);
          return json({
            snapshot: snapshotOf(room), move: null, replies: [], accepted: true,
            player: await contextOf(room, player.id), invoiceUrl,
          } satisfies GameReply);
        } catch (error) {
          log('[game-api] failed to create a Stars invoice', error);
          return refuse(503, 'Telegram could not create the invoice');
        }
      }

      if (body.action === 'intention') {
        if (!reports.setIntention || typeof body.text !== 'string') {
          return refuse(400, 'this game cannot keep that intention');
        }
        const intention = asIntention(body.text);
        if (intention === null) return refuse(400, 'the intention is empty or too long');
        await reports.setIntention(player.id, intention);
        return json({
          snapshot: snapshotOf(room),
          move: null,
          replies: [],
          accepted: true,
          player: await contextOf(room, player.id),
          invoiceUrl: null,
        } satisfies GameReply);
      }

      if (body.action === 'report') {
        if (typeof body.text !== 'string') return refuse(400, 'the report text is required');
        const result = commands.report(room, player.id, body.text, now());
        const next = result.room ?? room;
        const effect = result.effects?.find(
          (candidate): candidate is Extract<commands.Effect, { kind: 'report' }> =>
            candidate.kind === 'report',
        );
        if (effect && result.room) {
          try {
            await store.save(result.room);
            await reports.record({
              userId: effect.userId,
              plan: effect.plan,
              text: effect.text,
            });
          } catch (error) {
            log('[game-api] failed to save a mini-app report', error);
            return refuse(503, 'the report was not saved');
          }
        }
        return json({
          snapshot: snapshotOf(next),
          move: null,
          replies: result.replies.map(({ text }) => text),
          accepted: effect !== undefined,
          player: await contextOf(next, player.id),
          invoiceUrl: null,
        } satisfies GameReply);
      }

      const asked = reports.intention
        ? { intention: (await reports.intention(player.id)) ?? '' }
        : undefined;
      const attempted = commands.roll(room, player.id, now(), asked);
      const attemptedMove = attempted.effects?.some(({ kind }) => kind === 'move') ?? false;
      const access = attemptedMove
        ? await accessFor(room, player.id, entitlements, stars, now())
        : null;
      const result: commands.CommandResult = attemptedMove && access && !access.mayRoll
        ? {
            room,
            replies: [{ text: messageFor(room.language, 'pro.required'), broadcast: false }],
          }
        : attempted;
      const next = result.room ?? room;
      const effect = result.effects?.find(
        (candidate): candidate is Extract<commands.Effect, { kind: 'move' }> =>
          candidate.kind === 'move',
      );

      if (effect && result.room) {
        try {
          await store.save(result.room);
        } catch (error) {
          log('[game-api] failed to save a mini-app throw', error);
          return refuse(503, 'the throw was not saved; nothing moved');
        }

        try {
          await steps?.record({
            userId: effect.userId,
            event: effect.event,
            ruleset: effect.ruleset,
          });
        } catch (error) {
          // The room is already the record. This is the same non-fatal move-log
          // policy as the Telegram transport's `applyEffects`.
          log('[game-api] failed to record a mini-app throw', error);
        }

        for (const reply of result.replies.filter(({ broadcast: publicReply }) => publicReply)) {
          try {
            await broadcast(room.chatId, reply.text, reply.html === true);
          } catch (error) {
            // The saved board must not be rolled back because Telegram could
            // not announce it. Loud, and the next `/board` reads the truth.
            log('[game-api] failed to announce a mini-app throw', error);
          }
        }
      }

      const move: GameMove | null = effect
        ? {
            playerId: effect.userId,
            roll: effect.event.roll,
            event: effect.event,
            keepsTurn:
              effect.event.grantsExtraTurn &&
              next.session.players[next.session.turnIndex]?.id === effect.userId,
          }
        : null;
      return json({
        snapshot: snapshotOf(next),
        move,
        replies: result.replies.map(({ text }) => text),
        accepted: effect !== undefined,
        player: await contextOf(next, player.id),
        invoiceUrl: null,
      } satisfies GameReply);
    };

    return body.action === 'read' ? act() : locked(body.chatId, act);
  };
}
