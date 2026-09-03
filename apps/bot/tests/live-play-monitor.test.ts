/**
 * The monitor has to complain about damage it has never seen, and stay quiet
 * about a healthy game.
 *
 * Both halves matter equally. A monitor that only ever runs against production
 * is a monitor whose silence means nothing: on 2026-09-03 the whole audit suite
 * was green while six of the game's seven throws in its lifetime had moved
 * nothing, and the reason is that nothing was looking at behaviour. A monitor
 * with no negative control repeats that mistake one level up.
 */

import { describe, expect, it } from 'vitest';
import { findings, report, type Snapshot, type Throw } from '../src/live-play-monitor';

const HOUR = 60 * 60 * 1000;
const NOW = 1_788_400_000_000;

const throwAt = (over: Partial<Throw> = {}): Throw => ({
  userId: 'u1',
  roll: 4,
  fromPlan: 6,
  toPlan: 10,
  at: NOW - HOUR,
  ...over,
});

/** A game where everything is working. The control for every case below. */
const healthy = (over: Partial<Snapshot> = {}): Snapshot => ({
  throws: [
    throwAt({ userId: 'u1', fromPlan: 6, toPlan: 10 }),
    throwAt({ userId: 'u1', fromPlan: 10, toPlan: 14 }),
    throwAt({ userId: 'u2', fromPlan: 6, toPlan: 12 }),
  ],
  tables: [{ id: 't1', rollCount: 2, updatedAt: NOW - HOUR }],
  entitlements: [{ userId: 'u1', until: NOW + 30 * 24 * HOUR, refundedAt: null }],
  funnel: [{ userId: 'u1', trialAt: NOW - 5 * HOUR, paywallAt: null, invoiceAt: null, purchaseAt: NOW - 4 * HOUR }],
  log: ['[initiative] sent 2', 'The daily word is armed.'],
  freeMoves: 3,
  now: NOW,
  ...over,
});

const ids = (s: Snapshot): string[] => findings(s).map((f) => f.id);

