import { describe as group, expect, it } from 'vitest';

import type { Holder, LockState } from '../../../scripts/lib/loop.d.mts';
import {
  HELD,
  SILENT_AFTER_MS,
  STALE_AFTER_MS,
  cronFrom,
  heartbeatFrom,
  holderFrom,
  lastSignFrom,
  lockState,
  markedFrom,
  loopFindings,
  takeVerdict,
} from '../../../scripts/lib/loop.mjs';

/**
 * The loop's own liveness, held still.
 *
 * `scripts/lib/loop.mjs` exists because on 2026-08-28 the improvement loop was
 * found stopped, and had been for a hundred and twelve hours, while every
 * surface it maintains read green. This file is the falsification of the thing
 * that would have said so: each case below is a state the loop has actually
 * been in, or one it can reach, and the guard has to tell them apart.
 *
 * These live beside `status.test.ts` for the reason that file gives about
 * itself — the dashboard's judgement is tested where the deployment-checking
 * concern already lives, and two homes for one subject is the duplication this
 * repository keeps finding.
 */
const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 28, 7, 0, 0);

group('reading a lock that was written by somebody else', () => {
  it('reads the shape that was actually on disk, an epoch and nothing else', () => {
    // The literal contents of ~/.leela/LOOP.lock on the morning this was
    // written. A parser that threw here would have failed on the one file the
    // whole measurement exists for.
    const holder = holderFrom('1787497537');

    // In MILLISECONDS, and the unit is the assertion. `date +%s` writes
    // seconds; everything downstream compares against `Date.now()`. The first
    // draft of this test asserted the raw number back, which is the shape of
    // fixture that agrees with any unit at all.
    expect(holder).toEqual({
      at: 1787497537 * 1000,
      // No mark, because nothing wrote marks when this was the shape on disk.
      // `lastSignFrom` falls back to `at`, so this lock is judged exactly as it
      // was before marking existed.
      beat: null,
      marks: 0,
      pid: null,
      host: null,
      shape: 'bare',
    });
  });

  it('reads a hand-written epoch in either unit, because both are plausible', () => {
    expect(holderFrom(JSON.stringify({ at: 1787497537, pid: 1 }))?.at).toBe(1787497537 * 1000);
    expect(holderFrom(JSON.stringify({ at: 1787497537000, pid: 1 }))?.at).toBe(1787497537000);
  });

  it('reads the named shape, and keeps the process it names', () => {
    // Milliseconds, because `loop-lock.mjs` writes `Date.now()`. This fixture
    // said 1787900782 until the unit was fixed — a number that is a plausible
    // lock either way, which is exactly how the error got in.
    const holder = holderFrom(JSON.stringify({ at: 1787900782000, pid: 43877, host: 'studio.local' }));

    expect(holder).toEqual({
      at: 1787900782000,
      beat: null,
      marks: 0,
      pid: 43877,
      host: 'studio.local',
      shape: 'named',
    });
  });

  it('calls no lock free, and an unreadable one held rather than absent', () => {
    expect(holderFrom('')).toBeNull();
    expect(holderFrom('   \n')).toBeNull();
    expect(holderFrom(undefined)).toBeNull();

    // Somebody wrote this. Reading it as "free" would let a second iteration in
    // on top of a first, which is the one outcome this file must never produce.
    expect(holderFrom('taken by hand')?.shape).toBe('unreadable');
    expect(holderFrom('{"at":')?.shape).toBe('unreadable');
  });

  it('refuses a shape that parses but says nothing useful', () => {
    expect(holderFrom(JSON.stringify({ at: 'yesterday', pid: '43877' }))).toEqual({
      at: null,
      beat: null,
      marks: 0,
      pid: null,
      host: null,
      shape: 'named',
    });
    expect(holderFrom('[1787497537]')?.shape).toBe('unreadable');
  });
});

