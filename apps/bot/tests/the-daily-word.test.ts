import { describe, expect, it } from 'vitest';
import { CLASSIC } from '@leela/engine';
import type { GameState } from '@leela/engine';
import { messageFor, planFor, type Language } from '@leela/content';
import type { Room } from '../src/commands';
import { DirectChannels } from '../src/delivery';
import {
  createInitiative,
  excerptsOf,
  type DailyWordRecord,
  type NudgeApi,
  type TickSummary,
} from '../src/initiative';
import { MemoryNudgeStore, MemoryRoomStore } from '../src/store';

/**
 * The tick, end to end: a fake api, an injected schedule and a clock the test
 * owns, so a day passes in a line and no message reaches a network. What is
 * asserted is the whole loop — who was written to, who was skipped and why,
 * what the message carried, and what the one summary line said.
 */

const DAY = 24 * 60 * 60 * 1000;
/** The tick's moment: 06:00 UTC, the default hour. */
const MORNING = Date.UTC(2026, 7, 21, 6, 0, 0);

/** A player mid-game on a plan, active yesterday unless said otherwise. */
function standing(loka: number): GameState {
  return {
    loka,
    previous_loka: 5,
    direction: '',
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: false,
  };
}

/** Off the board, waiting for a six — the engine's own starting shape. */
function waiting(): GameState {
  return {
    loka: 68,
    previous_loka: 0,
    direction: '',
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: true,
  };
}

/** Arrived on 68 from 66: `hasWon` is true and the game is over. */
function won(): GameState {
  return {
    loka: 68,
    previous_loka: 66,
    direction: '',
    consecutive_sixes: 0,
    position_before_three_sixes: 0,
    is_finished: true,
  };
}

interface Seated {
  id: string;
  state: GameState;
  lastRollAt?: number | null;
  lastReportAt?: number | null;
}

/**
 * A table built as data rather than played: the initiative reads seats, and a
 * seat is five fields. Played-through rooms are `commands.test.ts`'s subject.
 */
function tableOf(chatId: string, players: Seated[], language: Language = 'en'): Room {
  return {
    chatId,
    session: {
      id: chatId,
      players: players.map((player) => ({
        id: player.id,
        name: player.id,
        state: player.state,
        lastRollAt: player.lastRollAt === undefined ? MORNING - DAY : player.lastRollAt,
        lastReportAt: player.lastReportAt ?? null,
        reportSubmitted: true,
      })),
      turnIndex: 0,
      rules: CLASSIC,
      rollCount: 0,
    },
    seed: 1,
    rollsTaken: 0,
    language,
    started: true,
    names: {},
  };
}

interface Sent {
  chatId: string;
  text: string;
  withKeyboard: boolean;
}

/** The api, remembering everything and refusing whom it is told to refuse. */
function fakeApi({
  blocked = new Set<string>(),
  keyboardRefused = new Set<string>(),
}: { blocked?: Set<string>; keyboardRefused?: Set<string> } = {}) {
  const sent: Sent[] = [];

  const api: NudgeApi = {
    async sendMessage(chatId, text, other) {
      if (blocked.has(chatId)) {
        // The shape Telegram answers a stranger's chat with.
        throw { error_code: 403, description: 'Forbidden: bot was blocked by the user' };
      }
      if (keyboardRefused.has(chatId) && other?.reply_markup) {
        throw new Error('Call to sendMessage failed! (400: BUTTON_TYPE_INVALID)');
      }
      sent.push({ chatId, text, withKeyboard: Boolean(other?.reply_markup) });
      return {};
    },
  };

  return { api, sent };
}

interface HarnessOptions {
  rooms: Room[];
  /** Where the tick's summary is kept, when a test is asking about that. */
  remember?: (at: number, summary: TickSummary) => Promise<void>;
  /** The previous durable word, read before a new cohort replaces it. */
  previous?: () => DailyWordRecord | null;
  blocked?: Set<string>;
  keyboardRefused?: Set<string>;
  hour?: number;
  nudges?: MemoryNudgeStore;
  now?: () => number;
}

