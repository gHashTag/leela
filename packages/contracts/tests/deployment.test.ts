import { describe, expect, it } from 'vitest';
// @ts-expect-error — a plain module, shared with the scripts that use it.
import { ABSENT, PARTLY_ABSENT, PRESENT, UNREACHABLE, classify, describe as report, exitCodeFor, summarise } from '../../../scripts/lib/deployment.mjs';

/**
 * "We checked" must not be able to become untrue.
 *
 * The repository said the contract is "deployed at 0x2741CE…" and rested an
 * argument on it: two divergences from the engine were called permanent
 * *because deployed*. Nobody had asked a chain. When one was finally asked,
 * three answered that the address holds no code and the fourth did not answer
 * at all — and the only network the project ever configured, Mumbai, was shut
 * down in April 2024.
 *
 * The distinction these tests exist to protect is the one an overclaim comes
 * from: **silence is not absence.** A probe that reports a timeout as "no
 * contract" produces exactly the kind of confident sentence that was wrong here
 * in the first place.
 */

describe('one answer', () => {
  it('is present when there is bytecode', () => {
    expect(classify({ jsonrpc: '2.0', id: 1, result: '0x6080604052' })).toBe(PRESENT);
  });

  it('is absent only when a chain actually said so', () => {
    expect(classify({ jsonrpc: '2.0', id: 1, result: '0x' })).toBe(ABSENT);
  });

  it('is unreachable for everything that is not an answer', () => {
    // Each of these has been mistaken for "no contract" by somebody's script.
    const notAnswers: unknown[] = [
      null,
      undefined,
      'rate limited',
      42,
      {},
      { error: { code: -32000, message: 'rate limited' } },
      { result: null },
      { result: 42 },
      { result: 'no' },
      { result: '' },
    ];

    for (const answer of notAnswers) {
      expect(classify(answer), JSON.stringify(answer) ?? 'undefined').toBe(UNREACHABLE);
    }
  });
});

describe('several answers together', () => {
  it('is present if any chain has it, because a contract found is found', () => {
    expect(summarise([UNREACHABLE, ABSENT, PRESENT])).toBe(PRESENT);
  });

  it('is absent only when every chain answered and none had it', () => {
    expect(summarise([ABSENT])).toBe(ABSENT);
    expect(summarise([ABSENT, ABSENT, ABSENT])).toBe(ABSENT);
  });

  it('is unreachable when nothing could be asked', () => {
    // The whole point. "We could not look" and "it is not there" are different
    // findings, and only one of them justifies rewriting a README.
    expect(summarise([UNREACHABLE, UNREACHABLE])).toBe(UNREACHABLE);
    expect(summarise([])).toBe(UNREACHABLE);
  });

  it('never turns silence into a finding, however much of it there is', () => {
    for (let chains = 1; chains <= 20; chains += 1) {
      const silent = Array.from({ length: chains }, () => UNREACHABLE);
      expect(summarise(silent), `${chains} silent chains`).toBe(UNREACHABLE);
    }
  });
});

/**
 * Every shape a run can have, rather than the four shapes somebody thought of.
 *
 * What used to be here was a list: `summarise([ABSENT, ABSENT, UNREACHABLE])`
 * asserted to be `ABSENT`, under a title that said "absent only when A chain
 * answered" while the module's own doc-comment said "every chain answered". Two
 * sentences about one function, disagreeing, and the weaker one was the one
 * with a test under it — so the enumerated case did not catch the defect, it
 * *was* the defect, written down twice.
 *
 * A grid cannot be written to agree with the code, because nobody enumerates
 * 363 rows by hand. It asserts the shape instead: whatever a reader would call a
 * run with a hole in it, this function calls one too.
 */
