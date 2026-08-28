#!/usr/bin/env node
/**
 * Who else is playing this game, re-derived rather than remembered.
 *
 *     node scripts/rivals.mjs
 *
 * Written 2026-08-28, because `apps/webgl/NOTES.md` carries two tables of
 * rivals and only one of them can be re-run. The iOS table records a `curl` and
 * is therefore true whenever anybody reads it; the web table recorded prose,
 * and five of its rows had been "carried from 08-22" for six days.
 *
 * The roster, the claims and the calibration are in `lib/rivals.mjs`, where
 * they can be tested. This file is the part that touches the world: it fetches,
 * and it prints. It exits 0 whatever it finds — a competitor is not a defect,
 * and a check that goes red when somebody else edits their own landing page is
 * a check that gets switched off.
 */

import { RIVALS, WITHOUT_AN_ADDRESS, describeRivals, readClaims } from './lib/rivals.mjs';

/**
 * A page, or null.
 *
 * Null is the only failure shape. Returning "" would make an empty string flow
 * into the calibration test and come out as "the claims are gone", which is the
 * exact confusion this whole file exists to prevent.
 */
async function page(url) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 40_000);
  try {
    const answer = await fetch(url, {
      signal: stop.signal,
      redirect: 'follow',
      // Google Play serves a stub to anything that does not look like a
      // browser, and a stub passes no calibration — which would read as
      // "the listing is gone".
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    });
    return answer.status === 200 ? await answer.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const rows = [];
for (const rival of RIVALS) {
  rows.push(readClaims(rival, await page(rival.at)));
}

console.log(describeRivals(rows, WITHOUT_AN_ADDRESS, new Date().toISOString().slice(0, 16).replace('T', ' ')));

/**
 * And the iOS half, by the command NOTES.md already carries.
 *
 * Run here too so that one invocation answers the whole question. It is what
 * caught NOTES.md claiming our own app was 6.10 from 2024 on a morning Apple
 * was serving 7.0 from the day before.
 */
const ours = await page('https://itunes.apple.com/lookup?id=6504097981,1574737998,1296604457');
if (ours === null) {
  console.log('\nThe iOS field: not asked, Apple did not answer here.');
} else {
  console.log('\nThe iOS field, from Apple:');
  for (const app of JSON.parse(ours).results ?? []) {
    console.log(
      `  ${String(app.trackName).slice(0, 34).padEnd(36)} v${String(app.version).padEnd(8)}` +
        ` updated ${String(app.currentVersionReleaseDate).slice(0, 10)}  ${app.userRatingCount ?? 0} ratings`,
    );
  }
}
