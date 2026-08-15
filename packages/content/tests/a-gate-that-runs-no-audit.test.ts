import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The command this repository tells a person to run has to be able to go red
 * for the reasons the push goes red.
 *
 * MEASURED on 2026-08-06, before this file existed: `verify` in the root
 * manifest was `content:build && typecheck && typecheck:strict && test`, and
 * not one of the twenty audits under `scripts/` was in it. On that same tree
 * `node scripts/audit-claims.mjs` exited 1 with five stale rows. So the gate a
 * contributor runs said green while the gate CI runs said red, and the
 * disagreement had nothing to do with the code — which is the exact shape of
 * defect this repository keeps finding: a check that reads as available and is
 * not, and an absent audit that looks identical to a passing one.
 *
 * The repair is a root `audit` script inside `verify`. What this file guards is
 * not that script's list — it must not have one. It guards the SHAPE:
 *
 *   (a) whatever `scripts/audit-*.mjs` holds at the moment the test runs, every
 *       file in it is either startable by the gate or named in the exclusion
 *       table with a reason somebody wrote. Neither side is hardcoded here: the
 *       disk is read, the table is read out of `package.json`, and the two are
 *       required to partition it. An audit added tomorrow is therefore run
 *       tomorrow, or the gate is red until somebody says why it cannot be;
 *
 *   (b) the table cannot switch off the check it belongs to. An exemption list
 *       that grows to cover everything is this repository's own recorded
 *       failure — a list that stops suppressing anything, a check that decides
 *       to fail and prints the all-clear — so a table covering every audit on
 *       disk, or naming a file nobody has, is a failing state and not a quiet
 *       one;
 *
 *   (c) `verify` actually contains the step, parsed out of the script rather
 *       than compared as a line, because a string equality here would break on
 *       a new step being added and would pass on `audit` being moved to a
 *       comment at the end.
 *
 * And the gate's behaviour is asserted against a made-up tree rather than
 * against this repository, for the reason `scripts/lib/runnable.mjs` gives
 * about its own injected reader: a behavioural test over the real `scripts/`
 * directory is one that passes until somebody edits a file. The last three
 * cases below run the exact command string out of `package.json` — not a copy
 * of its logic — in a temporary directory holding three audits it has never
 * heard of, and require it to run the ones with no excuse, skip the one with
 * an excuse, fail on the one that fails, refuse a file with no shebang, and
 * refuse to pass when the table covers everything.
 *
 * BROKEN ON PURPOSE before being trusted, and these messages were copied off
 * the runs rather than imagined.
 *
 * `printf 'process.exit(0)\n' > scripts/audit-nothing.mjs` — a file with no
 * shebang, which is what a new audit looks like before anybody has decided how
 * to start it — and (a) fails:
 *
 *   AssertionError: neither run by `bun run audit` nor excused in
 *   package.json > auditsThisGateCannotRun: expected [ 'scripts/audit-nothing.mjs
 *   (no shebang, so nothing says how to start it)' ] to deeply equal []
 *
 * Copying every path on disk into the exclusion table fails (b) rather than
 * passing with an empty runner:
 *
 *   AssertionError: the exclusion table covers every audit on disk, so the gate
 *   runs nothing - which reads exactly like a gate that passes: expected 0 to be
 *   greater than 0
 *
 * Both were restored afterwards and every case here went green again.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

type Manifest = {
  scripts: Record<string, string>;
  auditsThisGateCannotRun?: Record<string, string>;
};

const manifest = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as Manifest;

/** The exclusion table, as the gate itself reads it: blank is not an excuse. */
const excused = new Map<string, string>(
  Object.entries(manifest.auditsThisGateCannotRun ?? {}).map(([path, why]) => [
    path,
    String(why ?? '').trim(),
  ]),
);

/** Every audit the directory holds right now, in the gate's own spelling. */
const onDisk = readdirSync(join(REPO, 'scripts'))
  .filter((name) => name.startsWith('audit-') && name.endsWith('.mjs'))
  .sort()
  .map((name) => `scripts/${name}`);

/** The runtime a script's shebang names, or null — the same rule the gate uses. */
const runtimeOf = (path: string): string | null =>
  readFileSync(join(REPO, path), 'utf8').match(/^#!\s*\/usr\/bin\/env\s+(\w+)/)?.[1] ?? null;

/** Whether a runtime is a program this machine could actually start. */
const onPath = (runtime: string): boolean => {
  try {
    execFileSync('sh', ['-c', `command -v ${runtime}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

/**
 * Why an audit is not covered, or null when it is.
 *
 * "Covered" is two things and neither is assumed: excused with a reason
 * somebody wrote, or startable — a shebang naming a runtime that exists here.
 * A file with neither is the one this whole test is about, and it is precisely
 * what a new audit looks like on the day it is added.
 */
function uncovered(path: string): string | null {
  if ((excused.get(path) ?? '') !== '') return null;

  const runtime = runtimeOf(path);
  if (runtime === null) return `${path} (no shebang, so nothing says how to start it)`;
  if (!onPath(runtime)) return `${path} (declares ${runtime}, which is not on this machine)`;
  return null;
}

/** The steps of a `&&` chain, each trimmed — how a shell reads it, near enough. */
const stepsOf = (script: string): string[] =>
  script
    .split('&&')
    .map((step) => step.trim())
    .filter((step) => step !== '');

/** Somewhere under the OS temp directory, holding a manifest and some audits. */
function madeUpTree(audits: Record<string, string>, table: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'leela-gate-'));
  mkdirSync(join(root, 'scripts'));
  for (const [name, body] of Object.entries(audits)) writeFileSync(join(root, 'scripts', name), body);
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ scripts: manifest.scripts, auditsThisGateCannotRun: table }, null, 2),
  );
  return root;
}

/** Run the real `audit` command, as written, in a directory of our own. */
function runGate(root: string): { code: number; output: string } {
  try {
    const output = execSync(manifest.scripts.audit ?? '', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      code: failure.status ?? -1,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
    };
  }
}

const SAYS_NOTHING = '#!/usr/bin/env node\nprocess.exit(0);\n';
const SAYS_NO = '#!/usr/bin/env node\nconsole.log("a fault");\nprocess.exit(1);\n';

describe('a gate that runs no audit', () => {
  it('runs or excuses every audit on disk, whatever the directory holds today', () => {
    expect(onDisk.length, 'no audits found at all, so nothing below would mean anything').toBeGreaterThan(0);

    expect(
      onDisk.map(uncovered).filter((problem): problem is string => problem !== null),
      'neither run by `bun run audit` nor excused in package.json > auditsThisGateCannotRun',
    ).toEqual([]);
  });

  it('excuses only files that are there, and only with a reason', () => {
    expect(
      [...excused.keys()].filter((path) => !onDisk.includes(path)),
      'excused, and not on disk - an exemption that has stopped describing anything',
    ).toEqual([]);

    expect(
      [...excused.entries()].filter(([, why]) => why === '').map(([path]) => path),
      'named in the table with no reason, which excuses nothing and hides it anyway',
    ).toEqual([]);
  });

  it('cannot switch off its own check by excusing everything', () => {
    const runs = onDisk.filter((path) => (excused.get(path) ?? '') === '');

    expect(
      runs.length,
      'the exclusion table covers every audit on disk, so the gate runs nothing - which reads exactly like a gate that passes',
    ).toBeGreaterThan(0);
    expect(excused.size, 'the table is not a subset of the directory').toBeLessThan(onDisk.length);
  });

  it('names no audit, so the set cannot be a list somebody keeps by hand', () => {
    expect(
      [...(manifest.scripts.audit ?? '').matchAll(/audit-[\w-]+\.mjs/g)].map(([found]) => found),
      'the gate spells an audit out, and a written list is one that goes stale',
    ).toEqual([]);
  });

  it('is a step of verify, and runs before the suites', () => {
    const steps = stepsOf(manifest.scripts.verify ?? '');
    const audit = steps.findIndex((step) => /(^|\s)audit$/.test(step));
    const test = steps.findIndex((step) => /(^|\s)test$/.test(step));

    expect(audit, `verify runs no audit step: ${steps.join(' | ')}`).toBeGreaterThan(-1);
    expect(test, `verify runs no test step: ${steps.join(' | ')}`).toBeGreaterThan(-1);
    expect(audit, 'the audits run after the suites, so the cheap red arrives last').toBeLessThan(test);
  });

  it('runs what it finds, skips what is excused, and fails on what fails', () => {
    const root = madeUpTree(
      { 'audit-alpha.mjs': SAYS_NOTHING, 'audit-beta.mjs': SAYS_NO, 'audit-gamma.mjs': SAYS_NO },
      { 'scripts/audit-gamma.mjs': 'a made-up reason, for a made-up audit' },
    );
    try {
      const { code, output } = runGate(root);

      expect(output, 'the excused audit was started anyway').not.toMatch(/--- \w+ scripts\/audit-gamma\.mjs/);
      expect(output, 'the audit with no excuse was never started').toMatch(/--- node scripts\/audit-alpha\.mjs/);
      expect(output, 'the reason for the exemption was not printed').toContain('a made-up reason');
      expect(output, 'the failing audit was not named').toContain('scripts/audit-beta.mjs');
      expect(code, 'an audit exited 1 and the gate did not').not.toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses an audit nothing says how to start', () => {
    const root = madeUpTree({ 'audit-alpha.mjs': SAYS_NOTHING, 'audit-nameless.mjs': 'process.exit(0);\n' }, {});
    try {
      const { code, output } = runGate(root);

      expect(output, 'a file with no shebang was passed over in silence').toContain('no shebang');
      expect(code, 'a file nothing can start was counted as a pass').not.toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses to pass when the table covers everything', () => {
    const root = madeUpTree(
      { 'audit-alpha.mjs': SAYS_NOTHING, 'audit-beta.mjs': SAYS_NOTHING },
      {
        'scripts/audit-alpha.mjs': 'a made-up reason',
        'scripts/audit-beta.mjs': 'another made-up reason',
      },
    );
    try {
      const { code, output } = runGate(root);

      expect(output, 'a gate that ran nothing said nothing about it').toContain('runs nothing');
      expect(code, 'every audit excused, and the gate still passed').not.toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
