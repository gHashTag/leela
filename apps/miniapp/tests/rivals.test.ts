import { describe as group, expect, it } from 'vitest';

import type { Reading } from '../../../scripts/lib/rivals.d.mts';
import {
  ABSENCE,
  RIVALS,
  WITHOUT_AN_ADDRESS,
  describeRivals,
  readClaims,
} from '../../../scripts/lib/rivals.mjs';

/**
 * The competitor sweep's judgement, held still.
 *
 * `scripts/rivals.mjs` fetches other people's websites and cannot be tested
 * without them. What can is the part that turns a page into a verdict — and
 * that part is where this sweep can do real damage, because every output of it
 * is a sentence about somebody else's business that ends up in `NOTES.md`.
 *
 * Two failures it exists to make impossible, both met on 2026-08-28 while the
 * table was being re-measured by hand:
 *
 *   - **A probe that never loaded reporting numbers.** Nine domains were
 *     checked through one shared temporary file; three of the fetches failed,
 *     left the previous page in it, and reported that page's byte count and hit
 *     counts as their own. Two of the three looked like live sites.
 *   - **Absence read as refutation.** leelaquest.com's landing page shows no
 *     price, which is not the same as the price having gone: it links nothing
 *     matching `pric|plan|buy|credit|subscri` at all.
 */
const rival = (over = {}) => ({
  name: 'Somebody',
  at: 'https://example.invalid/',
  shape: 'a board',
  calibration: /leela/i,
  claims: [{ says: 'costs 1490 ₽', needle: /1490/, absence: ABSENCE.refuted }],
  ...over,
});

group('what a page is allowed to prove', () => {
  it('reads a claim as holding when the page carries it', () => {
    const answer = readClaims(rival(), '<p>Leela, 1490 ₽</p>');

    expect(answer.reached).toBe(true);
    expect(answer.claims[0]).toMatchObject({ found: true, verdict: 'holds' });
  });

  it('calls a refutable claim GONE when the right page does not carry it', () => {
    const answer = readClaims(rival(), '<p>Leela, now free</p>');

    expect(answer.claims[0]).toMatchObject({ found: false, verdict: 'GONE' });
  });

  it('never calls a failed fetch a refutation', () => {
    // The whole point. A dead host and a dropped price must not produce the
    // same sentence, and the sentence goes into a document about a competitor.
    const answer = readClaims(rival(), null);

    expect(answer.reached).toBe(false);
    expect(answer.claims).toEqual([]);
    expect(answer.why).toContain('did not answer');
  });

  it('refuses a page that answered but is the wrong page', () => {
    // A parking page, a captcha, a stub served to a non-browser: 200 and 706
    // bytes of nothing was a real answer from one of the domains probed.
    const answer = readClaims(rival(), '<html><body>Domain for sale</body></html>');

    expect(answer.reached).toBe(false);
    expect(answer.why).toContain('not the page');
    expect(answer.claims).toEqual([]);
  });

  it('says "not shown here" for a claim this page could never settle', () => {
    const priced = rival({
      claims: [{ says: 'about $4.99 a game', needle: /4\.99/, absence: ABSENCE.unknown }],
    });

    expect(readClaims(priced, '<p>Leela board</p>').claims[0]).toMatchObject({
      found: false,
      verdict: 'not shown here',
    });
  });
});

group('the report a person reads and a journal quotes', () => {
  const held: Reading[] = [
    { name: 'A', reached: true, why: '', claims: [{ says: 'x', found: true, verdict: 'holds' }] },
  ];
  const lost: Reading[] = [
    { name: 'B', reached: true, why: '', claims: [{ says: 'y', found: false, verdict: 'GONE' }] },
  ];

  it('says so plainly when nothing has changed', () => {
    const said = describeRivals(held, [], '2026-08-28 08:00');

    expect(said).toContain('The field, measured 2026-08-28 08:00 UTC');
    expect(said).toContain('Every claim that could be checked still holds.');
  });

  it('counts what no longer holds, because NOTES.md still says it does', () => {
    const said = describeRivals(lost, [], 'now');

    expect(said).toContain('1 claim(s) no longer hold');
    expect(said).not.toContain('still holds.');
  });

  it('keeps the rivals it cannot reach visible instead of tidying them away', () => {
    const said = describeRivals(held, [{ name: 'OMKARA', why: 'no address on record' }], 'now');

    expect(said).toContain('Named in NOTES.md and not checkable from here');
    expect(said).toContain('OMKARA — no address on record');
  });

  it('does not count an unreachable rival as a claim that held', () => {
    const alone: Reading[] = [{ name: 'C', reached: false, why: 'the fetch did not answer', claims: [] }];
    const said = describeRivals(alone, [], 'now');

    expect(said).toContain('NOT REACHED');
    // No claims were checked, so nothing was refuted — but a reader must not
    // come away thinking this rival was confirmed either.
    expect(said).toContain('Every claim that could be checked still holds.');
  });
});

group('the roster itself', () => {
  it('gives every rival an address, which is the half NOTES.md never had', () => {
    for (const one of RIVALS) {
      expect(one.at).toMatch(/^https:\/\//);
      expect(one.claims.length).toBeGreaterThan(0);
    }
  });

  it('gives every rival a calibration needle distinct from its claims', () => {
    // A calibration that is also the claim proves nothing: the page would be
    // "reached" exactly when the claim holds, and unreachable whenever it did
    // not — which reports a dead site every time a price changes.
    for (const one of RIVALS) {
      const needles = one.claims.map((claim) => String(claim.needle));
      expect(needles).not.toContain(String(one.calibration));
    }
  });

  it('names the ones with no address, with the reason', () => {
    expect(WITHOUT_AN_ADDRESS.length).toBeGreaterThan(0);
    for (const one of WITHOUT_AN_ADDRESS) expect(one.why.length).toBeGreaterThan(40);
  });
});
