#!/usr/bin/env bun
/**
 * Is the live bot serving the texts this repository holds?
 *
 *     bun scripts/audit-serving.mjs [url]
 *
 * Written 2026-08-29, because the answer was **no** and nothing said so.
 *
 * The web surfaces rebuild themselves: `pages.yml` runs on every push, so a
 * repair to the book is in front of a reader as soon as CI is green. The bot
 * is shipped by hand. `LOOP.md` has said so in prose for weeks — *THE BOT DOES
 * NOT DEPLOY ITSELF... the bot runs OLD CODE however green CI is* — and three
 * consecutive iterations repaired the dataset, read that paragraph, and did
 * not run `railway up`. On the morning this was written the last successful
 * deployment was 2026-08-28 19:39 and the repairs had landed at 04:57 and
 * 06:12 the next day, so the bot was still telling an Urdu player they stood
 * on `۔ Astral Plane` and still printing `& Nbsp; & nbsp;` into the sixth
 * Malay plan. Both were fixed, both were green, neither had arrived.
 *
 * A paragraph asking six iterations to remember something is not a guard.
 *
 * Needs: the network and the live bot. **Deliberately not in CI**, and excused
 *        by name in `package.json` — a gate that goes red because Railway was
 *        restarting is a gate people learn to ignore.
 *
 * It asks with an `OPTIONS` preflight: answered before any question is read,
 * it spends no model tokens, writes nothing, and sends nobody a message. The
 * origin header is required by the route and `https://t27.ai` is the board's
 * own, which is the one this is checking on behalf of.
 *
 * Three exits, because there are three states: **0** the bot serves what this
 * checkout holds, **1** it does not, **2** nothing could be established. See
 * `lib/serving.mjs` for why the third is not folded into either of the others.
 */

import { execFileSync } from 'node:child_process';

import { fingerprintOf, DATA_DIR } from '../apps/bot/src/serving.ts';
import { finish } from './lib/report.mjs';
import { exitCodeFor, fingerprintFrom, verdict } from './lib/serving.mjs';

const URL_TO_ASK = process.argv[2] ?? 'https://leela-production-e9a0.up.railway.app/api/ask';
const ORIGIN = 'https://t27.ai';
const TIMEOUT_MS = 20_000;

/** The live bot's headers, or null if it did not answer at all. */
async function askLive(url) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), TIMEOUT_MS);
  try {
    const answer = await fetch(url, {
      method: 'OPTIONS',
      headers: { origin: ORIGIN, 'access-control-request-method': 'POST' },
      signal: stop.signal,
    });
    return { headers: answer.headers, status: answer.status };
  } catch (error) {
    return { headers: null, status: null, error: String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/** The commits a hand-deployed bot could be missing. Informational only. */
function recentlyChanged() {
  try {
    return execFileSync(
      'git',
      ['log', '-6', '--format=%h  %ci  %s', '--', 'apps/bot', 'packages'],
      { encoding: 'utf8' },
    )
      .trimEnd()
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

const expected = fingerprintOf(DATA_DIR);
const live = await askLive(URL_TO_ASK);
const served = live.headers === null ? null : fingerprintFrom(live.headers);
const answer = verdict(expected, served);

const reached =
  live.headers === null
    ? `  the bot did not answer: ${live.error}`
    : `  the bot answered OPTIONS with ${live.status}`;

const deploy =
  '\nThe bot is deployed by hand and nothing else will do it:\n' +
  '  railway link -p Leela -s leela -e production\n' +
  '  railway up --service leela --detach\n' +
  'then read the banner with `railway logs --service leela`.\n\n' +
  'Commits touching apps/bot or packages, newest first — the bot is missing\n' +
  'every one of these that is newer than its deployment:\n' +
  recentlyChanged()
    .map((line) => `  ${line}`)
    .join('\n');

/**
 * The alarm, whichever alarm it is.
 *
 * `unknown` has lines too, and that is the whole reason this is one section
 * rather than an `if` after the report. `finish` prints its all-clear when no
 * failing section has anything to say — so a state that says nothing gets
 * *The live bot is serving null, exactly* printed under it, which is the
 * false all-clear that module was written to abolish. Nothing established is
 * something to say.
 */
const alarm = {
  stale: {
    heading: `\nThe live bot is not serving this checkout's texts:\n`,
    epilogue: deploy,
  },
  unknown: {
    heading: '\nNOTHING WAS ESTABLISHED — this is not a pass:\n',
    epilogue: deploy,
  },
}[answer.state];

const code = finish({
  allClear: `The live bot is serving ${served} — the texts in this checkout, exactly.`,
  sections: [
    {
      failing: false,
      lines: [
        `\nAsked ${URL_TO_ASK} as ${ORIGIN}, with an OPTIONS preflight: no question,`,
        'no tokens, no message to anybody.',
        reached,
        `  this checkout fingerprints ${DATA_DIR.replace(`${process.cwd()}/`, '')} as ${expected ?? '(unreadable)'}`,
      ],
    },
    {
      failing: true,
      heading: alarm?.heading,
      lines: alarm ? [`  ${answer.why}`] : [],
      epilogue: alarm?.epilogue,
    },
  ],
});

// The two must agree about whether anything is wrong, and they disagree only
// in HOW wrong: `finish` knows 0 and 1, and `exitCodeFor` splits its 1 into
// *the answer is no* and *there is no answer*. A run where `finish` printed
// the all-clear and the verdict was not `serving` would be the exact defect
// `report.mjs` exists to prevent, so it is checked rather than assumed.
if ((code === 0) !== (answer.state === 'serving')) {
  throw new Error(`the report printed ${code === 0 ? 'an all-clear' : 'an alarm'} for a "${answer.state}" verdict`);
}

process.exitCode = exitCodeFor(answer.state);
