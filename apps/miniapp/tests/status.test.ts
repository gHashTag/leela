import { describe as group, expect, it } from 'vitest';

import type { Finding } from '../../../scripts/lib/status.mjs';
import {
  deployFrom,
  describe,
  entryFrom,
  listeningIn,
  releaseFrom,
  shutToStrangers,
  stagedFrom,
  testFlightFrom,
  verdict,
} from '../../../scripts/lib/status.mjs';

/**
 * The dashboard's own judgement, held still.
 *
 * `scripts/status.mjs` is probes — a live site, `railway`, App Store Connect —
 * and none of that can be tested without the world. What can is here: how a
 * line is judged, how the report reads, and every small parser that turns
 * another tool's output into a fact.
 *
 * It is tested at all because of what happened without tests. The first
 * version decided a line was a failure by matching its text against
 * `/^[A-Z ]+$/`, which caught `UNREACHABLE` and equally caught `NOT ASKED`, so
 * on any machine lacking the railway CLI it reported a failure where there was
 * none. That lived an hour and was found by hand. The parsers are the same
 * risk and quieter: a banner regex that stops matching does not throw — it
 * reports the wrong release for ever.
 *
 * The tests live in `apps/miniapp` because the deployment-checking concern
 * lives here: `src/smoke.ts` is what the dashboard imports its weight
 * arithmetic from, and two homes for one subject is the duplication this
 * repository keeps finding.
 */
group('what the dashboard calls a failure', () => {
  const line = (kind: Finding['kind'], name: string): Finding => ({
    surface: 'web',
    name,
    value: 'x',
    note: '',
    kind,
  });

  it('counts only the wrong, never the unasked', () => {
    const answer = verdict([
      line('fine', 'the board'),
      line('unasked', 'TestFlight'),
      line('unasked', 'the last deploy'),
    ]);

    // The bug this file exists for: three lines, two of them silence, and
    // silence is not a verdict.
    expect(answer.wrong).toEqual([]);
    expect(answer.unasked.map((one) => one.name)).toEqual(['TestFlight', 'the last deploy']);
    expect(answer.code).toBe(0);
  });

  it('fails on one wrong line however many are fine', () => {
    const answer = verdict([line('fine', 'the board'), line('wrong', 'the companion route')]);

    expect(answer.code).toBe(1);
    expect(answer.wrong.map((one) => one.name)).toEqual(['the companion route']);
  });

  it('says nothing is wrong when there is nothing at all', () => {
    expect(verdict([]).code).toBe(0);
  });
});

group('the report a person reads', () => {
  const findings: Finding[] = [
    { surface: 'web', name: 'the 3D board', value: 'live', note: '2 ms', kind: 'fine' },
    { surface: 'bot', name: 'the last deploy', value: 'not asked', note: 'no CLI', kind: 'unasked' },
  ];

  it('groups by surface and names each once', () => {
    const said = describe(findings, '2026-08-23 12:00');

    expect(said).toContain('Leela, measured 2026-08-23 12:00 UTC');
    expect(said.match(/^ {2}web$/gm)).toHaveLength(1);
    expect(said.match(/^ {2}bot$/gm)).toHaveLength(1);
  });

  it('names what it could not ask, separately from what is well', () => {
    const said = describe(findings, 'now');

    expect(said).toContain('Everything asked is well.');
    expect(said).toContain('Not asked here: the last deploy');
  });

  it('says nothing about the unasked when everything was asked', () => {
    const said = describe([findings[0] as Finding], 'now');

    expect(said).toContain('Everything asked is well.');
    expect(said).not.toContain('Not asked here');
  });

  it('names the wrong ones instead of the all-clear', () => {
    const said = describe(
      [{ surface: 'web', name: 'the 3D board', value: 'UNREACHABLE', note: '', kind: 'wrong' }] as Finding[],
      'now',
    );

    expect(said).toContain('1 wrong: the 3D board');
    expect(said).not.toContain('Everything asked is well.');
  });
});

