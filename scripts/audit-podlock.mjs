#!/usr/bin/env node
/**
 * A React Native app's `Podfile.lock`, against the versions npm has installed.
 *
 * The published app ships **no JavaScript lockfile** — `Gemfile.lock` and
 * `Podfile.lock` are committed, `yarn.lock` and `package-lock.json` are not. So
 * every install resolves its caret ranges fresh, and three years on they
 * resolve to versions its own tooling cannot read. That one fact is the root
 * cause of all sixteen build blockers in `MIGRATION.md`.
 *
 * `Podfile.lock` is the pin that survived. Every package with a native side
 * ships a `.podspec`, CocoaPods writes the version it saw, and that file is in
 * the repository. For the half of the tree that decides whether the app
 * compiles, the shipped build's versions are recoverable — and fourteen of them
 * had drifted.
 *
 * Run:  node scripts/audit-podlock.mjs --app ../leela-src/leela
 *
 * Needs: an app with `node_modules` installed and an `ios/Podfile.lock`, which
 * CI has neither of — the donor clones are not checked out and the native side
 * is never installed there.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { driftFrom, lockedVersions } from './lib/podlock.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const flag = process.argv.indexOf('--app');
const APP = flag > -1 ? process.argv[flag + 1] : join(ROOT, '..', 'leela-src', 'leela');

/** Every `.podspec` under `node_modules`, one level into a package or its scope. */
function podspecsUnder(modules) {
  const found = [];
  if (!existsSync(modules)) return found;

  for (const entry of readdirSync(modules)) {
    const packages = entry.startsWith('@')
      ? readdirSync(join(modules, entry)).map((inner) => join(entry, inner))
      : [entry];

    for (const pkg of packages) {
      const dir = join(modules, pkg);
      try {
        if (!statSync(dir).isDirectory()) continue;
        for (const file of readdirSync(dir)) {
          if (file.endsWith('.podspec')) found.push(join(dir, file));
        }
      } catch {
        // A broken symlink in `node_modules` is not this audit's business.
      }
    }
  }

  return found;
}

const lockPath = join(APP, 'ios', 'Podfile.lock');
if (!existsSync(lockPath)) {
  console.log(`\nNo ${relative(ROOT, lockPath)} — nothing to reconstruct from.\n`);
  console.log('Point this at an app with a native iOS project:');
  console.log('  node scripts/audit-podlock.mjs --app ../leela-src/leela');
  process.exit(0);
}

const locked = lockedVersions(readFileSync(lockPath, 'utf8'));
const podspecs = podspecsUnder(join(APP, 'node_modules'));

if (podspecs.length === 0) {
  console.log(`\n${relative(ROOT, lockPath)} records ${locked.size} pods.`);
  console.log('\nNo node_modules to compare against — run an install first.');
  process.exit(0);
}

const versionOf = (pkg) => {
  const manifest = join(APP, 'node_modules', pkg, 'package.json');
  try {
    return JSON.parse(readFileSync(manifest, 'utf8')).version ?? null;
  } catch {
    return null;
  }
};

const { drift, unmatched } = driftFrom({ locked, podspecs, versionOf });

console.log(
  `\n${relative(ROOT, lockPath)} records ${locked.size} pods; ` +
    `${podspecs.length} packages under node_modules ship one.\n`,
);

if (drift.length === 0) {
  console.log('Every package with a native side is the version the lock remembers.');
} else {
  console.log(`${drift.length} package(s) have drifted from the shipped build:\n`);
  for (const one of drift) {
    console.log(
      `  ${one.package.padEnd(42)} installed ${one.installed.padEnd(10)} locked ${one.locked}   (pod ${one.pod})`,
    );
  }
  console.log(
    '\nEvery one of these is a caret that npm resolved forward. Pin each to the\n' +
      'locked version and five of the recorded build blockers stop happening —\n' +
      "`pod install` refuses on changed constraints until they agree.",
  );
  process.exitCode = 1;
}

if (unmatched.length > 0) {
  console.log(`\n${unmatched.length} podspec(s) the lock has never heard of:\n`);
  for (const one of unmatched.slice(0, 12)) {
    console.log(`  ${one.package.padEnd(42)} ships pod ${one.pod}`);
  }
  if (unmatched.length > 12) console.log(`  … and ${unmatched.length - 12} more`);
  console.log(
    '\nEither added since the build, or a pod this reader named wrongly. The two\n' +
      'look identical in silence, so they are printed rather than skipped.',
  );
}
