import { describe, expect, it } from 'vitest';
import { CLASSIC, advance, createSession } from '@leela/engine';
import {
  defaultTier,
  preloadSharedGame,
  reportSharedGame,
  replyFrom,
  setSharedIntention,
  sharedTurn,
  snapshotFrom,
  type SharedSnapshot,
} from '../src/shared';

const session = createSession('chat', [{ id: '7', name: 'Ada' }], CLASSIC);
const SNAPSHOT: SharedSnapshot = {
  chatId: 'chat',
  started: true,
  language: 'en',
  ruleset: CLASSIC.id,
  turnIndex: 0,
  rollCount: 0,
  rollsTaken: 0,
  lastThrower: null,
  players: session.players,
  rolls: [[]],
};
const PLAYER = {
  intention: 'What am I avoiding?',
  reports: [{ plan: 12, text: 'I see the old pattern.', at: 1_800_000_000_000 }],
  access: {
    enabled: true,
    mayRoll: true,
    freeMoves: 3,
    movesUsed: 2,
    left: 1,
    entitledUntil: null,
    tiers: [{ id: 'month' as const, stars: 150, days: 30 }],
  },
};

describe('a linked chat table', () => {
  it('preselects the shortest commitment like the mobile paywall', () => {
    expect(defaultTier([
      { id: 'year', stars: 1200, days: 365 },
      { id: 'month', stars: 150, days: 30 },
      { id: 'halfyear', stars: 700, days: 182 },
    ])?.id).toBe('month');
    expect(defaultTier([])).toBeNull();
  });
  it('does not turn an unauthenticated linked launch into a local game', async () => {
    const linked = await preloadSharedGame({
      href: 'https://t27.ai/leela/?chat=-1001',
      initData: '',
      origin: 'https://service.example',
      fetcher: (() => Promise.reject(new Error('must not fetch'))) as typeof fetch,
    });
    expect(linked).toMatchObject({ chatId: '-1001', snapshot: null });
    expect(linked?.error).toMatch(/bot button/i);
  });

  it('loads the table from the server and sends no state in the URL', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({
        snapshot: SNAPSHOT,
        move: null,
        replies: [],
        accepted: true,
        player: PLAYER,
        invoiceUrl: null,
      }));
    }) as typeof fetch;
    const initData = new URLSearchParams({ user: JSON.stringify({ id: 7 }) }).toString();

    const linked = await preloadSharedGame({
      href: 'https://t27.ai/leela/?chat=-1001',
      initData,
      origin: 'https://service.example/',
      fetcher,
    });

    expect(linked?.snapshot).toEqual(SNAPSHOT);
    expect(linked?.player).toEqual(PLAYER);
    expect(calls).toEqual([
      {
        url: 'https://service.example/api/game',
        body: { initData, chatId: '-1001', action: 'read' },
      },
    ]);
  });

  it('writes intention and reports through the authenticated table endpoint', async () => {
    const calls: unknown[] = [];
    const fetcher = (async (_input: string | URL | Request, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({
        snapshot: SNAPSHOT,
        move: null,
        replies: [],
        accepted: true,
        player: PLAYER,
        invoiceUrl: null,
      }));
    }) as typeof fetch;
    const game = {
      chatId: '-1001',
      initData: 'signed',
      userId: '7',
      endpoint: 'https://service.example/api/game',
      snapshot: SNAPSHOT,
      player: PLAYER,
      error: null,
    };

    await setSharedIntention(game, 'What am I avoiding?', fetcher);
    await reportSharedGame(game, 'I see the old pattern.', fetcher);

    expect(calls).toEqual([
      { initData: 'signed', chatId: '-1001', action: 'intention', text: 'What am I avoiding?' },
      { initData: 'signed', chatId: '-1001', action: 'report', text: 'I see the old pattern.' },
    ]);
  });

  it('refuses every malformed part of a snapshot and move', () => {
    expect(snapshotFrom({ ...SNAPSHOT, turnIndex: 1 })).toBeNull();
    expect(snapshotFrom({ ...SNAPSHOT, ruleset: 'invented' })).toBeNull();
    expect(snapshotFrom({ ...SNAPSHOT, rollsTaken: 1 })).toBeNull();
    expect(snapshotFrom({ ...SNAPSHOT, players: [{ ...session.players[0], state: { loka: 999 } }] })).toBeNull();
    expect(replyFrom({ snapshot: SNAPSHOT, move: { roll: 9 }, replies: [] })).toBeNull();
  });

  it('animates the exact move contained in the authoritative new session', () => {
    const moved = advance(session, 6, 1234);
    const snapshot: SharedSnapshot = {
      ...SNAPSHOT,
      rollCount: 1,
      rollsTaken: 1,
      lastThrower: 0,
      players: moved.session.players,
      rolls: [[6]],
    };
    const applied = sharedTurn(session, {
      snapshot,
      replies: [],
      accepted: true,
      player: PLAYER,
      invoiceUrl: null,
      move: {
        playerId: moved.playerId,
        roll: 6,
        event: moved.event,
        keepsTurn: moved.keepsTurn,
      },
    });

    expect(applied?.turn.session.players).toEqual(snapshot.players);
    expect(applied?.turn.event).toEqual(moved.event);
    expect(applied?.turn.hops.at(-1)?.to).toBe(moved.event.to);
  });
});
