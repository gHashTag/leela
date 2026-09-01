import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CLASSIC } from '@leela/engine';
import type { GameState } from '@leela/engine';

import type { Room } from '../src/commands';
import { DirectChannels } from '../src/delivery';
import { createInitiative, lastWordSaid, type NudgeApi } from '../src/initiative';
import { openStorage, remembering } from '../src/storage';

/**
 * A real write meeting a real read.
 *
 * Three tests already held the three pieces: `recordTick` round-trips through
 * SQLite, the tick calls whatever `remember` it was given, and `lastWordSaid`
 * renders a record. **Nothing joined them.** The wiring between was three
 * lines inline in `index.ts` — a top-level module no test can import without
 * starting a bot — so an argument in the wrong order would have passed every
 * one of those tests and printed a banner that quietly said the wrong thing.
 *
 * This runs the whole path the way production does: open the real storage,
 * hand `remembering(storage)` to a real initiative, tick it at a known
 * moment, close the database, reopen it as a restart would, and read the
 * sentence the banner prints. The point is the joints, so nothing here is a
 * fake except the Telegram api, which would otherwise send a message.
 */

const dir = mkdtempSync(join(tmpdir(), 'leela-tick-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** 2026-08-24, 06:00 UTC — the hour the daily word actually goes out. */
const MORNING = Date.UTC(2026, 7, 24, 6, 0, 0);

/** Off the board, waiting for a six: the player the doorstep word is for. */
const waiting = (): GameState => ({
  loka: 68,
  previous_loka: 0,
  direction: '',
  consecutive_sixes: 0,
  position_before_three_sixes: 0,
  is_finished: true,
});

const tableOf = (chatId: string, players: Array<{ id: string; state: GameState }>): Room => ({
  chatId,
  session: {
    id: chatId,
    players: players.map((player) => ({
      id: player.id,
      name: player.id,
      state: player.state,
      lastRollAt: null,
      lastReportAt: null,
      reportSubmitted: true,
    })),
    turnIndex: 0,
    rules: CLASSIC,
    rollCount: 0,
  },
  seed: 1,
  rollsTaken: 0,
  language: 'en',
  started: true,
  names: {},
});

describe('the tick reaches the banner, through a real database and a restart', () => {
  it('writes what it sent, and the next boot says it', async () => {
    const path = join(dir, 'reaches.db');

    const first = openStorage({ path, log: () => {} });
    expect(first.durable, 'the point of this test is the durable path').toBe(true);
    await first.store.save(tableOf('chat-1', [{ id: 'u-waiting', state: waiting() }]));

    const sent: string[] = [];
    const api: NudgeApi = {
      async sendMessage(chatId) {
        sent.push(chatId);
        return {};
      },
    };

    const initiative = createInitiative({
      api,
      store: first.store,
      nudges: first.nudges,
      channels: new DirectChannels(),
      launchUrl: 'https://t27.ai/leela/',
      now: () => MORNING,
      log: () => {},
      // The same adapter `index.ts` hands it, from the same place.
      remember: remembering(first),
    });

    const summary = await initiative.runTick(MORNING);
    expect(summary.sent, 'a waiting player gets the doorstep word').toBe(1);
    expect(sent).toEqual(['u-waiting']);

    first.stopPruning?.();

    // The restart. Nothing carries over but the file.
    const second = openStorage({ path, log: () => {} });
    const said = lastWordSaid(second.lastTick?.() ?? null);
    second.stopPruning?.();

    expect(said).toBe(
      'Last daily word: 2026-08-24 06:00 UTC — sent 1; ' +
        'bridges: model 0, canonical 0; conversions: responses 0, rolls 0; skipped: none.',
    );
  });

  it('carries the skip reasons across the restart, not only the count', async () => {
    const path = join(dir, 'reasons.db');

    const first = openStorage({ path, log: () => {} });
    await first.store.save(tableOf('chat-2', [{ id: 'u-quiet', state: waiting() }]));
    await first.nudges.setQuieted('u-quiet', true);

    const initiative = createInitiative({
      api: { async sendMessage() { return {}; } },
      store: first.store,
      nudges: first.nudges,
      channels: new DirectChannels(),
      launchUrl: 'https://t27.ai/leela/',
      now: () => MORNING,
      log: () => {},
      remember: remembering(first),
    });

    await initiative.runTick(MORNING);
    first.stopPruning?.();

    const second = openStorage({ path, log: () => {} });
    const said = lastWordSaid(second.lastTick?.() ?? null);
    second.stopPruning?.();

    // The reason is the whole value of the record: "sent 0" alone would leave
    // an operator unable to tell a quieted player from a broken engine.
    expect(said).toContain(
      'sent 0; bridges: model 0, canonical 0; conversions: responses 0, rolls 0; skipped: quieted 1.',
    );
  });

  it('gives the initiative nothing to remember when nothing is durable', () => {
    // A deployment holding its games in memory forgets the tick when it
    // forgets them, and a banner sentence the next restart makes a lie is
    // worse than none.
    const held = openStorage({ path: undefined, log: () => {} });

    expect(held.durable).toBe(false);
    expect(remembering(held)).toBeUndefined();
    expect(lastWordSaid(held.lastTick?.() ?? null)).toBe(
      'Last daily word: none yet on this database.',
    );
  });
});