group('the parsers, which fail quietly or not at all', () => {
  it('finds the entry the page names, and nothing when it names none', () => {
    expect(entryFrom('<script src="./assets/index-lLxd5Bpb.js"></script>')).toBe(
      'assets/index-lLxd5Bpb.js',
    );
    // Somebody else's script is not this deployment's entry.
    expect(entryFrom('<script src="https://telegram.org/js/telegram-web-app.js"></script>')).toBeNull();
    expect(entryFrom('<p>no code here</p>')).toBeNull();
  });

  it('reads the release out of the banner, and the trailing full stop off it', () => {
    expect(releaseFrom('Leela bot starting.\nPlan text: all 22 languages are in memory.\n')).toBe(
      'all 22 languages are in memory',
    );
    // A release that predates the line prints nothing of the sort, and that
    // absence is a fact about the release rather than a broken parser.
    expect(releaseFrom('Leela bot starting.\nListening as @leela_chakra_ai_bot\n')).toBeNull();
  });

  it('tells a listening bot from a quiet log window', () => {
    expect(listeningIn('Listening as @leela_chakra_ai_bot')).toBe(true);
    expect(listeningIn('Starting Container')).toBe(false);
  });

  it('reads the newest TestFlight build and its state', () => {
    const said = ['TestFlight, newest first:', '  build 6: VALID, uploaded 2026-08-23', '  build 5: VALID'].join('\n');

    expect(testFlightFrom(said)).toEqual({ build: '6', state: 'VALID' });
    expect(testFlightFrom('TestFlight, newest first:')).toBeNull();
  });

  it('tells a version waiting for a human from one that shipped', () => {
    const waiting = [
      'Store versions, newest first:',
      '  7.0: PREPARE_FOR_SUBMISSION, created 2026-08-21',
      '  6.10: READY_FOR_SALE, created 2024-08-11',
    ].join('\n');
    const shipped = ['Store versions, newest first:', '  6.10: READY_FOR_SALE, created 2024-08-11'].join('\n');

    // The one thing no other surface can tell apart.
    expect(stagedFrom(waiting)).toBe('7.0');
    expect(stagedFrom(shipped)).toBeNull();
  });

  it('reads the newest deployment row, and nothing from an empty table', () => {
    const table = [
      'Recent Deployments',
      '  af24815f-6d64-4cd8-ac16-7975f3b55d0b | SUCCESS | 2026-08-23 14:12:44 +07:00',
      '  10f78da2-9171-4856-a843-43922ee1cf6f | REMOVED | 2026-08-23 14:04:45 +07:00',
    ].join('\n');

    expect(deployFrom(table)).toEqual({
      id: 'af24815f',
      state: 'SUCCESS',
      when: '2026-08-23 14:12:44 +07:00',
    });
    expect(deployFrom('Recent Deployments\n')).toBeNull();
  });
});

group('a door that should be shut to strangers', () => {
  it('calls a 401 shut, which is the whole of the check', () => {
    expect(shutToStrangers(401)).toMatchObject({ kind: 'fine', value: 'shut to strangers' });
  });

  it('RAISES THE ALARM on a 2xx, which is what it exists for', () => {
    // A route that started answering unsigned callers looks, from outside,
    // exactly like a route that works — every other row in this report would
    // stay green while a player's own writing was served to anybody.
    for (const status of [200, 201, 204]) {
      const said = shutToStrangers(status);
      expect(said.kind, String(status)).toBe('wrong');
      expect(said.value).toBe('ANSWERED A STRANGER');
    }
  });

  it('tells a route that is not there from one that let somebody in', () => {
    // A 404 is a deployment behind the code — worth saying, and not the alarm.
    expect(shutToStrangers(404)).toMatchObject({ kind: 'wrong', value: 'NOT THERE' });
    expect(shutToStrangers(404).note).toContain('predates');
  });

  it('does not call a refusal of the wrong shape fine', () => {
    // 403 is the origin check, 405 the method, 500 the process. None of them is
    // the signature refusing, and a reader should see which door answered.
    for (const status of [403, 405, 500]) {
      expect(shutToStrangers(status).kind, String(status)).toBe('wrong');
      expect(shutToStrangers(status).value).toContain(String(status));
    }
  });

  it('says it could not ask when nothing answered', () => {
    // Never `wrong`: a dropped connection has not found an open door.
    expect(shutToStrangers(null)).toMatchObject({ kind: 'unasked' });
  });
});
