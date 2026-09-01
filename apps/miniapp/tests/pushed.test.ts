import { describe as group, expect, it } from 'vitest';

import { ON_TIME_MINUTES, dayOf, entriesIn, entryIn, exitCodeFor } from '../../../scripts/lib/pushed.mjs';

/**
 * Did the daily push go out, and only when it should have?
 *
 * `audit-pushed.mjs` is the gate; this is the check on the gate. It was written
 * after a morning that cost a push: five consecutive `06:00 SENT` lines and
 * then, for that day, nothing at all — a laptop asleep at six, recorded only in
 * a file nobody opens.
 *
 * **The second half is the one a counter would have missed.** The same log
 * carries a `16:58 SENT`, hours off the hour, because the sender was run by
 * hand while somebody worked on the quote file — every subscriber pushed to for
 * a message no shipped feature asked for. Counting sends calls that a success.
 */

/** The real log's shape, line for line, as the sender writes it. */
const LOG = [
  '2026-08-29T06:00:11+0700 SENT 2026-08-29 plan-47 ru+en',
  '2026-08-30T06:00:27+0700 SENT 2026-08-30 plan-48 ru+en',
  '2026-08-31T16:54:11+0700 DRY 2026-08-31 plan-28 would-send=1 (last recorded send: 2026-08-30)',
  '2026-08-31T16:58:35+0700 SENT 2026-08-31 plan-28 ru+en',
].join('\n');

group('reading what the sender wrote', () => {
  it('reads a line the sender actually writes', () => {
    const one = entryIn('2026-08-30T06:00:27+0700 SENT 2026-08-30 plan-48 ru+en');

    expect(one, 'the sender’s own shape did not read').not.toBeNull();
    expect(one).toMatchObject({ at: '2026-08-30', kind: 'SENT', forDay: '2026-08-30', quote: 'plan-48' });
    expect(one!.minutes, '06:00 is 360 minutes in').toBe(360);
  });

  it('keeps WHEN IT WAS WRITTEN apart from WHICH DAY IT WAS FOR', () => {
    // A catch-up run after a reboot writes one date and sends for another, and
    // a reader that conflated them would call the catch-up a missed day.
    const one = entryIn('2026-09-01T09:15:00+0700 SENT 2026-08-31 plan-28 ru+en');

    expect(one).not.toBeNull();
    expect(one!.at).toBe('2026-09-01');
    expect(one!.forDay).toBe('2026-08-31');
  });

  it('answers null for anything that is not a line, rather than half of one', () => {
    expect(entryIn('')).toBeNull();
    expect(entryIn('nothing like a log line')).toBeNull();
    expect(entryIn(null)).toBeNull();
    expect(entriesIn('a\nb\n')).toEqual([]);
  });
});

group('what the log says about one day', () => {
  const entries = entriesIn(LOG);

  it('says a day was sent, when it was and at the hour asked for', () => {
    expect(dayOf(entries, '2026-08-30')).toMatchObject({ state: 'sent' });
    expect(exitCodeFor('sent')).toBe(0);
  });

  it('CATCHES A DAY WITH NO SEND AT ALL — the morning that cost a push', () => {
    /*
     * The defect this exists for. The log is the only record and nothing read
     * it, so a laptop closed overnight lost the day in silence.
     */
    const missed = dayOf(entriesIn(LOG.split('\n').slice(0, 2).join('\n')), '2026-08-31');

    expect(missed.state).toBe('missed');
    expect(missed.why).toContain('no push went out');
    expect(exitCodeFor('missed')).toBe(1);
  });

  it('CATCHES A SEND THAT WAS NOT THE SCHEDULE, which counting cannot', () => {
    /*
     * The real 16:58 line. Every subscriber's phone lit up for it, and the
     * boundary says no messages to real users beyond what shipped features
     * already send. A guard that asked only *was there a SENT* calls this a
     * success — which is exactly what happened before this existed.
     */
    const verdict = dayOf(entries, '2026-08-31');

    expect(verdict.state).toBe('unscheduled');
    expect(verdict.why).toContain('16:58');
    expect(exitCodeFor('unscheduled')).toBe(1);
  });

  it('does not call a few minutes late a hand', () => {
    // The sender has taken 27 seconds to start; a machine waking at 06:05 is
    // the schedule, not somebody typing. An alarm that fires on jitter is one
    // people silence.
    const late = ['2026-08-30T06:20:00+0700 SENT 2026-08-30 plan-48 ru+en'];

    expect(dayOf(entriesIn(late.join('\n')), '2026-08-30').state).toBe('sent');
    expect(ON_TIME_MINUTES).toBeGreaterThan(5);
  });

  it('CALLS A DAY BEFORE THE LOG UNKNOWN, not missed', () => {
    /*
     * The third state, and not a courtesy. A guard that reported every date it
     * had no record of would print a hundred missed days on its first run and
     * be switched off the same morning.
     */
    const before = dayOf(entries, '2026-01-01');

    expect(before.state).toBe('unknown');
    expect(exitCodeFor('unknown')).toBe(2);
  });

  it('knows nothing from an empty log, rather than reporting a miss', () => {
    expect(dayOf([], '2026-08-31').state).toBe('unknown');
  });
});