async function harness({
  rooms,
  blocked,
  keyboardRefused,
  hour,
  nudges: memory,
  remember,
  previous,
  now = () => MORNING,
}: HarnessOptions) {
  const store = new MemoryRoomStore();
  for (const room of rooms) await store.save(room);

  const { api, sent } = fakeApi({ blocked, keyboardRefused });
  const nudges = memory ?? new MemoryNudgeStore();
  const channels = new DirectChannels();
  const said: string[] = [];
  const armed: Array<{ run: () => void; inMs: number }> = [];
  let cancelled = 0;

  const initiative = createInitiative({
    api,
    store,
    nudges,
    channels,
    launchUrl: 'https://t27.ai/leela/',
    hour,
    remember,
    previous,
    now,
    schedule: (run, inMs) => {
      armed.push({ run, inMs });
      return () => {
        cancelled += 1;
      };
    },
    log: (message) => said.push(message),
  });

  return {
    initiative,
    // Returned so a test can move a player mid-run: the doorstep arm's last
    // case is somebody who throws their six between two mornings, and the
    // room they sit in has to change for that to be tested at all.
    store,
    sent,
    nudges,
    channels,
    said,
    armed,
    cancelledCount: () => cancelled,
    summaryLines: () => said.filter((line) => line.startsWith('[initiative] sent')),
  };
}

