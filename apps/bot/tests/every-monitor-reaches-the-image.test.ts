/**
 * Every monitor on disk must be inside the image that runs it.
 *
 * This existed already, twice, and both copies were written the same way: a
 * literal `expect(instructions).toContain('COPY scripts/monitor-live-ai.mjs
 * …')`. Each one guarded the monitor it was written beside, and **that is
 * exactly why a third monitor got through.** `monitor-live-play.mjs` was
 * written, tested, reviewed, merged and deployed, and then answered `Module not
 * found` from a container running the very commit that added it. Railway
 * reported RUNNING on the right hash, CI was green, and the file was not there.
 *
 * A per-item guard has to be extended by hand for every new item, which means
 * it protects the past and never the next one. This is the same guard written
 * so that it cannot be short: it reads the directory rather than a list, so a
 * monitor added tomorrow is covered the moment it is saved.
 *
 * It accepts a glob as well as a literal name, because `COPY scripts/monitor-*`
 * is the honest way to express "all of them" and a rule that forbade it would
 * push the Dockerfile back to a hand-kept list.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');

/** The instructions of the stage that actually ships, comments removed. */
const runtimeInstructions = (): string[] => {
  const runtime = dockerfile
    .split(/(?=^FROM )/gm)
    .find((stage) => /^FROM manifests AS runtime$/m.test(stage));
  return (runtime ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
};

/** Does the runtime stage copy this repository-relative path, by any means? */
export const shipped = (path: string): boolean =>
  runtimeInstructions().some((line) => {
    const source = /^COPY\s+(?:--from=\S+\s+)?(\S+)\s+\S+$/.exec(line)?.[1];
    if (source === undefined) return false;
    if (source === path) return true;
    if (!source.includes('*')) return false;
    const pattern = new RegExp(
      `^${source.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`,
    );
    return pattern.test(path);
  });

const monitors = (): string[] =>
  readdirSync(new URL('../../../scripts', import.meta.url))
    .filter((name) => name.startsWith('monitor-') && name.endsWith('.mjs'))
    .sort();

describe('every monitor reaches the image', () => {
  it('finds the monitors at all, or it is checking nothing', () => {
    // Without this the suite passes on an empty directory, which is how a
    // guard quietly stops guarding after a rename.
    expect(monitors().length).toBeGreaterThanOrEqual(3);
    expect(monitors()).toContain('monitor-live-play.mjs');
  });

  it('ships every one of them', () => {
    const missing = monitors().filter((name) => !shipped(`scripts/${name}`));
    expect(missing).toEqual([]);
  });

  it('does not ship the source-reading audits', () => {
    // The twenty-eight `audit-*.mjs` read a source tree this image does not
    // carry. A glob wide enough to sweep them in would be shipping dead ends.
    expect(shipped('scripts/audit-claims.mjs')).toBe(false);
    expect(shipped('scripts/audit-unread.mjs')).toBe(false);
  });

  it('says no to a file the Dockerfile does not carry', () => {
    // The control. A predicate that answers yes to everything would make the
    // test above pass for the wrong reason — which is the failure this whole
    // file exists because of.
    //
    // These are named carefully, and my first attempt was not: I used
    // `scripts/monitor-that-does-not-exist.mjs` and it came back TRUE. That is
    // the predicate being right and the control being wrong. `shipped` answers
    // "would the Dockerfile carry this path", which is a question about the
    // COPY patterns and not about the disk — a file matching `monitor-*.mjs`
    // WOULD be carried the moment it existed. So a control has to name a path
    // the patterns genuinely do not reach.
    expect(shipped('scripts/probe-live-play.mjs')).toBe(false);
    expect(shipped('scripts/monitor-live-play.ts')).toBe(false);
    expect(shipped('scripts/nested/monitor-live-play.mjs')).toBe(false);
    expect(shipped('README.md')).toBe(false);
  });
});
