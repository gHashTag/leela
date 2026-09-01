/**
 * An excuse written as a bare property name is not the narrow one it looks like.
 *
 * `audit-promises` asks whether every injected dependency is handed a broken
 * implementation by some test. It carries two lists of members it will not ask
 * about, and one of them, `DATA`, matched on the bare property name — no owner,
 * no type, just the word. Six words sat in it.
 *
 * MEASURED before the change, per entry, by computing injection points over
 * every source file the audit walks: `id` suppressed 0 of them, `apiKey` 0,
 * `baseUrl` 0, `referer` 0, `title` 0. Those five were dead by construction and
 * not by drift: `scripts/lib/promises.mjs` already drops any member whose type
 * does not match `/Store|Sink|Model|Storage|Queries|=>/`, so a `string` member
 * never becomes an injection point and never reaches the excuse list at all —
 * which is exactly the case the excuse's prose described.
 *
 * The sixth, `model`, suppressed exactly 1: `GuideOptions.model` in
 * `packages/ai/src/guide.ts`, typed `LanguageModel`. That is the dependency in
 * the audit's founding story, *a model that never returned*. A bare name
 * written about strings had reached the one thing the whole check was built
 * for, and reported success over it for as long as it sat there.
 *
 * MEASURED after emptying the list: `node scripts/audit-promises.mjs` exits 0,
 * and `checked` rose from **28 to 29** — the one point restored is
 * `GuideOptions.model`, which has 4 stretches of test source handing it
 * something hostile and `answeredIn` true of them. It passes on its merits.
 *
 * ASSUMED, not measured, and it is the reason this matters: there is no live
 * hole in `packages/ai` today only because `guide.test.ts` happens to hand in
 * models that throw and models that never settle. The audit was not what
 * covered that, and would not have noticed if that test were weakened. Being
 * able to notice is what the emptying buys.
 *
 * So the first two tests assert the SHAPE rather than today's six words: over
 * synthetic interfaces, a bare-name excuse suppresses every same-named member
 * of every owner, while the same excuse written `Owner.property` suppresses
 * exactly one. Bare keying is not a smaller exemption. It is an unbounded one,
 * and both spellings look equally like they worked. The third test then holds
 * the audit's own lists to that, so the next entry cannot be added bare.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error - the audit's logic is plain JavaScript, shared with the script
import { injectionPoints } from '../../../scripts/lib/promises.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const AUDIT = join(REPO, 'scripts/audit-promises.mjs');

type Point = { file: string; owner: string; property: string };

const pointsIn = (source: string): Point[] => injectionPoints(source, 'synthetic.ts') as Point[];

const key = (point: Point): string => `${point.owner}.${point.property}`;

/**
 * The shape the defect was demonstrated on, generalised to two owners.
 *
 * `ReportOptions` is the scout's interface verbatim: a member typed as a store,
 * a member typed as a function returning a promise, and a method. The audit
 * reads all three as injection points. `GuideOptions` is a second, unrelated
 * options bag that happens to declare members of the same two names — which is
 * the whole situation a bare-name excuse cannot see.
 */
const SOURCE = `
export interface ReportOptions {
  title: JournalStore;
  referer: () => Promise<string>;
  save(step: number): Promise<void>;
}

export interface GuideOptions {
  title: JournalStore;
  referer: () => Promise<string>;
  ask(question: string): Promise<string>;
}
`;

/** What the audit does with a bare-name list: match the property, ignore the owner. */
const surviving = {
  bare: (points: Point[], excuses: Set<string>) =>
    points.filter((point) => !excuses.has(point.property)).map(key),
  owned: (points: Point[], excuses: Set<string>) => points.filter((p) => !excuses.has(key(p))).map(key),
};

describe('an excuse keyed on a bare property name', () => {
  it('reaches every owner that happens to declare that name', () => {
    const points = pointsIn(SOURCE);
    const owners = [...new Set(points.map((point) => point.owner))];

    // Not a list of the names in SOURCE: whatever property the two interfaces
    // share, excusing it bare must take it from both of them.
    const shared = [...new Set(points.map((point) => point.property))].filter(
      (property) =>
        owners.every((owner) =>
          points.some((point) => point.owner === owner && point.property === property),
        ),
    );

    expect(shared.length).toBeGreaterThan(1);

    const reached: Record<string, string[]> = {};
    for (const property of shared) {
      const before = surviving.bare(points, new Set());
      const after = surviving.bare(points, new Set([property]));
      reached[property] = before.filter((one) => !after.includes(one));
    }

    // One word, and it is spent on every owner at once.
    for (const property of shared) {
      expect(reached[property]).toEqual(owners.map((owner) => `${owner}.${property}`));
    }
  });

  it('is wider than the same excuse written Owner.property, never narrower', () => {
    const points = pointsIn(SOURCE);

    const widerBy: string[] = [];
    for (const point of points) {
      const bare = surviving.bare(points, new Set([point.property]));
      const owned = surviving.owned(points, new Set([key(point)]));

      // The owned spelling suppresses exactly the one member it names.
      expect(points.length - owned.length).toBe(1);
      expect(owned).not.toContain(key(point));

      // The bare spelling suppresses at least that one, and sometimes more.
      expect(bare).not.toContain(key(point));
      if (bare.length < owned.length) widerBy.push(key(point));
    }

    // Every shape in SOURCE where a name is shared shows the difference; none
    // shows the bare form suppressing less.
    expect(widerBy.length).toBeGreaterThan(0);
    for (const point of points) {
      const bare = surviving.bare(points, new Set([point.property]));
      const owned = surviving.owned(points, new Set([key(point)]));
      expect(bare.length).toBeLessThanOrEqual(owned.length);
    }
  });

  it('does not appear in the audit that granted one', () => {
    // Read from the audit rather than imported, because the point is the words
    // somebody typed into the lists, not what the module happens to export.
    const source = readFileSync(AUDIT, 'utf8');
    const lists = [...source.matchAll(/^const ([A-Z][A-Z0-9_]*) = new Set\(\[([^\]]*)\]\)/gm)];

    // If the lists stop being findable this test must fail loudly rather than
    // pass over nothing: an excuse list it cannot read is one it cannot hold.
    expect(lists.map((list) => list[1]).sort()).toEqual(['DATA', 'NOT_OURS']);

    const bare: string[] = [];
    for (const [, name, body] of lists) {
      for (const entry of body.matchAll(/'([^']+)'/g)) {
        if (!entry[1].includes('.')) bare.push(`${name}: ${entry[1]}`);
      }
    }

    expect(bare).toEqual([]);
  });
});