group('whether the holder has been there too long', () => {
  const bare = (age: number): Holder => ({
    at: NOW - age,
    beat: null,
    marks: 0,
    pid: null,
    host: null,
    shape: 'bare',
  });
  const named = (age: number): Holder => ({
    at: NOW - age,
    beat: null,
    marks: 0,
    pid: 43877,
    host: 'studio.local',
    shape: 'named',
  });
  /** Taken `age` ago and last heard from `silence` ago. */
  const marked = (age: number, silence: number): Holder => ({
    ...named(age),
    beat: NOW - silence,
    marks: 7,
  });

  it('is free when nothing holds it', () => {
    expect(lockState(null, { now: NOW }).state).toBe('free');
  });

  it('HOLDS a young lock whose process is long gone, which is every lock', () => {
    // THE RETRACTION, as a test. A dead pid used to clear the lock at once, and
    // the process that writes it — `loop-lock.mjs` — exits before the iteration
    // begins, so every live lock names a dead process. That rule read every
    // working iteration as abandoned and would have let a second cron start on
    // top of it, which is the one outcome this file exists to prevent.
    expect(lockState(named(5 * 60 * 1000), { now: NOW }).state).toBe('held');
  });

  it('clears one that has been held past the hour', () => {
    const answer = lockState(named(3 * HOUR), { now: NOW });

    expect(answer.state).toBe('abandoned');
    expect(answer.why).toContain('3 h');
  });

  it('reads the bare lock the same way, because the shape decides nothing', () => {
    expect(lockState(bare(10 * 60 * 1000), { now: NOW }).state).toBe('held');
    expect(lockState(bare(2 * HOUR), { now: NOW }).state).toBe('abandoned');
  });

  it('does not clear a bare lock somebody took ten minutes ago', () => {
    // Through the parser and against a clock, which is the only arrangement
    // that can see a unit error: read as seconds against `Date.now()` this
    // holder is half a million hours old and gets cleared.
    const tenMinutesAgo = String(Math.floor((NOW - 10 * 60 * 1000) / 1000));

    expect(lockState(holderFrom(tenMinutesAgo), { now: NOW }).state).toBe('held');
    expect(lockState(holderFrom(String(NOW - 10 * 60 * 1000)), { now: NOW }).state).toBe('held');
  });

  it('KEEPS a lock held three hours by an iteration that keeps speaking', () => {
    /*
     * THE DEFECT, and it has cost twice. #50 and #51 each ran an hour and a
     * half — a competitor probe, three full suites, five falsifications — and
     * the rule measured from the TAKING, so the dashboard called each live lock
     * ABANDONED while its holder was still writing. An abandoned lock is an
     * invitation: the next cron is cleared to start work on top of the running
     * one, which is the single outcome this file exists to prevent.
     *
     * Three hours here, well past the old bound, and the answer is `held`
     * because something said so a minute ago.
     */
    const answer = lockState(marked(3 * HOUR, 60 * 1000), { now: NOW });

    expect(answer.state).toBe('held');
    expect(answer.why).toContain('heard from');
  });

  it('clears one that stopped speaking, however recently it was taken', () => {
    // The other direction, and the one the hour is really for: a session that
    // died. Taken ten minutes ago is irrelevant if nothing has been heard since
    // — though in practice a lock cannot be marked before it is taken, so this
    // is the shape of a holder that marked once and then went.
    const answer = lockState(marked(90 * 60 * 1000, 2 * HOUR), { now: NOW });

    expect(answer.state).toBe('abandoned');
    expect(answer.why).toContain('nothing has been heard');
  });

  it('clears an iteration that is alive and going nowhere', () => {
    /*
     * Marking must not become a way to hold the lock for ever — that would be
     * the 112-hour outage with a motor attached. Eight hours, still speaking,
     * and the cap takes it.
     */
    const answer = lockState(marked(8 * HOUR, 60 * 1000), { now: NOW });

    expect(answer.state).toBe('abandoned');
    expect(answer.why).toContain('still speaking');
  });

  it('tells the two abandonments apart, because they are different diagnoses', () => {
    // Silence is a session that died; the cap is one that did not. A reader
    // who cannot tell them apart will debug the wrong thing.
    expect(lockState(marked(2 * HOUR, 2 * HOUR), { now: NOW }).why).toMatch(/heard/);
    expect(lockState(marked(8 * HOUR, 1000), { now: NOW }).why).toMatch(/six/);
    // And a lock that never spoke at all says so, rather than blaming silence
    // on a mark it never made.
    expect(lockState(named(3 * HOUR), { now: NOW }).why).toMatch(/without ever saying/);
  });

  it('falls back to the taking time for every lock written before marks existed', () => {
    /*
     * The compatibility claim, stated as a test: an iteration that never marks
     * is judged exactly as every iteration was before this existed, so the
     * change cannot make anything worse than it already was. `lastSignFrom` is
     * the whole of it.
     */
    expect(lastSignFrom(named(10 * 60 * 1000))).toBe(NOW - 10 * 60 * 1000);
    expect(lastSignFrom(bare(10 * 60 * 1000))).toBe(NOW - 10 * 60 * 1000);
    expect(lastSignFrom(marked(3 * HOUR, 60 * 1000))).toBe(NOW - 60 * 1000);
    expect(lastSignFrom(null)).toBeNull();
  });

  it('CARRIES the taking time through a mark, so the cap cannot be reset', () => {
    /*
     * The single most dangerous line in this change. If `mark` restamped `at`,
     * every mark would reset the age the six-hour cap measures and a holder
     * could keep the lock for ever by saying "still here" — the 112-hour outage
     * with a motor attached, reached while fixing the opposite problem.
     *
     * Ten marks, an hour apart, and the taking time has not moved.
     */
    let holder: Holder = named(0);
    const taken = holder.at;

    for (let i = 1; i <= 10; i += 1) {
      const written = markedFrom(holder, { now: NOW + i * HOUR, step: `step ${i}` });
      expect(written.at, `after ${i} marks`).toBe(taken);
      expect(written.marks).toBe(i);
      holder = { ...holder, at: written.at, beat: written.beat, marks: written.marks };
    }

    // And it is still caught by the cap, marking or not.
    expect(lockState(holder, { now: NOW + 10 * HOUR }).state).toBe('abandoned');
  });

  it('dates a mark on an undated lock rather than writing a second undated one', () => {
    const written = markedFrom(
      { at: null, beat: null, marks: 0, pid: null, host: null, shape: 'unreadable' },
      { now: NOW },
    );

    expect(written.at).toBe(NOW);
    expect(written.marks).toBe(1);
  });

  it('treats a lock that will not say when as abandoned', () => {
    const answer = lockState(
      { at: null, beat: null, marks: 0, pid: null, host: null, shape: 'unreadable' },
      { now: NOW },
    );

    expect(answer.state).toBe('abandoned');
    expect(answer.why).toContain('when');
  });

  it('turns over exactly at the hour it documents', () => {
    expect(lockState(bare(STALE_AFTER_MS), { now: NOW }).state).toBe('held');
    expect(lockState(bare(STALE_AFTER_MS + 1), { now: NOW }).state).toBe('abandoned');
  });
});

