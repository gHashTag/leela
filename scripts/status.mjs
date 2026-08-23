#!/usr/bin/env bun
/**
 * Where everything stands, in one command.
 *
 *     bun scripts/status.mjs             # print it
 *     bun scripts/status.mjs --html      # and write status.html beside it
 *
 * Written 2026-08-23, because the honest answer to "what is the status?" had
 * been a person asking an agent, and an agent reading four places and
 * remembering wrong. Three separate findings that week were of the same shape:
 * the deployed bot was four commits behind its branch, a document had six
 * false claims about the board, and the map named a worktree that did not
 * exist. Each was a belief nobody had measured.
 *
 * So this measures. **Every line either comes from a live probe or says it
 * could not be reached.** Nothing here restates a number from a document, and
 * nothing is cached: the point is to be re-run.
 *
 * What it cannot see, and says so rather than guessing: the bot's own logs and
 * App Store Connect both need credentials, so they are probed only when the
 * tools that hold those credentials are on this machine.
 */

import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { promisify } from 'node:util';

/**
 * The deployment check's own arithmetic, imported rather than repeated.
 *
 * This file computed what a reader downloads itself for its first day, with a
 * comment saying it was "derived here rather than imported because this script
 * must run against a deployment without the repository's test setup around
 * it". That was a reimplementation, and duplication is the one thing this
 * repository has reliably shown to rot: two answers to "what does a reader
 * pay" would have drifted, and the drift would have shown up as a dashboard
 * disagreeing with a CI gate about the same live site.
 *
 * It costs a shebang. `bun` resolves TypeScript and `node` does not, which is
 * why `audit-dataset.mjs` is invoked the same way — and why `audit-copies.mjs`
 * silently failed under `node` for as long as anybody had run it.
 */
import { chunksIn, readerCost } from '../apps/miniapp/src/smoke.ts';

const run = promisify(execFile);

/** Every surface, as rows the report and the page share. */
const findings = [];

/**
 * One line, and what kind of line it is — stated, never inferred.
 *
 * The first version of this file decided that a line was a failure by testing
 * its text against `/^[A-Z ]+$/`, which caught `UNREACHABLE` and also caught
 * `NOT ASKED`. So on any machine without the railway CLI — which is most of
 * them — this tool reported a failure where there was none, and a status tool
 * that cries wolf is a status tool nobody runs. It lasted about an hour.
 *
 * `kind` is now a fact each probe states about itself:
 *   fine    — measured, and the answer is what it should be
 *   wrong   — measured, and something is broken
 *   unasked — not measured here, because the credentials or the tool are
 *             elsewhere. Not a failure, and never counted as one.
 */
const say = (surface, name, value, note = '', kind = 'fine') =>
  findings.push({ surface, name, value, note, kind });
const bytes = (n) => n.toLocaleString('en-US');

/**
 * Fetch with a deadline, answering with a shape rather than throwing.
 *
 * A probe that throws takes the whole report down, and a report that is
 * missing because one host was slow is worse than a report with one line
 * reading "unreachable".
 */
