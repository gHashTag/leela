import { describe, expect, it } from 'vitest';
import { messageFor, planFor, type Plan } from '@leela/content';
import {
  FRESH_START_UNTIL_MS,
  DEFAULT_NUDGE_HOUR,
  EXCERPT_CHARS,
  LAPSED_AFTER_MS,
  compose,
  eligible,
  excerptsOf,
  msUntilHour,
  nextExcerpt,
  nudgeHour,
  type Candidate,
} from '../src/initiative';
import { MemoryNudgeStore, NEVER_NUDGED } from '../src/store';

/**
 * The daily word's pure core: the sleeping condition, the excerpts and the
 * message. Every branch is its own test because the failure mode of a nudge
 * engine is silent in both directions — a player written to who should have
 * been left alone, and a player left alone who was waiting to be called back.
 */

const DAY = 24 * 60 * 60 * 1000;
/** 2026-08-21T12:00Z — midday, so day arithmetic has room on both sides. */
const NOW = Date.UTC(2026, 7, 21, 12, 0, 0);

/** A player the daily word would reach: each test below breaks one clause. */
function reachable(overrides: Partial<Candidate> = {}): Candidate {
  return {
    standing: 12,
    finished: false,
    reachable: true,
    lastActiveAt: NOW - DAY,
    quieted: false,
    lastNudgedAt: null,
    doorstepsSent: 0,
    ...overrides,
  };
}

describe('the sleeping condition', () => {
  it('sends to a player standing, reachable, fresh, loud and unknocked', () => {
    expect(eligible(reachable(), NOW)).toEqual({ send: true, word: 'daily' });
  });

  it('sends the doorstep word to a player standing on no plan', () => {
    expect(eligible(reachable({ standing: null }), NOW)).toEqual({
      send: true,
      word: 'doorstep',
    });
  });

  it('sleeps for a player whose game is over — there is no game to call them back into', () => {
    expect(eligible(reachable({ finished: true }), NOW)).toEqual({
      send: false,
      because: 'finished',
    });
  });

  it('sleeps for a player the bot cannot write to', () => {
    expect(eligible(reachable({ reachable: false }), NOW)).toEqual({
      send: false,
      because: 'no-channel',
    });
  });

  it('sleeps for a player silent past fourteen days', () => {
    expect(eligible(reachable({ lastActiveAt: NOW - LAPSED_AFTER_MS - 1 }), NOW)).toEqual({
      send: false,
      because: 'lapsed',
    });
  });

  it('still sends on the fourteenth day itself — the bound is inclusive', () => {
    expect(eligible(reachable({ lastActiveAt: NOW - LAPSED_AFTER_MS }), NOW)).toEqual({
      send: true,
      word: 'daily',
    });
  });

  it('reads a seat with no timestamp at all as lapsed, not as fresh', () => {
    // Absent is not recent: a seat that never rolled or reported carries
    // nulls, and nulls must not pass a recency gate.
    expect(eligible(reachable({ lastActiveAt: null }), NOW)).toEqual({
      send: false,
      because: 'lapsed',
    });
  });

  it('sleeps for a player who said /quiet', () => {
    expect(eligible(reachable({ quieted: true }), NOW)).toEqual({
      send: false,
      because: 'quieted',
    });
  });

  it('knocks once a day, whatever re-runs the tick', () => {
    const thisMorning = Date.UTC(2026, 7, 21, 6, 0, 0);
    expect(eligible(reachable({ lastNudgedAt: thisMorning }), NOW)).toEqual({
      send: false,
      because: 'nudged-today',
    });
  });

  it('counts the day in UTC: one minute across midnight is a new day', () => {
    const lateYesterday = Date.UTC(2026, 7, 20, 23, 59, 0);
    const justAfterMidnight = Date.UTC(2026, 7, 21, 0, 5, 0);
    expect(eligible(reachable({ lastNudgedAt: lateYesterday }), justAfterMidnight)).toEqual({
      send: true,
      word: 'daily',
    });
    // And the same moment re-asked inside the day stays silent.
    expect(
      eligible(reachable({ lastNudgedAt: justAfterMidnight }), Date.UTC(2026, 7, 21, 23, 0, 0)),
    ).toEqual({ send: false, because: 'nudged-today' });
  });
});

