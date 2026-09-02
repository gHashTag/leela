#!/usr/bin/env bun
/** Prove that production returns an answer without printing that answer. */

import { spawnSync } from 'node:child_process';
import {
  liveAIExitCode,
  liveAIRemoteExitCode,
  liveAIVerdict,
} from '../apps/bot/src/live-ai-monitor.ts';

const inside = process.argv.includes('--inside');

if (!inside) {
  const remote = spawnSync(
    'railway',
    ['ssh', 'bun', 'run', 'scripts/monitor-live-ai.mjs', '--inside'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 60_000 },
  );
  if (remote.error || remote.status === null) {
    console.log('UNKNOWN — Railway did not run the companion canary.');
    process.exit(2);
  }

  const exitCode = liveAIRemoteExitCode(remote.status, remote.stdout);
  const label = exitCode === 0 ? 'PASS' : exitCode === 1 ? 'FAIL' : 'UNKNOWN';
  const line = remote.stdout.split(/\r?\n/).find((candidate) => candidate.startsWith(`${label} — `));
  console.log(line ?? 'UNKNOWN — Railway did not return a valid companion verdict.');
  process.exit(exitCode);
}

const domain = process.env.RAILWAY_PUBLIC_DOMAIN ?? '';
if (domain === '') {
  console.log('UNKNOWN — the active container lacks its public domain.');
  process.exit(2);
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 45_000);
let observation = null;
try {
  const response = await fetch(`https://${domain}/api/ask`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'content-type': 'application/json',
      origin: `https://${domain}`,
    },
    body: JSON.stringify({
      system: 'You are a service health check. Reply with one short word.',
      question: 'Are you available?',
    }),
  });
  observation = {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    body: await response.text(),
  };
} catch {
  observation = null;
} finally {
  clearTimeout(timer);
}

const verdict = liveAIVerdict(observation);
const label = verdict.state === 'passing' ? 'PASS' : verdict.state === 'failing' ? 'FAIL' : 'UNKNOWN';
console.log(`${label} — ${verdict.why}.`);
process.exit(liveAIExitCode(verdict.state));