describe('live play monitor', () => {
  it('says nothing about a healthy game', () => {
    expect(findings(healthy())).toEqual([]);
    expect(report([])).toEqual([
      'live play: nothing to report — every check found the game healthy.',
    ]);
  });

  it('names the entry gate when most throws move nothing', () => {
    // Production on 2026-09-03, in miniature: everyone waiting on 68 for a six.
    const s = healthy({
      throws: [
        throwAt({ userId: 'u1', roll: 3, fromPlan: 68, toPlan: 68 }),
        throwAt({ userId: 'u1', roll: 1, fromPlan: 68, toPlan: 68 }),
        throwAt({ userId: 'u2', roll: 2, fromPlan: 68, toPlan: 68 }),
        throwAt({ userId: 'u2', roll: 6, fromPlan: 68, toPlan: 6 }),
      ],
    });
    expect(ids(s)).toContain('entry-gate-eats-the-first-session');
  });

  it('calls it blocking only once a player has actually been lost', () => {
    const stalled = [
      throwAt({ userId: 'u9', roll: 3, fromPlan: 68, toPlan: 68, at: NOW - 3 * HOUR }),
      throwAt({ userId: 'u9', roll: 1, fromPlan: 68, toPlan: 68, at: NOW - 3 * HOUR }),
    ];
    const recent = findings(healthy({ throws: stalled }))
      .find((f) => f.id === 'entry-gate-eats-the-first-session');
    expect(recent?.severity).toBe('costly');

    const old = stalled.map((t) => ({ ...t, at: NOW - 72 * HOUR }));
    const gone = findings(healthy({ throws: old }))
      .find((f) => f.id === 'entry-gate-eats-the-first-session');
    expect(gone?.severity).toBe('blocking');
    expect(gone?.says).toContain('have not come back');
  });

  it('reports a paywall nobody has ever paid', () => {
    expect(ids(healthy({ entitlements: [] }))).toContain('paywall-with-no-door-ever-used');
  });

  it('does not report a paywall that is not configured', () => {
    // `stars === null` means no paywall at all; a zero here is correct, not a
    // defect, and a monitor that cannot tell those apart is noise.
    expect(ids(healthy({ entitlements: [], freeMoves: null })))
      .not.toContain('paywall-with-no-door-ever-used');
  });

  it('counts a refunded or expired period as no subscription', () => {
    const refunded = [{ userId: 'u1', until: NOW + HOUR, refundedAt: NOW - HOUR }];
    const expired = [{ userId: 'u1', until: NOW - HOUR, refundedAt: null }];
    expect(ids(healthy({ entitlements: refunded }))).toContain('paywall-with-no-door-ever-used');
    expect(ids(healthy({ entitlements: expired }))).toContain('paywall-with-no-door-ever-used');
  });

  it('reports a funnel that has recorded nothing while moves exist', () => {
    expect(ids(healthy({ funnel: [] }))).toContain('funnel-recorded-nothing');
  });

  it('does not blame the funnel when nobody has moved yet', () => {
    const noMoves = [throwAt({ roll: 2, fromPlan: 68, toPlan: 68 })];
    expect(ids(healthy({ funnel: [], throws: noMoves }))).not.toContain('funnel-recorded-nothing');
  });

  it('names the offer when everyone who saw the wall never saw an invoice', () => {
    const stuck = [
      { userId: 'u1', trialAt: NOW - 9 * HOUR, paywallAt: NOW - 8 * HOUR, invoiceAt: null, purchaseAt: null },
      { userId: 'u2', trialAt: NOW - 7 * HOUR, paywallAt: NOW - 6 * HOUR, invoiceAt: null, purchaseAt: null },
    ];
    const found = findings(healthy({ funnel: stuck }));
    expect(found.map((f) => f.id)).toContain('nobody-gets-past-the-offer');
    expect(found.find((f) => f.id === 'nobody-gets-past-the-offer')?.says)
      .toContain('the offer, not the price');
  });

  it('names the price instead once an invoice was opened and abandoned', () => {
    const abandoned = [
      { userId: 'u1', trialAt: NOW - 9 * HOUR, paywallAt: NOW - 8 * HOUR, invoiceAt: NOW - 7 * HOUR, purchaseAt: null },
    ];
    const ids2 = findings(healthy({ funnel: abandoned })).map((f) => f.id);
    expect(ids2).toContain('invoices-opened-and-abandoned');
    expect(ids2).not.toContain('nobody-gets-past-the-offer');
  });

  it('reports tables opened and never thrown on', () => {
    const cold = [{ id: 't7', rollCount: 0, updatedAt: NOW - 40 * HOUR }];
    expect(ids(healthy({ tables: cold }))).toContain('tables-opened-and-never-played');
  });

  it('reports the companion refusing requests', () => {
    const log = ['[guide] companion silenced: no available quota (429/1113)'];
    expect(ids(healthy({ log }))).toContain('companion-is-out-of-quota');
  });

  it('puts blocking findings first and carries a fix on every one', () => {
    const bad = healthy({
      throws: [
        throwAt({ userId: 'u9', roll: 3, fromPlan: 68, toPlan: 68, at: NOW - 72 * HOUR }),
      ],
      entitlements: [],
      funnel: [],
      tables: [{ id: 't0', rollCount: 0, updatedAt: NOW }],
      log: ['ModelError: the model refused the request (429)'],
    });
    const found = findings(bad);
    expect(found.length).toBeGreaterThan(2);
    for (const f of found) expect(f.fix.length).toBeGreaterThan(20);

    const lines = report(found);
    expect(lines[0]).toContain('[blocking]');
  });

  it('reports nothing at all on an empty database', () => {
    // A bot deployed an hour ago has no throws, no tables and no funnel. Every
    // check must read that as "no evidence" rather than as damage, or the first
    // run after any migration is a wall of false alarms nobody reads again.
    const fresh: Snapshot = {
      throws: [], tables: [], entitlements: [], funnel: [], log: [], freeMoves: 3, now: NOW,
    };
    expect(findings(fresh)).toEqual([]);
  });
});