describe('the hour', () => {
  it('defaults to six UTC, which is nine in the morning on Railway for Moscow', () => {
    expect(nudgeHour({})).toBe(DEFAULT_NUDGE_HOUR);
    expect(DEFAULT_NUDGE_HOUR).toBe(6);
  });

  it('reads an integer 0..23 and nothing else', () => {
    expect(nudgeHour({ LEELA_NUDGE_HOUR: '9' })).toBe(9);
    expect(nudgeHour({ LEELA_NUDGE_HOUR: '0' })).toBe(0);
    expect(nudgeHour({ LEELA_NUDGE_HOUR: '23' })).toBe(23);
    expect(nudgeHour({ LEELA_NUDGE_HOUR: ' 7 ' })).toBe(7);
    expect(nudgeHour({ LEELA_NUDGE_HOUR: '24' })).toBe(6);
    expect(nudgeHour({ LEELA_NUDGE_HOUR: '-1' })).toBe(6);
    expect(nudgeHour({ LEELA_NUDGE_HOUR: '6.5' })).toBe(6);
    expect(nudgeHour({ LEELA_NUDGE_HOUR: 'six' })).toBe(6);
    // An empty variable is a variable unset, not hour zero.
    expect(nudgeHour({ LEELA_NUDGE_HOUR: '' })).toBe(6);
  });

  it('waits until the next strike, never a past one', () => {
    const fiveAm = Date.UTC(2026, 7, 21, 5, 0, 0);
    expect(msUntilHour(fiveAm, 6)).toBe(60 * 60 * 1000);

    const sevenAm = Date.UTC(2026, 7, 21, 7, 0, 0);
    expect(msUntilHour(sevenAm, 6)).toBe(23 * 60 * 60 * 1000);
  });

  it('schedules tomorrow when asked exactly on the hour, not a second copy of today', () => {
    const sixSharp = Date.UTC(2026, 7, 21, 6, 0, 0);
    expect(msUntilHour(sixSharp, 6)).toBe(DAY);
  });
});