group('what take does about it, and the code it says it with', () => {
  const state = (over: Partial<LockState> = {}): LockState => ({
    state: 'free',
    ageMs: null,
    silentMs: null,
    why: 'x',
    ...over,
  });

  it('never answers a refusal with 1, because node uses 1 for a missing file', () => {
    // The assertion this group exists for. `node scripts/does-not-exist.mjs`
    // exits 1 — measured 2026-08-28 — and the contract's instruction on the
    // refusal code is to exit without a word. With 1 as the refusal, deleting
    // this worktree would stop the loop for ever and say nothing, which is a
    // worse version of the 112-hour outage the lock was built to end.
    expect(HELD).not.toBe(1);
    expect(HELD).not.toBe(0);
    // Nor 2, 8 or 9, which node uses for its own argument failures.
    expect([2, 8, 9]).not.toContain(HELD);
  });

  it('refuses a live holder with that code and takes nothing', () => {
    const answer = takeVerdict(state({ state: 'held', why: 'pid 43877 is running' }));

    expect(answer).toMatchObject({ code: HELD, taken: false });
    expect(answer.say).toContain('43877');
  });

  it('takes a free lock quietly', () => {
    expect(takeVerdict(state())).toEqual({ code: 0, taken: true, say: '' });
  });

  it('takes an abandoned lock and says which rule cleared it', () => {
    const answer = takeVerdict(state({ state: 'abandoned', why: 'the process that took it (pid 9) is gone' }));

    expect(answer).toMatchObject({ code: 0, taken: true });
    // Stepping over somebody's lock is the one act here that can lose another
    // agent's work; doing it silently is how that becomes invisible.
    expect(answer.say).toContain('clearing an abandoned lock');
    expect(answer.say).toContain('pid 9');
  });
});

