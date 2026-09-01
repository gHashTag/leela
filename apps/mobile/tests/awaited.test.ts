import { describe, expect, it } from 'vitest';
// @ts-ignore - the audit libraries are JavaScript with no declarations.
import { floatingAssertions } from '../../../scripts/lib/awaited.mjs';

/**
 * The judgement inside `scripts/audit-awaited.mjs`, asked directly.
 *
 * The audit itself can only say *nothing found* against the tree as it stands,
 * and *nothing found* and *nothing looked for* print the same sentence. So the
 * rule is asked here over source it is handed: both what it must catch and,
 * more importantly, what it must leave alone. A check that cries wolf on
 * correct code is one somebody deletes rather than obeys, and every shape below
 * marked "waited for" is a spelling that exists in this repository today.
 */

const around = (body: string) => `
  import { describe, expect, it } from 'vitest';
  describe('a suite', () => {
    it('a test', ${body});
  });
`;

describe('an assertion nothing waits on', () => {
  it('is caught however the promise is spelled', () => {
    const floating = floatingAssertions(
      around(`() => {
        expect(load()).resolves.toBe(null);
        expect(save()).rejects.toThrow();
      }`),
    );

    expect(floating.map((f: { member: string }) => f.member)).toEqual(['resolves', 'rejects']);
  });

  it('is caught inside a loop, which is where the suppression comment hides it', () => {
    // The shape the real defect took: an `eslint-disable-next-line
    // no-await-in-loop` above a statement that no longer has an `await` under
    // it. One site, six iterations, and the comment reads as though it were
    // still doing something.
    const floating = floatingAssertions(
      around(`() => {
        for (const rubbish of ['{', 'null', '42']) {
          // eslint-disable-next-line no-await-in-loop
          expect(load(rubbish)).resolves.toBe(null);
        }
      }`),
    );

    expect(floating).toHaveLength(1);
    expect(floating[0].text).toContain('resolves.toBe(null)');
  });

  it('is caught when a .catch makes it look handled', () => {
    // The quietest spelling of the defect, and the one this test corrected the
    // rule about: `.catch` deals with the rejection and waits for nothing, so
    // the assertion is still hanging and now fails silently as well.
    const floating = floatingAssertions(
      around(`() => { expect(load()).resolves.toBe(null).catch(() => {}); }`),
    );

    expect(floating).toHaveLength(1);
  });

  it('is reported with the line somebody has to open', () => {
    const [only] = floatingAssertions('const a = 1;\n\nexpect(load()).resolves.toBe(null);\n');

    expect(only.line).toBe(3);
  });
});

describe('an assertion something waits on', () => {
  it.each([
    ['awaited', `async () => { await expect(load()).resolves.toBe(null); }`],
    ['returned', `() => expect(load()).resolves.toBe(null)`],
    ['returned from a block', `() => { return expect(load()).resolves.toBe(null); }`],
    [
      'collected into a Promise.all',
      `() => Promise.all([
         expect(load()).resolves.toBe(null),
         expect(save()).resolves.toBe(false),
       ])`,
    ],
    [
      'returned from a map callback',
      `() => Promise.all(['a', 'b'].map((x) => expect(load(x)).resolves.toBe(null)))`,
    ],
    ['held under a name', `() => { const settled = expect(load()).resolves.toBe(null); }`],
  ])('is left alone when it is %s', (_shape, body) => {
    expect(floatingAssertions(around(body))).toEqual([]);
  });

  it('is left alone when the await sits on an earlier line', () => {
    // Three sites in `apps/bot` are written this way, and a line-oriented
    // search reports all three. Naming three innocents to catch one defect is
    // how a check earns its way into being switched off.
    const floating = floatingAssertions(
      around(`async () => {
        await expect(
          store(everything),
        ).resolves.toBeUndefined();
      }`),
    );

    expect(floating).toEqual([]);
  });
});

describe('what the rule is about', () => {
  it('does not fire on a synchronous assertion, however it is written', () => {
    const floating = floatingAssertions(
      around(`() => {
        expect(board.length).toBe(72);
        expect(plan).toEqual({ from: 10, to: 23 });
      }`),
    );

    expect(floating).toEqual([]);
  });

  it('does not fire on somebody else’s resolves', () => {
    // `resolves` is not a reserved word. Only the one hanging off `expect(...)`
    // is an assertion, and the check says so rather than matching the name.
    const floating = floatingAssertions(
      around(`() => {
        deferred.resolves.toBe(null);
        thing(load()).resolves.toBe(null);
      }`),
    );

    expect(floating).toEqual([]);
  });
});