describe('one tick, one morning', () => {
  it('says the previous word conversions before a new cohort replaces them', async () => {
    const table = await harness({
      rooms: [],
      previous: () => ({
        at: MORNING - DAY,
        sent: 2,
        bridges: { model: 1, canonical: 1 },
        conversions: { responses: 1, rolls: 1 },
        skipped: {},
      }),
    });

    await table.initiative.runTick(MORNING);

    expect(table.said[0]).toContain(
      'conversions: responses 1, rolls 1; skipped: none.',
    );
  });

  it('does not describe a cohort whose conversion window is still open', async () => {
    let remembered = 0;
    const table = await harness({
      rooms: [tableOf('chat-1', [{ id: 'u1', state: standing(12) }])],
      previous: () => ({
        at: MORNING - 1,
        sent: 1,
        conversions: { responses: 0, rolls: 0 },
        skipped: {},
      }),
      remember: async () => {
        remembered += 1;
      },
    });

    await table.initiative.runTick(MORNING);

    expect(table.said.some((line) => line.includes('Last daily word:'))).toBe(false);
    expect(table.sent).toEqual([]);
    expect(remembered).toBe(0);
  });

  it('keeps delivering when the previous conversion summary cannot be read', async () => {
    const table = await harness({
      rooms: [tableOf('chat-1', [{ id: 'u1', state: standing(12) }])],
      previous: () => {
        throw new Error('database read failed');
      },
    });

    await expect(table.initiative.runTick(MORNING)).resolves.toMatchObject({ sent: 1 });
    expect(table.sent).toHaveLength(1);
    expect(table.said[0]).toBe(
      '[initiative] could not read previous conversions: Error: database read failed',
    );
  });

  it('writes to the eligible player: the excerpt, where they stand, the way back and the way out', async () => {
    const table = await harness({ rooms: [tableOf('chat-1', [{ id: 'u1', state: standing(12) }])] });
    const summary = await table.initiative.runTick(MORNING);

    expect(summary).toEqual({ sent: 1, bridges: { model: 0, canonical: 1 }, skipped: {} });
    expect(table.sent).toHaveLength(1);

    const word = table.sent[0];
    expect(word.chatId).toBe('u1');
    // The CTA is the reply-keyboard launch — the only markup whose mini app
    // can answer back, and legal here because every send is private.
    expect(word.withKeyboard).toBe(true);
    expect(word.text).toContain(excerptsOf(planFor('en', 12).body)[0]);
    expect(word.text).toContain('You are standing on 12');
    expect(word.text).toContain('/roll');
    // The first message ever sent ends with the way out.
    expect(word.text.trim().endsWith('/quiet stops it whenever you wish.')).toBe(true);

    expect(await table.nudges.of('u1')).toEqual({
      sentAt: MORNING,
      excerpt: 0,
      quieted: false,
      doorsteps: 0,
    });
  });

  it('skips every sleeping kind, each under its own name in the one summary line', async () => {
    const table = await harness({
      rooms: [
        tableOf('chat-1', [
          { id: 'u-standing', state: standing(12) },
          { id: 'u-waiting', state: waiting(), lastRollAt: null },
          { id: 'u-won', state: won() },
          { id: 'u-lapsed', state: standing(9), lastRollAt: MORNING - 15 * DAY },
          { id: 'u-quiet', state: standing(30) },
          { id: 'u-closed', state: standing(41) },
        ]),
      ],
    });
    await table.nudges.setQuieted('u-quiet', true);
    table.channels.refuse('u-closed');
    // The waiting player is here to be skipped, so their three doorstep words
    // are spent first — through the real path, three recorded sends on days
    // that are not this one, rather than a counter set by hand.
    for (const day of [9, 8, 7]) {
      await table.nudges.record('u-waiting', {
        at: MORNING - day * DAY,
        excerpt: 0,
        doorstep: true,
      });
    }

    const summary = await table.initiative.runTick(MORNING);

    expect(summary.sent).toBe(1);
    expect(summary.skipped).toEqual({
      'doorstep-spent': 1,
      finished: 1,
      lapsed: 1,
      quieted: 1,
      'no-channel': 1,
    });
    expect(table.sent.map((word) => word.chatId)).toEqual(['u-standing']);

    // One line, not a scroll, and every reason is in it with its count.
    const lines = table.summaryLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('sent 1');
    for (const reason of [
      'doorstep-spent 1',
      'finished 1',
      'lapsed 1',
      'quieted 1',
      'no-channel 1',
    ]) {
      expect(lines[0]).toContain(reason);
    }
  });

  it('knocks three times on a player who never entered, and then not again', async () => {
    const table = await harness({
      rooms: [tableOf('chat-1', [{ id: 'u-waiting', state: waiting(), lastRollAt: null }])],
    });

    const days = [0, 1, 2, 3, 4].map((day) => MORNING + day * DAY);
    const summaries = [];
    for (const at of days) summaries.push(await table.initiative.runTick(at));

    expect(summaries.map((one) => one.sent)).toEqual([1, 1, 1, 0, 0]);
    expect(summaries.slice(3).map((one) => one.skipped)).toEqual([
      { 'doorstep-spent': 1 },
      { 'doorstep-spent': 1 },
    ]);

    // Three words, and the first of them carried the way out.
    expect(table.sent).toHaveLength(3);
    expect(table.sent[0].text).toContain('/quiet');
    expect(table.sent[1].text).not.toContain('/quiet');
    for (const word of table.sent) {
      expect(word.text).toContain(messageFor('en', 'nudge.doorstep'));
      expect(word.text).not.toContain('standing on');
    }
    expect(await table.nudges.of('u-waiting')).toMatchObject({ doorsteps: 3 });
  });

  it('stops the doorstep word the morning after the six falls', async () => {
    const table = await harness({
      rooms: [tableOf('chat-1', [{ id: 'u-waiting', state: waiting(), lastRollAt: null }])],
    });

    await table.initiative.runTick(MORNING);
    await table.initiative.runTick(MORNING + DAY);

    // The six falls: the player enters and stands on a plan.
    await table.store.save(
      tableOf('chat-1', [
        { id: 'u-waiting', state: standing(6), lastRollAt: MORNING + DAY + 60_000 },
      ]),
    );

    const summary = await table.initiative.runTick(MORNING + 2 * DAY);

    expect(summary).toEqual({ sent: 1, bridges: { model: 0, canonical: 1 }, skipped: {} });
    expect(table.sent[2].text).toContain('You are standing on 6');
    // The allowance stopped where it stopped: two spent, and the third is not
    // owed to somebody who is playing.
    expect(await table.nudges.of('u-waiting')).toMatchObject({ doorsteps: 2 });
  });

  it('hands the tick to whoever is keeping it, exactly once', async () => {
    // The line the tick logs is read by whoever is watching; this is read by
    // whoever is not, which has been everybody. specs/008.
    const kept: Array<{ at: number; sent: number; skipped: Record<string, number> }> = [];
    const table = await harness({
      rooms: [tableOf('chat-1', [{ id: 'u-waiting', state: waiting(), lastRollAt: null }])],
      remember: async (at, summary) => {
        kept.push({ at, sent: summary.sent, skipped: { ...summary.skipped } });
      },
    });

    await table.initiative.runTick(MORNING);

    expect(kept).toEqual([{ at: MORNING, sent: 1, skipped: {} }]);
  });

  it('runs the tick anyway when nothing is keeping it', async () => {
    // The daily word is the product; the record is a note about it. A
    // deployment with nowhere to write must still write to the player.
    const table = await harness({
      rooms: [tableOf('chat-1', [{ id: 'u-waiting', state: waiting(), lastRollAt: null }])],
    });

    expect(await table.initiative.runTick(MORNING)).toEqual({
      sent: 1,
      bridges: { model: 0, canonical: 0 },
      skipped: {},
    });
  });

  it('says when the next word is due, at the moment it arms', async () => {
    // The sentence is tested where it is built; this is the other half — that
    // it is actually said. Commenting the log call out passed every test in
    // this repository until this one existed, which is the same shape as a
    // report that governs nothing.
    const table = await harness({ rooms: [] });

    table.initiative.start();

    expect(table.said.some((line) => line.startsWith('The daily word is armed: next at'))).toBe(
      true,
    );
  });

  it('says it again after a tick, so a log carries the next morning too', async () => {
    const table = await harness({ rooms: [] });

    table.initiative.start();
    const armedOnce = table.said.filter((line) => line.startsWith('The daily word is armed')).length;
    // The chain re-arms in the tick's `finally`; the harness's schedule hands
    // the run back, so firing it is how a second morning is reached.
    table.armed[0]?.run();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      table.said.filter((line) => line.startsWith('The daily word is armed')).length,
    ).toBeGreaterThan(armedOnce);
  });

  it('retries for the remaining open-window time instead of losing a day to timer jitter', async () => {
    let at = MORNING - 1_000;
    const kept: number[] = [];
    const table = await harness({
      rooms: [tableOf('chat-1', [{ id: 'u1', state: standing(12) }])],
      now: () => at,
      previous: () => ({
        at: MORNING - DAY + 1,
        sent: 1,
        skipped: {},
      }),
      remember: async (when) => {
        kept.push(when);
      },
    });

    table.initiative.start();
    expect(table.armed[0]?.inMs).toBe(1_000);

    at = MORNING;
    table.armed[0]?.run();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(table.sent).toEqual([]);
    expect(kept).toEqual([]);
    expect(table.armed[1]?.inMs).toBe(1);

    at = MORNING + 1;
    table.armed[1]?.run();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(table.sent).toHaveLength(1);
    expect(kept).toEqual([MORNING + 1]);
  });

  it('says the summary even when there was nobody to write to', async () => {
    const table = await harness({ rooms: [] });
    await table.initiative.runTick(MORNING);
    expect(table.summaryLines()).toEqual(['[initiative] sent 0; skipped: none']);
  });
});

