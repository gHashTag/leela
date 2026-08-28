/**
 * The competitor table, as something that can be re-run instead of carried.
 *
 * `apps/webgl/NOTES.md` holds two tables of rivals. The iOS one is durable and
 * the web one rots, and the difference is one line: the iOS table records the
 * command that re-derives it —
 *
 *     curl -s "https://itunes.apple.com/lookup?id=6504097981,1574737998,1296604457"
 *
 * — and the web table records prose. On 2026-08-28, five of its rows read
 * "carried from 08-22" or similar, six days after anybody had looked. That is
 * the constitution's Gates argument exactly: a command is re-derived every time
 * it is read and a figure rots in place while the document around it still
 * reads as true.
 *
 * **And the reason it could not be re-run was smaller than it looked: the
 * table named five rivals and recorded an address for none of them.** Not a
 * URL, not a package id, nothing. A claim whose subject has no locator cannot
 * be checked by anybody, which is why six days passed. The roster below is
 * that missing half.
 *
 * Reported, never gated. A rival changing their price is news, not a defect in
 * this repository, and a check that turns CI red when somebody else edits
 * their own landing page is a check that gets deleted the first week.
 */

/**
 * What absence of a needle is allowed to mean.
 *
 * `refuted` — the page is where this claim lives, so not finding it is
 *   evidence the claim has stopped being true.
 * `unknown` — the claim could be true and simply not visible here: a price
 *   behind a login, a figure on a page this does not fetch. Measured
 *   2026-08-28: leelaquest.com's landing page links nothing matching
 *   pric|plan|buy|credit|subscri, so its per-game price is not refutable from
 *   the one page there is, and saying "gone" would be a louder lie than saying
 *   nothing.
 */
export const ABSENCE = { refuted: 'refuted', unknown: 'unknown' };

/**
 * Every rival, with the address that makes it checkable.
 *
 * `calibration` is the needle that must be present if the fetch reached the
 * right page at all. It is not decoration: probing nine domains on 2026-08-28
 * with a shared temporary file, three failed fetches left the PREVIOUS page in
 * it and reported that page's byte count and hit counts as their own. A zero —
 * or a number — from a probe that never loaded is worse than no probe.
 */
export const RIVALS = [
  {
    name: 'Leela Quest',
    at: 'https://leelaquest.com/',
    shape: 'browser board, credits',
    // Not `/board/i`, which is also what the first claim asks: a calibration
    // that is its own claim reports a dead site every time the claim changes.
    calibration: /leela/i,
    claims: [
      { says: 'plays in a browser', needle: /board/i, absence: ABSENCE.refuted },
      { says: 'about $4.99 a game', needle: /4\.99/, absence: ABSENCE.unknown },
    ],
  },
  {
    name: 'quantumgame.love',
    at: 'https://quantumgame.love/',
    shape: 'browser + AI guide, solo by design',
    calibration: /leela/i,
    claims: [
      { says: '1490 ₽ on the page', needle: /1490/, absence: ABSENCE.refuted },
    ],
  },
  {
    name: 'com.vtm.lila',
    at: 'https://play.google.com/store/apps/details?id=com.vtm.lila&hl=en',
    shape: 'Android, ads, "Leela Chakra" in its title',
    calibration: /Google Play/,
    claims: [
      { says: '10,000+ installs', needle: /10,000\+|10K\+/, absence: ABSENCE.refuted },
      { says: 'carries ads', needle: /Contains ads/, absence: ABSENCE.refuted },
      { says: 'uses our name', needle: /Leela Chakra/, absence: ABSENCE.refuted },
    ],
  },
  {
    name: 'LeelaRoom',
    at: 'https://leelaroom.com/',
    shape: 'facilitator business',
    calibration: /leela/i,
    claims: [{ says: 'reaches players through Telegram', needle: /t\.me\//, absence: ABSENCE.refuted }],
  },
  {
    name: 'MAGICLEELA',
    at: 'https://magicleela.com/',
    shape: 'facilitator business',
    calibration: /leela/i,
    claims: [{ says: 'reaches players through Telegram', needle: /t\.me\//, absence: ABSENCE.refuted }],
  },
];

/**
 * The rivals this cannot check, and why — kept beside the roster on purpose.
 *
 * A row nobody can reach is not a row that quietly disappears. Both of these
 * were in the NOTES table on 2026-08-28 with no address, and both stay named
 * here so the gap is visible rather than tidied away.
 */
export const WITHOUT_AN_ADDRESS = [
  {
    name: 'OMKARA',
    why: 'no address on record. Probed 2026-08-28 and none resolves: omkara.love, omkara.com, omkara.school, omkaraleela.com, omkara.info. omkara.ru answers 200 and mentions Leela zero times, so it is a different business. The owner has dealt with them — the backlog cites their 3,000+ facilitators — and one line from him makes this row checkable.',
  },
  {
    name: 'the ChatGPT-prompt Leela (vc.ru, 08-2026)',
    why: 'no article URL was ever recorded, and a search result is not a locator: naming the wrong article would be worse than naming none.',
  },
];

/**
 * What one rival's page says about the claims made of it.
 *
 * `html` null means the fetch failed. That is `unreachable` for the whole
 * rival, never `gone` for its claims — the difference between "they took the
 * price down" and "the wifi dropped" is the entire value of this file.
 */
export function readClaims(rival, html) {
  if (html === null || html === undefined) {
    return { name: rival.name, reached: false, why: 'the fetch did not answer', claims: [] };
  }

  if (!rival.calibration.test(html)) {
    return {
      name: rival.name,
      reached: false,
      // Said this way round deliberately: the page loaded and is the wrong
      // page, which is a different fact from a dead host and is the one a
      // reader will otherwise mistake for a refutation.
      why: `answered, but nothing matched ${String(rival.calibration)} — this is not the page the claims are about`,
      claims: [],
    };
  }

  return {
    name: rival.name,
    reached: true,
    why: '',
    claims: rival.claims.map((claim) => {
      const found = claim.needle.test(html);
      return {
        says: claim.says,
        found,
        verdict: found ? 'holds' : claim.absence === ABSENCE.refuted ? 'GONE' : 'not shown here',
      };
    }),
  };
}

/** The report, in the shape a person reads and a journal entry can quote. */
export function describeRivals(rows, missing, stamp) {
  const lines = [`The field, measured ${stamp} UTC`, ''];

  for (const row of rows) {
    if (!row.reached) {
      lines.push(`  ${row.name}: NOT REACHED — ${row.why}`);
      continue;
    }
    lines.push(`  ${row.name}`);
    for (const claim of row.claims) lines.push(`    ${claim.says.padEnd(34)} ${claim.verdict}`);
  }

  if (missing.length > 0) {
    lines.push('', 'Named in NOTES.md and not checkable from here:');
    for (const one of missing) lines.push(`  ${one.name} — ${one.why}`);
  }

  const gone = rows.flatMap((row) => row.claims.filter((claim) => claim.verdict === 'GONE'));
  lines.push(
    '',
    gone.length === 0
      ? 'Every claim that could be checked still holds.'
      : `${gone.length} claim(s) no longer hold and NOTES.md says otherwise.`,
  );

  return lines.join('\n');
}
