import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe as group, expect, it } from 'vitest';

import { askRoute } from '../src/serve';
import { DATA_DIR, SERVING_HEADER, fingerprintOf, servingFingerprint } from '../src/serving';
import { FINGERPRINT, exitCodeFor, fingerprintFrom, verdict } from '../../../scripts/lib/serving.mjs';

/**
 * The bot says which texts it is serving, and a guard can tell three states
 * apart.
 *
 * Written for a defect that had already happened. `pages.yml` rebuilds the web
 * on every push; the bot is shipped by hand with `railway up`. Three
 * iterations repaired the dataset — seventy-three plan titles carrying a "Plan
 * N" label, a Malay plan printing `& Nbsp; & nbsp;` — and none of them
 * deployed, so the fixes were green for eleven hours and in front of nobody.
 * `LOOP.md` had said *THE BOT DOES NOT DEPLOY ITSELF* in prose the whole time.
 *
 * What is asserted here is what makes that measurable instead of remembered:
 *
 * 1. The fingerprint moves when, and only when, the served texts move.
 * 2. Every answer carries it — including a refusal, which is what the guard
 *    reads, because a preflight costs no tokens and messages nobody.
 * 3. **Absence is its own state.** A bot that cannot read its texts sends no
 *    header, and a guard that read the absence as agreement would certify the
 *    exact failure this exists to catch.
 */

const made: string[] = [];

const dirWith = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), 'leela-serving-'));
  made.push(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
};

afterEach(() => {
  while (made.length > 0) rmSync(made.pop() as string, { recursive: true, force: true });
});

group('the fingerprint of a set of texts', () => {
  it('names the shipped dataset, and names it the same way twice', () => {
    const said = fingerprintOf(DATA_DIR);

    expect(said).toMatch(FINGERPRINT);
    expect(fingerprintOf(DATA_DIR)).toBe(said);
    expect(servingFingerprint()).toBe(said);
  });

  it('MOVES when a single byte of a text moves', () => {
    /*
     * The assertion the whole guard rests on. The repair that prompted it
     * changed four characters in one plan of 1,584; a fingerprint that did not
     * notice that would have reported the stale bot as current.
     */
    const before = dirWith({ 'plans.ms.json': '[{"plan":6,"body":"dipanggil"}]' });
    const after = dirWith({ 'plans.ms.json': '[{"plan":6,"body":"dipanggiL"}]' });

    expect(fingerprintOf(before)).not.toBe(fingerprintOf(after));
  });

  it('MOVES when a language disappears, and when one is only renamed', () => {
    /*
     * Name as well as bytes: two directories holding identical text under
     * different names are two different datasets, and one of them is missing
     * Urdu.
     *
     * The renamed pair is built so that **only the names differ**. The first
     * version of it was `ur` → `ar`, which also swapped the two bodies round
     * in sorted order — so deleting the line that hashes the name left this
     * green, and the assertion had been passing on the content order all
     * along. Here `plans.en` sorts first in both and the remaining body is the
     * same string, so the names are the only thing left to tell them apart.
     */
    const both = dirWith({ 'plans.en.json': '["en"]', 'plans.ur.json': '["x"]' });
    const dropped = dirWith({ 'plans.en.json': '["en"]' });
    const renamed = dirWith({ 'plans.en.json': '["en"]', 'plans.ta.json': '["x"]' });

    expect(fingerprintOf(both)).not.toBe(fingerprintOf(dropped));
    expect(fingerprintOf(both)).not.toBe(fingerprintOf(renamed));
  });

  it('does not move for a file nobody serves', () => {
    /*
     * `data/editions/` holds the two donor snapshots the generator merges. No
     * code loads them and no player is ever shown one, so a fingerprint that
     * moved with them would go off for a change that reached nobody — and an
     * alarm that fires for the wrong reason is the one people silence.
     */
    const plain = dirWith({ 'plans.en.json': '["en"]' });
    const withDonors = dirWith({ 'plans.en.json': '["en"]' });
    mkdirSync(join(withDonors, 'editions'));
    writeFileSync(join(withDonors, 'editions', 'leela-en.json'), '["donor"]');
    writeFileSync(join(withDonors, 'notes.md'), 'not a dataset');

    expect(fingerprintOf(withDonors)).toBe(fingerprintOf(plain));
  });

  it('answers null — never a hash — when there are no texts to read', () => {
    /*
     * Three ways to have nothing, and all three must be the same answer. An
     * empty directory is the dangerous one: hashing nothing gives a stable
     * value, so two deployments that had both lost their dataset would agree
     * with each other and with nothing else.
     */
    expect(fingerprintOf(join(tmpdir(), 'leela-no-such-dir-ever'))).toBeNull();
    expect(fingerprintOf(dirWith({}))).toBeNull();
    expect(fingerprintOf(dirWith({ 'notes.txt': 'words' }))).toBeNull();
  });
});