describe('one message a day', () => {
  it('knocks once: a tick re-run within the day is silent, and the next day speaks', async () => {
    const table = await harness({ rooms: [tableOf('chat-1', [{ id: 'u1', state: standing(12) }])] });

    await table.initiative.runTick(MORNING);
    const again = await table.initiative.runTick(MORNING + 2 * 60 * 60 * 1000);
    expect(again).toEqual({
      sent: 0,
      bridges: { model: 0, canonical: 0 },
      skipped: { 'nudged-today': 1 },
    });
    expect(table.sent).toHaveLength(1);

    const tomorrow = await table.initiative.runTick(MORNING + DAY);
    expect(tomorrow.sent).toBe(1);
    expect(table.sent).toHaveLength(2);
  });

  it('rotates the excerpt across days and drops the way-out sentence after the first', async () => {
    const table = await harness({
      rooms: [tableOf('chat-1', [{ id: 'u1', state: standing(12), lastRollAt: MORNING - 60_000 }])],
    });

    await table.initiative.runTick(MORNING);
    await table.initiative.runTick(MORNING + DAY);

    const [first, second] = table.sent;
    // Plan 12's text runs past one excerpt, so the second morning must not
    // repeat the first — Duolingo's recency penalty, measured on the wire.
    expect(excerptsOf(planFor('en', 12).body).length).toBeGreaterThan(1);
    expect(second.text).not.toBe(first.text);
    expect((await table.nudges.of('u1')).excerpt).toBe(1);
    // The opt-out sentence belongs to the first message alone.
    expect(first.text).toContain('/quiet');
    expect(second.text).not.toContain('/quiet');
  });
});