async function reach(url, init = {}) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 45_000);
  try {
    const began = Date.now();
    const response = await fetch(url, { ...init, signal: stop.signal });
    const text = await response.text();
    return { ok: true, status: response.status, text, ms: Date.now() - began, headers: response.headers };
  } catch (error) {
    return { ok: false, why: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

// --- the web board -----------------------------------------------------------

const site = 'https://t27.ai/leela/';
const page = await reach(site);

if (!page.ok || page.status !== 200) {
  say('web', 'the 3D board', 'UNREACHABLE', page.ok ? `status ${page.status}` : page.why, 'wrong');
} else {
  const entryName = /src="\.\/(assets\/[A-Za-z0-9._-]+\.js)"/.exec(page.text)?.[1];
  say('web', 'the 3D board', 'live', `${page.ms} ms`);

  if (entryName === undefined) {
    say('web', 'the entry', 'NOT NAMED BY THE PAGE', 'the page loads no code of its own', 'wrong');
  } else {
    const entry = await reach(site + entryName);
    const declared = entry.headers?.get('content-length');
    say(
      'web',
      'the entry',
      `${bytes(new TextEncoder().encode(entry.text).length)} b`,
      declared === null || declared === undefined ? 'wire size not declared' : `${bytes(Number(declared))} b on the wire`,
    );

    // What a reader actually pays, by the deployment check's own reckoning:
    // everything the entry names, plus the largest of the languages, because
    // twenty-one are built and one is fetched.
    const weighed = [{ name: 'entry', bytes: new TextEncoder().encode(entry.text).length }];
    for (const chunk of chunksIn(entry.text)) {
      const got = await reach(`${site}assets/${chunk}`);
      weighed.push({
        name: chunk,
        bytes: got.ok && got.status === 200 ? new TextEncoder().encode(got.text).length : 0,
      });
    }

    const cost = readerCost(weighed, 'plans.');
    const languages = weighed.filter((one) => one.name.startsWith('plans.')).length;

    say('web', 'what a reader downloads', `${bytes(cost.bytes)} b`, `${languages} languages built, one fetched`);
  }
}

// --- the companion -----------------------------------------------------------

const ask = await reach('https://leela-production-e9a0.up.railway.app/api/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://t27.ai' },
  body: JSON.stringify({ question: 'ping', system: 'reply with the single word pong' }),
});

if (!ask.ok || ask.status !== 200) {
  say('bot', 'the companion route', 'UNREACHABLE', ask.ok ? `status ${ask.status}` : ask.why, 'wrong');
} else {
  const answered = /"text":"([^"]*)"/.exec(ask.text)?.[1] ?? '';
  const thought = (ask.text.match(/"thinking"/g) ?? []).length;
  say('bot', 'the companion route', answered === '' ? 'ANSWERED NOTHING' : `answers "${answered}"`, `${ask.ms} ms, ${thought} reasoning deltas`);
}

// --- what is deployed, which needs the tools that hold the credentials -------

const railway = await run('railway', ['deployment', 'list'], { cwd: process.cwd() }).catch(() => null);
if (railway === null) {
  say('bot', 'the last deploy', 'not asked', 'the railway CLI did not answer here', 'unasked');
} else {
  const newest = railway.stdout.split('\n').find((line) => line.includes('|'));
  const [id, state, when] = (newest ?? '').split('|').map((part) => part.trim());
  say('bot', 'the last deploy', `${state ?? '?'} ${when ?? ''}`.trim(), (id ?? '').slice(0, 8));
}

/**
 * Which release the bot is running, from the one line only new code prints.
 *
 * `railway logs` is the only way to see inside a container this loop does not
 * hold a shell in, and the banner was made a measurement on 2026-08-23 for
 * exactly this: `Plan text: all 22 languages are in memory.` is printed by
 * releases from that day onward and by none before, so its presence dates the
 * running code and its number says the startup load finished.
 */
const logs = await run('railway', ['logs', '--service', 'leela'], { timeout: 90_000 }).catch(() => null);
if (logs === null) {
  say('bot', 'the running release', 'not asked', 'the railway CLI did not answer here', 'unasked');
} else {
  const banner = /Plan text: ([^\n]*)/.exec(logs.stdout)?.[1];
  const alive = logs.stdout.includes('Listening as @leela_chakra_ai_bot');
  say(
    'bot',
    'the running release',
    banner === undefined ? 'BEFORE 2026-08-23' : banner.replace(/\.$/, ''),
    banner === undefined
      ? 'no plan-text line in the log — the release predates it'
      : alive
        ? 'and listening'
        : 'but no "Listening as" line in this window',
    banner === undefined ? 'wrong' : 'fine',
  );
}

// --- iOS, whose public half needs no key at all ------------------------------

const store = await reach('https://itunes.apple.com/lookup?bundleId=xyz.ghashtag.dharma');
if (!store.ok) {
  say('ios', 'the shopfront', 'UNREACHABLE', store.why, 'wrong');
} else {
  const found = JSON.parse(store.text).results?.[0];
  say(
    'ios',
    'the shopfront',
    found ? `${found.version}, updated ${String(found.currentVersionReleaseDate).slice(0, 10)}` : 'NOT LISTED',
    found ? `${found.userRatingCount ?? 0} ratings, ${found.formattedPrice}` : '',
    found ? 'fine' : 'wrong',
  );
}

