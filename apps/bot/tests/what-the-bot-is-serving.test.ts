import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe as group, expect, it } from 'vitest';

import { askRoute } from '../src/serve';
import {
  CODE_HEADER,
  DATA_DIR,
  SERVING_HEADER,
  codeFingerprint,
  fingerprintOf,
  runningFingerprint,
  servingFingerprint,
} from '../src/serving';
import {
  FINGERPRINT,
  exitCodeFor,
  fingerprintFrom,
  fingerprintsFrom,
  verdict,
} from '../../../scripts/lib/serving.mjs';

/**
 * The bot says which texts it serves AND which code it runs, and a guard can
 * tell three states apart.
 *
 * **The code half was added a day after the texts half, and the reason is the
 * lesson.** The first guard measured the dataset alone — which was true, and
 * narrower than the sentence `LOOP.md` then wrote about it: *0 it is current*.
 * An edit anywhere in `apps/bot/src` left the texts fingerprint identical, so a
 * green run certified a bot that could have been running code from any number
 * of commits ago. Measured, not supposed: `4ca98283558f` before the edit and
 * `4ca98283558f` after it.
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

/** A whole repository shape, so the code fingerprint can be asked about it. */
const treeWith = (files: Record<string, string>): string => {
  const root = mkdtempSync(join(tmpdir(), 'leela-tree-'));
  made.push(root);
  for (const [path, body] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return root;
};

const codeIn = (root: string) => codeFingerprint(root);

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

group('the fingerprint of the code the container runs', () => {
  it('names the shipped source, stably, and is not the texts fingerprint', () => {
    const said = codeFingerprint();

    expect(said).toMatch(FINGERPRINT);
    expect(codeFingerprint()).toBe(said);
    expect(runningFingerprint()).toBe(said);
    // Two questions, two answers. One value standing for both would make the
    // guard unable to say which half moved, which is the whole repair here.
    expect(said).not.toBe(fingerprintOf(DATA_DIR));
  });

  it('MOVES for the bot\u2019s own source, WHERE THE TEXTS FINGERPRINT DOES NOT', () => {
    /*
     * The defect, as an assertion. Measured before this was written: editing
     * `apps/bot/src/commands.ts` left the texts fingerprint at 4ca98283558f
     * exactly, so the guard reported *serving* for a bot that could have been
     * running code from any number of commits ago.
     *
     * Driven over a temporary tree rather than by editing the repository,
     * because a test that mutates the source it is checking is a test that
     * leaves the checkout dirty when it fails.
     */
    const before = treeWith({ 'apps/bot/src/commands.ts': 'export const a = 1;\n' });
    const after = treeWith({ 'apps/bot/src/commands.ts': 'export const a = 2;\n' });

    expect(codeIn(before)).not.toBe(codeIn(after));
    // and the texts, which neither tree has, are not what changed
    expect(fingerprintOf(join(before, 'packages/content/data'))).toBeNull();
  });

  it('MOVES for a package the bot imports', () => {
    const before = treeWith({ 'packages/engine/src/index.ts': 'export const TOTAL = 72;\n' });
    const after = treeWith({ 'packages/engine/src/index.ts': 'export const TOTAL = 73;\n' });

    expect(codeIn(before)).not.toBe(codeIn(after));
  });

  it('DOES NOT MOVE for a test, or for anything installed', () => {
    /*
     * The Dockerfile copies `apps/bot` whole, tests included, so the image does
     * differ — but the question this answers is *would deploying now change
     * anything for anybody*, and a test cannot. `node_modules` is installed in
     * the image from the lockfile rather than copied, so hashing this machine's
     * copy would compare two different things.
     */
    const plain = treeWith({ 'apps/bot/src/main.ts': 'export const a = 1;\n' });
    const noisy = treeWith({
      'apps/bot/src/main.ts': 'export const a = 1;\n',
      'apps/bot/tests/main.test.ts': 'it("x", () => {});\n',
      'apps/bot/src/main.test.ts': 'it("beside it", () => {});\n',
      'packages/engine/node_modules/dep/index.ts': 'export const installed = true;\n',
      'apps/bot/dist/main.ts': 'export const built = true;\n',
      'apps/bot/src/notes.md': 'not code\n',
    });

    expect(codeIn(noisy)).toBe(codeIn(plain));
  });

  it('names a file by its path, so moving one between packages is a change', () => {
    // Two workspaces have an `index.ts`; a basename would call those the same
    // file, and a file that moved would leave the fingerprint still.
    const here = treeWith({ 'packages/engine/src/index.ts': 'export const a = 1;\n' });
    const there = treeWith({ 'packages/journal/src/index.ts': 'export const a = 1;\n' });

    expect(codeIn(here)).not.toBe(codeIn(there));
  });

  it('answers null when there is no code to read', () => {
    expect(codeIn(treeWith({}))).toBeNull();
    expect(codeIn(treeWith({ 'apps/bot/src/notes.md': 'words\n' }))).toBeNull();
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

  it('carries BOTH headers, and they are independent', async () => {
    /*
     * Two headers rather than two fields in one, so each can go missing on its
     * own. A bot deployed on the day between the two halves carried the texts
     * header and not the code one, and a guard has to be able to say *which*
     * half it could not establish rather than only that something was wrong.
     */
    const both = await askRoute({ serving: () => 'aaaaaaaaaaaa', running: () => 'bbbbbbbbbbbb' })(preflight());

    expect(both.headers.get(SERVING_HEADER)).toBe('aaaaaaaaaaaa');
    expect(both.headers.get(CODE_HEADER)).toBe('bbbbbbbbbbbb');
  });

  it('DROPS ONLY THE HALF THAT COULD NOT BE READ', async () => {
    const noCode = await askRoute({ serving: () => 'aaaaaaaaaaaa', running: () => null })(preflight());

    expect(noCode.headers.get(SERVING_HEADER)).toBe('aaaaaaaaaaaa');
    expect(noCode.headers.has(CODE_HEADER)).toBe(false);

    const noTexts = await askRoute({ serving: () => null, running: () => 'bbbbbbbbbbbb' })(preflight());

    expect(noTexts.headers.has(SERVING_HEADER)).toBe(false);
    expect(noTexts.headers.get(CODE_HEADER)).toBe('bbbbbbbbbbbb');
  });

  it('ANSWERS ANYWAY when the CODE reader throws, as when the texts one does', async () => {
    /*
     * The second reader gets the same protection as the first, and this is the
     * assertion that says so. The first got it because `audit-promises.mjs`
     * demanded it; a second reader added later is exactly the shape of change
     * that arrives without the protection the first one earned.
     */
    const response = await askRoute({
      serving: () => 'aaaaaaaaaaaa',
      running: () => {
        throw new Error('the source is gone');
      },
    })(preflight());

    expect(response.status).toBe(204);
    expect(response.headers.get(SERVING_HEADER)).toBe('aaaaaaaaaaaa');
    expect(response.headers.has(CODE_HEADER)).toBe(false);
  });

  it('serves the real dataset by default, with nothing injected', async () => {
    // The seam above is for tests; the deployed bot passes no `serving`, and
    // an option that only ever works when a test sets it is not a feature.
    const response = await askRoute()(preflight());

    expect(response.headers.get(SERVING_HEADER)).toBe(fingerprintOf(DATA_DIR));
    expect(response.headers.get(CODE_HEADER)).toBe(codeFingerprint());
  });

  it('reads both out of a real response the way the guard does', async () => {
    // The guard's own reader, over the route's own headers — the two ends of
    // the wire, met in one assertion rather than each tested against a fixture
    // the other never sees.
    const response = await askRoute({ serving: () => 'aaaaaaaaaaaa', running: () => 'bbbbbbbbbbbb' })(preflight());

    expect(fingerprintsFrom(response.headers)).toEqual({ texts: 'aaaaaaaaaaaa', code: 'bbbbbbbbbbbb' });
  });
});

group('the verdict a guard reaches, and the code it exits', () => {
  const pair = (texts: string | null, code: string | null) => ({ texts, code });

  it('agrees only when BOTH halves said the same thing', () => {
    expect(verdict(pair('aaaaaaaaaaaa', 'bbbbbbbbbbbb'), pair('aaaaaaaaaaaa', 'bbbbbbbbbbbb'))).toMatchObject({
      state: 'serving',
    });
    expect(verdict(pair('aaaaaaaaaaaa', 'bbbbbbbbbbbb'), pair('ffffffffffff', 'bbbbbbbbbbbb'))).toMatchObject({
      state: 'stale',
    });
  });

  it('CALLS A BOT WITH THE RIGHT TEXTS AND THE WRONG CODE STALE', () => {
    /*
     * The defect this file was rewritten for. The first guard measured the
     * texts alone, and `LOOP.md` told every iteration exit 0 meant *the bot is
     * current* — so a bot running any amount of old code, over a dataset that
     * happened not to have moved, read as a pass. That is a guard certifying
     * the thing it was written to catch.
     */
    const answer = verdict(pair('aaaaaaaaaaaa', 'bbbbbbbbbbbb'), pair('aaaaaaaaaaaa', 'cccccccccccc'));

    expect(answer.state).toBe('stale');
    expect(answer.why).toContain('the code it runs');
    expect(answer.why).not.toContain('the texts it serves');
  });

  it('names both halves when both moved', () => {
    const answer = verdict(pair('aaaaaaaaaaaa', 'bbbbbbbbbbbb'), pair('111111111111', '222222222222'));

    expect(answer.why).toContain('the texts it serves');
    expect(answer.why).toContain('the code it runs');
  });

  it('CALLS A MISSING ANSWER UNKNOWN, NOT AGREEMENT', () => {
    /*
     * The state that matters. On the day this was written the live bot was
     * five commits behind AND too old to carry the header, so `unknown` is
     * what a genuinely stale bot looked like — reading it as a pass would have
     * certified the defect.
     */
    expect(verdict(pair('aaaaaaaaaaaa', 'bbbbbbbbbbbb'), pair(null, null))).toMatchObject({ state: 'unknown' });
    expect(verdict(pair(null, null), pair('aaaaaaaaaaaa', 'bbbbbbbbbbbb'))).toMatchObject({ state: 'unknown' });
    expect(verdict(null, null)).toMatchObject({ state: 'unknown' });
  });

  it('IS UNKNOWN WHEN ONLY ONE HALF CAME BACK, even if that half matches', () => {
    /*
     * Exactly what a bot deployed one day earlier looks like: it carries the
     * texts header and not the code one. *Half the question was answered* is
     * not *the answer is yes*, and the half that goes missing is precisely the
     * half a deployment predating the guard would drop.
     */
    const answer = verdict(pair('aaaaaaaaaaaa', 'bbbbbbbbbbbb'), pair('aaaaaaaaaaaa', null));

    expect(answer.state).toBe('unknown');
    expect(answer.why).toContain(CODE_HEADER);
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