describe('excerpts', () => {
  it('keeps a short body whole', () => {
    expect(excerptsOf('One thought. Another.', 500)).toEqual(['One thought. Another.']);
  });

  it('has nothing to say about an empty body', () => {
    expect(excerptsOf('', 500)).toEqual([]);
    expect(excerptsOf('   \n  ', 500)).toEqual([]);
  });

  it('cuts where a sentence ends, never inside one', () => {
    const pieces = excerptsOf('First sentence here. Second sentence follows. Third one closes.', 30);
    expect(pieces).toEqual([
      'First sentence here.',
      'Second sentence follows.',
      'Third one closes.',
    ]);
  });

  it('cuts at the marks the dataset actually ends sentences with', () => {
    // Devanagari danda — the character two other trimmers in this repository
    // were caught not knowing. `lastSentenceEnd` knows it, so this must.
    const pieces = excerptsOf('पहला वाक्य यहाँ है। दूसरा वाक्य आता है।', 25);
    expect(pieces).toEqual(['पहला वाक्य यहाँ है।', 'दूसरा वाक्य आता है।']);
  });

  it('cuts hard when a stretch has no sentence end, rather than dropping it', () => {
    const wall = 'x'.repeat(120);
    const pieces = excerptsOf(wall, 50);
    expect(pieces.join('')).toBe(wall);
    for (const piece of pieces) expect(piece.length).toBeLessThanOrEqual(50);
  });

  it('bounds every excerpt of every real English plan', () => {
    for (let plan = 1; plan <= 72; plan++) {
      for (const piece of excerptsOf(planFor('en', plan).body)) {
        expect(piece.length, `plan ${plan}`).toBeLessThanOrEqual(EXCERPT_CHARS);
        expect(piece.length, `plan ${plan}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('the rotation', () => {
  it('starts at the beginning for a player never read to', () => {
    expect(nextExcerpt(4, null)).toBe(0);
  });

  it('never repeats the most recent excerpt when there are two or more', () => {
    for (const count of [2, 3, 7]) {
      let last: number | null = null;
      for (let day = 0; day < 20; day++) {
        const next = nextExcerpt(count, last);
        if (last !== null) expect(next, `count ${count}, day ${day}`).not.toBe(last);
        last = next;
      }
    }
  });

  it('walks every excerpt before coming back around', () => {
    const seen: number[] = [];
    let last: number | null = null;
    for (let day = 0; day < 3; day++) {
      last = nextExcerpt(3, last);
      seen.push(last);
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it('repeats a one-excerpt plan, which is allowed: the alternative is silence', () => {
    expect(nextExcerpt(1, 0)).toBe(0);
    expect(nextExcerpt(1, nextExcerpt(1, 0))).toBe(0);
  });

  it('wraps a cursor left over from a longer plan rather than indexing past the end', () => {
    // The cursor is per player, not per plan: a player who moved between
    // mornings may carry an index the new plan does not have.
    expect(nextExcerpt(2, 5)).toBe(0);
  });
});

/** A plan whose body is exactly the sentences given, for composing against. */
function planOf(sentences: string[], number = 12): Plan {
  return {
    plan: number,
    title: 'Test plan',
    description: null,
    body: sentences.join(' '),
    source: 'test',
  };
}

/** A sentence long enough that each is its own excerpt at the default bound. */
const LONG = (letter: string) => `${letter.repeat(EXCERPT_CHARS - 10)}.`;

describe('the daily word, composed', () => {
  it('carries the excerpt, the standing line and one call back, in English', () => {
    const plan = planFor('en', 12);
    const { text } = compose('en', plan, null, { firstNudge: false });

    expect(text).toContain(excerptsOf(plan.body)[0]);
    expect(text).toContain(messageFor('en', 'nudge.standing', { plan: 12, title: plan.title }));
    expect(text).toContain(messageFor('en', 'nudge.cta'));
    expect(text).toContain('/roll');
  });

  it('speaks Russian at a Russian table', () => {
    const plan = planFor('ru', 9);
    const { text } = compose('ru', plan, null, { firstNudge: false });

    expect(text).toContain(excerptsOf(plan.body)[0]);
    expect(text).toContain('Вы стоите на плане 9');
    expect(text).toContain(messageFor('ru', 'nudge.cta'));
  });

  it('ends the first message ever sent with the way out, naming /quiet', () => {
    const first = compose('en', planFor('en', 12), null, { firstNudge: true });
    expect(first.text.endsWith(messageFor('en', 'nudge.wayOut'))).toBe(true);
    expect(first.text).toContain('/quiet');
  });

  it('says the way out once, not every morning', () => {
    const later = compose('en', planFor('en', 12), 0, { firstNudge: false });
    expect(later.text).not.toContain('/quiet');
  });

  it('rotates: the next morning never reads the excerpt just heard', () => {
    const plan = planOf([LONG('a'), LONG('b'), LONG('c')]);
    let cursor: number | null = null;
    let previous = '';

    for (let morning = 0; morning < 6; morning++) {
      const word = compose('en', plan, cursor, { firstNudge: false });
      expect(word.text).not.toBe(previous);
      previous = word.text;
      cursor = word.excerpt;
    }
  });

  it('rotates a two-excerpt plan by alternating', () => {
    const plan = planOf([LONG('a'), LONG('b')]);
    const first = compose('en', plan, null, { firstNudge: false });
    const second = compose('en', plan, first.excerpt, { firstNudge: false });
    const third = compose('en', plan, second.excerpt, { firstNudge: false });

    expect(first.excerpt).toBe(0);
    expect(second.excerpt).toBe(1);
    expect(third.excerpt).toBe(0);
  });

  it('repeats a one-excerpt plan, and that is allowed', () => {
    const plan = planOf(['The whole of it in one breath.']);
    const first = compose('en', plan, null, { firstNudge: false });
    const second = compose('en', plan, first.excerpt, { firstNudge: false });
    expect(second.text).toBe(first.text);
  });

  it('still names where the player stands when the plan has no text to excerpt', () => {
    // A language a rebuild dropped a plan from falls back inside planFor; an
    // empty body is the one shape left, and the word is thinner, not wrong.
    const plan = planOf([]);
    const { text } = compose('en', plan, null, { firstNudge: false });
    expect(text).toContain(messageFor('en', 'nudge.standing', { plan: 12, title: plan.title }));
    expect(text).toContain(messageFor('en', 'nudge.cta'));
    expect(text.startsWith('\n')).toBe(false);
  });
});

describe('the memory fallback', () => {
  it('answers the three not-yets for a player never seen', async () => {
    const memory = new MemoryNudgeStore();
    expect(await memory.of('u1')).toEqual(NEVER_NUDGED);
    expect(NEVER_NUDGED).toEqual({ sentAt: null, excerpt: null, quieted: false, doorsteps: 0 });
  });

  it('remembers a send', async () => {
    const memory = new MemoryNudgeStore();
    await memory.record('u1', { at: NOW, excerpt: 2 });
    expect(await memory.of('u1')).toEqual({ sentAt: NOW, excerpt: 2, quieted: false, doorsteps: 0 });
  });

  it('keeps a send and /quiet apart: neither write speaks for the other', async () => {
    const memory = new MemoryNudgeStore();
    await memory.setQuieted('u1', true);
    await memory.record('u1', { at: NOW, excerpt: 0 });
    expect(await memory.of('u1')).toEqual({ sentAt: NOW, excerpt: 0, quieted: true, doorsteps: 0 });

    await memory.setQuieted('u1', false);
    expect(await memory.of('u1')).toEqual({ sentAt: NOW, excerpt: 0, quieted: false, doorsteps: 0 });
  });

  it('keeps players apart', async () => {
    const memory = new MemoryNudgeStore();
    await memory.record('u1', { at: NOW, excerpt: 1 });
    expect(await memory.of('u2')).toEqual(NEVER_NUDGED);
  });
});

describe('the fresh-start arm', () => {
  /** 2026-08-24T12:00Z is a Monday — the landmark the arm sleeps for. */
  const MONDAY = Date.UTC(2026, 7, 24, 12, 0, 0);
  const TUESDAY = MONDAY + DAY;

  it('knocks on a Monday inside the window, with the fresh-start word', () => {
    expect(eligible(reachable({ lastActiveAt: MONDAY - 20 * DAY }), MONDAY)).toEqual({
      send: true,
      word: 'freshStart',
    });
  });

  it('stays silent on any other day of the week', () => {
    expect(eligible(reachable({ lastActiveAt: TUESDAY - 20 * DAY }), TUESDAY)).toEqual({
      send: false,
      because: 'lapsed',
    });
  });

  it('holds the far edge of the window: thirty-five days knocks, thirty-six does not', () => {
    expect(eligible(reachable({ lastActiveAt: MONDAY - FRESH_START_UNTIL_MS }), MONDAY)).toEqual({
      send: true,
      word: 'freshStart',
    });
    expect(
      eligible(reachable({ lastActiveAt: MONDAY - FRESH_START_UNTIL_MS - DAY }), MONDAY),
    ).toEqual({ send: false, because: 'lapsed' });
  });

  it('never speaks to a seat that has no timestamp at all, Monday or not', () => {
    // An absence is not a lapse with a date on it: nobody knows when they
    // left, so no window can be said to hold them.
    expect(eligible(reachable({ lastActiveAt: null }), MONDAY)).toEqual({
      send: false,
      because: 'lapsed',
    });
  });

  it('still respects the quiet door and the daily cap', () => {
    expect(
      eligible(reachable({ lastActiveAt: MONDAY - 20 * DAY, quieted: true }), MONDAY),
    ).toEqual({ send: false, because: 'quieted' });
    expect(
      eligible(reachable({ lastActiveAt: MONDAY - 20 * DAY, lastNudgedAt: MONDAY - 1 }), MONDAY),
    ).toEqual({ send: false, because: 'nudged-today' });
  });

  it('opens the comeback with the landmark, in the language of the board', () => {
    const plan = planFor('en', 12);
    const said = compose('en', plan, null, { firstNudge: false, word: 'freshStart' });
    expect(said.text.startsWith('Monday is a good day to begin again')).toBe(true);
    expect(said.text).toContain('You are standing on 12');

    const ru = compose('ru', planFor('ru', 12), null, { firstNudge: false, word: 'freshStart' });
    expect(ru.text).toContain('начать заново');
  });

  it('the daily word carries no comeback line', () => {
    const said = compose('en', planFor('en', 12), null, { firstNudge: false, word: 'daily' });
    expect(said.text).not.toContain('begin again');
  });
});