describe('over every combination of answers', () => {
  const VERDICTS: string[] = [PRESENT, ABSENT, UNREACHABLE];
  const LONGEST_RUN = 5;

  /** Every row of `length` verdicts, in order, so a failure names a real run. */
  function* rows(length: number): Generator<string[]> {
    if (length === 0) {
      yield [];
      return;
    }
    for (const head of VERDICTS) {
      for (const tail of rows(length - 1)) yield [head, ...tail];
    }
  }

  function* grid(): Generator<string[]> {
    for (let length = 1; length <= LONGEST_RUN; length += 1) yield* rows(length);
  }

  /** What the audit hands `exitCodeFor`: names attached, because people read it. */
  const asMap = (row: string[]): Map<string, string> =>
    new Map(row.map((verdict, index) => [`chain-${index}`, verdict]));

  it('covers what it claims to cover', () => {
    // 3 + 9 + 27 + 81 + 243. If this number drifts the grid below is quietly
    // smaller than its name, and a shrinking exhaustive test still passes.
    expect([...grid()]).toHaveLength(363);
  });

  it('never calls a run with a silent chain a bare absence', () => {
    for (const row of grid()) {
      if (!row.includes(UNREACHABLE)) continue;
      if (row.includes(PRESENT)) continue;

      const where = row.join(', ');
      expect(summarise(row), where).not.toBe(ABSENT);
      expect(exitCodeFor(asMap(row)), where).not.toBe(0);
    }
  });

  it('lets a contract that was found win outright, silence or not', () => {
    for (const row of grid()) {
      if (!row.includes(PRESENT)) continue;
      expect(summarise(row), row.join(', ')).toBe(PRESENT);
    }
  });

  it('is a complete answer exactly when every chain answered', () => {
    for (const row of grid()) {
      const complete = !row.includes(UNREACHABLE);
      const where = row.join(', ');

      expect(exitCodeFor(asMap(row)) === 0, where).toBe(complete);
      // 2 is this repository's code for "no answer for at least one of these",
      // the same one `audit-copies.mjs` exits with for a board it could not read.
      if (!complete) expect(exitCodeFor(asMap(row)), where).toBe(2);
    }
  });

  it('has a verdict for every row, and never an undefined one', () => {
    const allowed: string[] = [PRESENT, ABSENT, UNREACHABLE, PARTLY_ABSENT];
    for (const row of grid()) {
      expect(allowed, row.join(', ')).toContain(summarise(row));
    }
  });

  it('has no answer for a probe that asked nobody', () => {
    expect(summarise([])).toBe(UNREACHABLE);
    expect(exitCodeFor(new Map())).toBe(2);
  });
});

describe('what it tells a person', () => {
  const address = '0xabc';

  it('names every chain it asked and what each said', () => {
    const text = report(
      address,
      new Map([
        ['polygon', UNREACHABLE],
        ['ethereum', ABSENT],
      ]),
    );
    expect(text).toContain('polygon: unreachable');
    expect(text).toContain('ethereum: absent');
  });

  it('says what was concluded, and says it differently when nothing was', () => {
    const absent = report(address, new Map([['ethereum', ABSENT]]));
    const silent = report(address, new Map([['ethereum', UNREACHABLE]]));
    const found = report(address, new Map([['ethereum', PRESENT]]));

    expect(absent).toContain('holds no code');
    expect(silent).toContain('nothing was learned');
    expect(found).toContain('holds code');

    // Three findings, three sentences: a reader must not have to work out
    // which one they got.
    expect(new Set([absent, silent, found]).size).toBe(3);
  });

  it('names the chains that were not asked, in the conclusion', () => {
    // The recorded 2026-07-30 run, and the reason this test exists: it read
    // `holds no code on any chain that answered` and went into a README as a
    // finding. `polygon: unreachable` was listed four lines above it, and being
    // in the list is not being in the sentence somebody quotes.
    const text: string = report(
      '0xabc',
      new Map([
        ['polygon', UNREACHABLE],
        ['polygon-amoy', ABSENT],
        ['ethereum', ABSENT],
        ['bsc', ABSENT],
      ]),
    );

    const conclusion = text.split('\n').at(-1) ?? '';
    expect(conclusion).toContain('polygon');
    expect(conclusion).toContain('silent');
    expect(conclusion).toContain('3 of 4 chains answered');
  });

  it('says so when silence sat next to a contract it did find', () => {
    const text: string = report('0xabc', new Map([['polygon', UNREACHABLE], ['bsc', PRESENT]]));
    expect(text).toContain('holds code');
    expect(text).toContain('polygon was silent');
  });
});
