/**
 * Where everything stands, in one command.
 *
 *     node scripts/status.mjs            # print it
 *     node scripts/status.mjs --html     # and write status.html beside it
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

const run = promisify(execFile);

/** Every surface, as {name, what} rows the report and the page share. */
const findings = [];

const say = (surface, name, value, note = '') => findings.push({ surface, name, value, note });
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
  say('web', 'the 3D board', 'UNREACHABLE', page.ok ? `status ${page.status}` : page.why);
} else {
  const entryName = /src="\.\/(assets\/[A-Za-z0-9._-]+\.js)"/.exec(page.text)?.[1];
  say('web', 'the 3D board', 'live', `${page.ms} ms`);

  if (entryName === undefined) {
    say('web', 'the entry', 'NOT NAMED BY THE PAGE', 'the page loads no code of its own');
  } else {
    const entry = await reach(site + entryName);
    const declared = entry.headers?.get('content-length');
    say(
      'web',
      'the entry',
      `${bytes(new TextEncoder().encode(entry.text).length)} b`,
      declared === null || declared === undefined ? 'wire size not declared' : `${bytes(Number(declared))} b on the wire`,
    );

    // What a reader actually pays: every chunk the entry names, plus the
    // largest language — the same arithmetic the deployment check makes.
    const named = [...new Set([...entry.text.matchAll(/["'`]\.\/([A-Za-z0-9._-]+\.js)["'`]/g)].map((m) => m[1]))];
    const weighed = [];
    for (const chunk of named) {
      const got = await reach(`${site}assets/${chunk}`);
      weighed.push({ chunk, size: got.ok && got.status === 200 ? new TextEncoder().encode(got.text).length : 0 });
    }
    const languages = weighed.filter((one) => one.chunk.startsWith('plans.'));
    const always = weighed.filter((one) => !one.chunk.startsWith('plans.'));
    const heaviest = languages.reduce((worst, one) => (one.size > (worst?.size ?? 0) ? one : worst), null);
    const cost = new TextEncoder().encode(entry.text).length + always.reduce((all, one) => all + one.size, 0) + (heaviest?.size ?? 0);

    say('web', 'what a reader downloads', `${bytes(cost)} b`, `${languages.length} languages built, one fetched`);
  }
}

// --- the companion -----------------------------------------------------------

const ask = await reach('https://leela-production-e9a0.up.railway.app/api/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://t27.ai' },
  body: JSON.stringify({ question: 'ping', system: 'reply with the single word pong' }),
});

if (!ask.ok || ask.status !== 200) {
  say('bot', 'the companion route', 'UNREACHABLE', ask.ok ? `status ${ask.status}` : ask.why);
} else {
  const answered = /"text":"([^"]*)"/.exec(ask.text)?.[1] ?? '';
  const thought = (ask.text.match(/"thinking"/g) ?? []).length;
  say('bot', 'the companion route', answered === '' ? 'ANSWERED NOTHING' : `answers "${answered}"`, `${ask.ms} ms, ${thought} reasoning deltas`);
}

// --- what is deployed, which needs the tools that hold the credentials -------

const railway = await run('railway', ['deployment', 'list'], { cwd: process.cwd() }).catch(() => null);
if (railway === null) {
  say('bot', 'the last deploy', 'NOT ASKED', 'the railway CLI did not answer here');
} else {
  const newest = railway.stdout.split('\n').find((line) => line.includes('|'));
  const [id, state, when] = (newest ?? '').split('|').map((part) => part.trim());
  say('bot', 'the last deploy', `${state ?? '?'} ${when ?? ''}`.trim(), (id ?? '').slice(0, 8));
}

// --- iOS, whose public half needs no key at all ------------------------------

const store = await reach('https://itunes.apple.com/lookup?bundleId=xyz.ghashtag.dharma');
if (!store.ok) {
  say('ios', 'the shopfront', 'UNREACHABLE', store.why);
} else {
  const found = JSON.parse(store.text).results?.[0];
  say(
    'ios',
    'the shopfront',
    found ? `${found.version}, updated ${String(found.currentVersionReleaseDate).slice(0, 10)}` : 'NOT LISTED',
    found ? `${found.userRatingCount ?? 0} ratings, ${found.formattedPrice}` : '',
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

const wrong = findings.filter((line) => /^[A-Z ]+$/.test(line.value));
console.log(
  wrong.length === 0
    ? '\nEvery surface answered.'
    : `\n${wrong.length} did not answer: ${wrong.map((one) => one.name).join(', ')}`,
);

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