group('every answer says what it is serving', () => {
  const preflight = () =>
    new Request('https://bot.example/api/ask', {
      method: 'OPTIONS',
      headers: { origin: 'https://t27.ai' },
    });

  it('puts the fingerprint on a preflight, which is what the guard reads', async () => {
    /*
     * Driven through `askRoute` rather than through the wrapper alone: the
     * hole in the two guards before this one was in exactly this glue, where
     * everything either side was a tested pure function. A preflight is the
     * request the guard sends — it spends no model tokens and messages nobody.
     */
    const response = await askRoute({ serving: () => 'abcdef012345' })(preflight());

    expect(response.status).toBe(204);
    expect(response.headers.get(SERVING_HEADER)).toBe('abcdef012345');
  });

  it('puts it on a refusal too', async () => {
    // A bot answering nothing but refusals is still a bot serving a dataset,
    // and it is the state somebody most needs to ask about.
    const refused = await askRoute({ serving: () => 'abcdef012345' })(
      new Request('https://bot.example/api/nowhere', { method: 'POST', headers: { origin: 'https://t27.ai' } }),
    );

    expect(refused.status).toBe(404);
    expect(refused.headers.get(SERVING_HEADER)).toBe('abcdef012345');
  });

  it('SENDS NO HEADER when the bot cannot read its own texts', async () => {
    // The third state on the wire. Writing "unknown" here would put a string
    // where a state belongs, and a guard would compare it like any other.
    const response = await askRoute({ serving: () => null })(preflight());

    expect(response.status).toBe(204);
    expect(response.headers.has(SERVING_HEADER)).toBe(false);
  });

  it('ANSWERS ANYWAY when the reader itself throws', async () => {
    /*
     * `audit-promises.mjs` asked for this before any player did: every
     * injected dependency has to be tried with one that breaks. The header is
     * a diagnostic, and a diagnostic that can fail the answer it rides on has
     * made the deployment worse than not measuring at all — a bot that could
     * not fingerprint its texts would have stopped answering questions.
     *
     * The throw is the same fact as a null: *this process cannot say*. It is
     * not the same fact as *the bot is down*.
     */
    const response = await askRoute({
      serving: () => {
        throw new Error('the dataset is gone');
      },
    })(preflight());

    expect(response.status).toBe(204);
    expect(response.headers.has(SERVING_HEADER)).toBe(false);
  });

  it('serves the real dataset by default, with nothing injected', async () => {
    // The seam above is for tests; the deployed bot passes no `serving`, and
    // an option that only ever works when a test sets it is not a feature.
    const response = await askRoute()(preflight());

    expect(response.headers.get(SERVING_HEADER)).toBe(fingerprintOf(DATA_DIR));
  });
});

group('the verdict a guard reaches, and the code it exits', () => {
  it('agrees only when both sides said the same thing', () => {
    expect(verdict('4ca98283558f', '4ca98283558f')).toMatchObject({ state: 'serving' });
    expect(verdict('4ca98283558f', 'ffffffffffff')).toMatchObject({ state: 'stale' });
  });

  it('CALLS A MISSING ANSWER UNKNOWN, NOT AGREEMENT', () => {
    /*
     * The state that matters. On the day this was written the live bot was
     * five commits behind AND too old to carry the header, so `unknown` is
     * what a genuinely stale bot looked like — reading it as a pass would have
     * certified the defect.
     */
    expect(verdict('4ca98283558f', null)).toMatchObject({ state: 'unknown' });
    expect(verdict(null, '4ca98283558f')).toMatchObject({ state: 'unknown' });
    expect(verdict(null, null)).toMatchObject({ state: 'unknown' });
  });

  it('keeps "no" and "no answer" apart in the exit code', () => {
    expect(exitCodeFor('serving')).toBe(0);
    expect(exitCodeFor('stale')).toBe(1);
    expect(exitCodeFor('unknown')).toBe(2);
  });

  it('refuses a value that is not a fingerprint rather than comparing it', () => {
    /*
     * A proxy that inserts its own header, or a half-finished rename, gives a
     * string that is not one of ours. Comparing it would report *the bot is
     * behind* — a claim about a deployment made from a typo.
     */
    const carrying = (value: string) => new Headers({ [SERVING_HEADER]: value });

    expect(fingerprintFrom(carrying('4ca98283558f'))).toBe('4ca98283558f');
    expect(fingerprintFrom(carrying('  4ca98283558f  '))).toBe('4ca98283558f');
    expect(fingerprintFrom(carrying('unknown'))).toBeNull();
    expect(fingerprintFrom(carrying('4CA98283558F'))).toBeNull();
    expect(fingerprintFrom(carrying('4ca98283558'))).toBeNull();
    expect(fingerprintFrom(new Headers())).toBeNull();
  });
});