describe('the channel', () => {
  it('refuses the channel on a blocked send and does not count the day spent', async () => {
    const table = await harness({
      rooms: [tableOf('chat-1', [{ id: 'u1', state: standing(12) }])],
      blocked: new Set(['u1']),
    });

    const summary = await table.initiative.runTick(MORNING);
    expect(summary).toEqual({
      sent: 0,
      bridges: { model: 0, canonical: 0 },
      skipped: { blocked: 1 },
    });
    // Remembered where every other refusal is remembered, so tomorrow costs
    // nothing rather than another failed call.
    expect(table.channels.canWrite('u1')).toBe(false);
    expect((await table.nudges.of('u1')).sentAt).toBeNull();

    const tomorrow = await table.initiative.runTick(MORNING + DAY);
    expect(tomorrow.skipped).toEqual({ 'no-channel': 1 });
  });

  it('does not lose the word over its keyboard: the retry goes out without one', async () => {
    const table = await harness({
      rooms: [tableOf('chat-1', [{ id: 'u1', state: standing(12) }])],
      keyboardRefused: new Set(['u1']),
    });

    const summary = await table.initiative.runTick(MORNING);
    expect(summary.sent).toBe(1);
    expect(table.sent).toHaveLength(1);
    expect(table.sent[0].withKeyboard).toBe(false);
    // The CTA line names /roll, so the way back survives the keyboard not going.
    expect(table.sent[0].text).toContain('/roll');
  });
});

describe('a player at two tables', () => {
  it('hears one knock, from the table last played and in its language', async () => {
    const earlier = tableOf('chat-en', [{ id: 'u1', state: standing(5) }], 'en');
    const later = tableOf('chat-ru', [{ id: 'u1', state: standing(9) }], 'ru');
    const table = await harness({ rooms: [earlier, later] });

    const summary = await table.initiative.runTick(MORNING);
    expect(summary.sent).toBe(1);
    expect(table.sent).toHaveLength(1);
    expect(table.sent[0].text).toContain('Вы стоите на плане 9');
  });
});

describe('the schedule', () => {
  it('arms one timer at the next strike of the hour, and the tick arms the next', async () => {
    const table = await harness({ rooms: [], hour: 7 });

    table.initiative.start();
    expect(table.armed).toHaveLength(1);
    // 06:00 now, hour seven: one hour away.
    expect(table.armed[0].inMs).toBe(60 * 60 * 1000);

    // A second start must not become a second morning.
    table.initiative.start();
    expect(table.armed).toHaveLength(1);

    table.armed[0].run();
    // The tick is async; let it finish before asking what it armed.
    await new Promise((resolve) => setImmediate(resolve));
    expect(table.armed).toHaveLength(2);
    expect(table.summaryLines()).toHaveLength(1);
  });

  it('stops cleanly: the pending timer is cancelled and nothing re-arms', async () => {
    const table = await harness({ rooms: [] });

    table.initiative.start();
    table.initiative.stop();
    expect(table.cancelledCount()).toBe(1);

    // A stop that raced the tick still wins: the finished tick must not re-arm.
    table.armed[0].run();
    await new Promise((resolve) => setImmediate(resolve));
    expect(table.armed).toHaveLength(1);
  });

  it('says the tick failed when its memory throws, and still comes back tomorrow', async () => {
    // The injected `nudges` store is a promise the type holds nobody to. A
    // memory that throws must not kill the chain silently: the failure is one
    // line an operator reads, and the next morning is still armed — the
    // initiative outlives one broken day.
    const broken = new MemoryNudgeStore();
    broken.of = async () => {
      throw new Error('the disk is gone');
    };
    const table = await harness({
      rooms: [tableOf('chat-1', [{ id: 'u1', state: standing(12) }])],
      nudges: broken,
    });

    table.initiative.start();
    table.armed[0].run();
    await new Promise((resolve) => setImmediate(resolve));

    expect(table.said.join('\n')).toContain('[initiative] the tick failed');
    expect(table.sent).toHaveLength(0);
    expect(table.armed).toHaveLength(2);
  });
});