/**
 * And the half of iOS that needs a key, asked through the script that holds it.
 *
 * `leela-src/leela/scripts/asc-state.mjs` signs its own token and is read-only.
 * Shelled out to rather than reimplemented here: the signing is fifteen fiddly
 * lines, and two copies of it would disagree within a fortnight.
 *
 * The line worth having is the last one — a version in PREPARE_FOR_SUBMISSION
 * is a version waiting for a human, and no other surface can tell that apart
 * from a version that shipped.
 */
const ascScript = `${process.env.HOME}/leela-src/leela/scripts/asc-state.mjs`;
const asc = await run('node', [ascScript], { timeout: 120_000 }).catch(() => null);
if (asc === null) {
  // Both rows, not one. A row that disappears when a probe cannot run is a row
  // the reader does not notice is missing, and "nothing staged" and "I could
  // not look" are the two answers this report must never conflate.
  say('ios', 'TestFlight', 'not asked', 'no App Store Connect key on this machine', 'unasked');
  say('ios', 'waiting for a press', 'not asked', 'the same key would answer it', 'unasked');
} else {
  const build = /build (\d+): (\w+)/.exec(asc.stdout);
  say('ios', 'TestFlight', build ? `build ${build[1]}, ${build[2]}` : 'NO BUILD LISTED', '', build ? 'fine' : 'wrong');

  const waiting = /^\s+([\d.]+): PREPARE_FOR_SUBMISSION/m.exec(asc.stdout);
  say(
    'ios',
    'waiting for a press',
    waiting ? `${waiting[1]} is staged` : 'nothing staged',
    waiting ? 'Add for Review is the owner\'s, not this loop\'s' : '',
  );
}

// --- the report --------------------------------------------------------------

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
console.log(`Leela, measured ${stamp} UTC\n`);

let surface = '';
for (const line of findings) {
  if (line.surface !== surface) {
    surface = line.surface;
    console.log(`  ${surface}`);
  }
  console.log(`    ${line.name.padEnd(26)} ${line.value}${line.note ? `   (${line.note})` : ''}`);
}

const wrong = findings.filter((line) => line.kind === 'wrong');
const unasked = findings.filter((line) => line.kind === 'unasked');
console.log(
  wrong.length === 0
    ? '\nEverything asked is well.'
    : `\n${wrong.length} wrong: ${wrong.map((one) => one.name).join(', ')}`,
);
if (unasked.length > 0) {
  // Said separately and on purpose: what was not measured is not a verdict,
  // and the reader deserves to know which of the lines above are silence.
  console.log(`Not asked here: ${unasked.map((one) => one.name).join(', ')}`);
}

if (process.argv.includes('--html')) {
  const rows = findings
    .map(
      (line) =>
        `<tr><td>${line.surface}</td><td>${line.name}</td><td class="v">${line.value}</td><td class="n">${line.note}</td></tr>`,
    )
    .join('\n');
  writeFileSync(
    new URL('../status.html', import.meta.url),
    `<!doctype html><meta charset="utf-8"><title>Leela — where everything stands</title>
<style>body{font:15px/1.6 ui-monospace,monospace;max-width:46rem;margin:3rem auto;padding:0 1rem}
h1{font-size:1.1rem;font-weight:600}table{border-collapse:collapse;width:100%}
td{padding:.3rem .6rem;border-bottom:1px solid #8883}.v{font-weight:600}.n{opacity:.6}
p{opacity:.6}</style>
<h1>Leela — where everything stands</h1>
<p>Measured ${stamp} UTC. Re-run <code>node scripts/status.mjs --html</code>; nothing here is cached.</p>
<table>${rows}</table>`,
  );
  console.log('\nWrote status.html');
}

process.exit(wrong.length === 0 ? 0 : 1);