group('the mark a finished iteration leaves', () => {
  it('reads what was written', () => {
    const said = JSON.stringify({ at: NOW, iteration: 32, commit: 'abc1234', note: 'the loop measures itself' });

    expect(heartbeatFrom(said)).toEqual({
      at: NOW,
      iteration: '32',
      commit: 'abc1234',
      note: 'the loop measures itself',
    });
  });

  it('reads half a file as no mark instead of throwing', () => {
    // A heartbeat is most likely to be half-written by a process that died, so
    // this is precisely the case a status tool must survive.
    expect(heartbeatFrom('{"at":178790')).toBeNull();
    expect(heartbeatFrom('')).toBeNull();
    expect(heartbeatFrom(JSON.stringify({ iteration: 32 }))).toBeNull();
    expect(heartbeatFrom(JSON.stringify(['at', NOW]))).toBeNull();
  });
});

group('the schedule, which is worth less than it looks', () => {
  const store = JSON.stringify({
    tasks: [
      { id: 'other', cron: '*/30 * * * *', prompt: 'something else entirely', lastFiredAt: NOW },
      { id: '0b5d0e90', cron: '4,19,34,49 * * * *', prompt: 'Прочитай /Users/playra/.leela/LOOP.md ПЕРВЫМ', lastFiredAt: NOW - HOUR },
    ],
  });

  it('finds the task by what its prompt says, not by an id that changes', () => {
    expect(cronFrom(store, 'LOOP.md')).toEqual({ cron: '4,19,34,49 * * * *', lastFiredAt: NOW - HOUR });
  });

  it('says nothing rather than guessing when no task names the contract', () => {
    expect(cronFrom(store, 'NOTHING.md')).toBeNull();
    expect(cronFrom('{}', 'LOOP.md')).toBeNull();
    expect(cronFrom('not json at all', 'LOOP.md')).toBeNull();
  });
});

group('the three rows, on the morning they were needed', () => {
  const rows = (over: Parameters<typeof loopFindings>[0] extends never ? never : Record<string, unknown>) =>
    loopFindings({
      holder: null,
      heartbeat: { at: NOW - HOUR, iteration: '32', commit: 'abc1234', note: '' },
      cron: { cron: '4,19,34,49 * * * *', lastFiredAt: NOW - 5 * 60 * 1000 },
      now: NOW,
      ...over,
    });

  it('says everything is well when it is', () => {
    expect(rows({}).every((row) => row.kind === 'fine')).toBe(true);
    expect(rows({}).map((row) => row.name)).toEqual(['the last iteration', 'the lock', 'the schedule']);
  });

  it('reproduces 2026-08-28: a bare lock five days old and no mark at all', () => {
    // The state this file exists for, asserted as a whole rather than in parts.
    // Two rows wrong, and the third — the schedule — reading perfectly healthy,
    // because the run that reads `lastFiredAt` is the run that refreshes it.
    const found = rows({
      holder: holderFrom('1787497537'),
      heartbeat: null,
      cron: { cron: '4,19,34,49 * * * *', lastFiredAt: NOW - 2 * 60 * 1000 },
    });

    expect(found.filter((row) => row.kind === 'wrong').map((row) => row.name)).toEqual([
      'the last iteration',
      'the lock',
    ]);
    expect(found[0]?.value).toBe('NONE RECORDED');
    expect(found[1]?.value).toBe('ABANDONED');
    expect(found[2]?.kind).toBe('fine');
  });

  it('calls a day of silence wrong, and an hour of it well', () => {
    const quiet = rows({ heartbeat: { at: NOW - SILENT_AFTER_MS - 1, iteration: '31', commit: null, note: '' } });

    expect(quiet[0]?.kind).toBe('wrong');
    expect(quiet[0]?.note).toContain('SILENT');

    expect(rows({ heartbeat: { at: NOW - SILENT_AFTER_MS, iteration: '31', commit: null, note: '' } })[0]?.kind).toBe(
      'fine',
    );
  });

  it('calls an unscheduled loop wrong, which is a machine nothing will start', () => {
    expect(rows({ cron: null })[2]).toMatchObject({ value: 'NOT SCHEDULED', kind: 'wrong' });
    expect(rows({ cron: { cron: '*/15 * * * *', lastFiredAt: null } })[2]?.kind).toBe('wrong');
    expect(rows({ cron: { cron: '*/15 * * * *', lastFiredAt: NOW - 30 * HOUR } })[2]?.kind).toBe('wrong');
  });

  it('names the iteration and the commit, so the row can be checked against git', () => {
    expect(rows({}).at(0)?.value).toContain('#32');
    expect(rows({}).at(0)?.note).toContain('abc1234');
  });
});
