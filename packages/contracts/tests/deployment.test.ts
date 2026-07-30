import { describe, expect, it } from 'vitest';
// @ts-expect-error — a plain module, shared with the scripts that use it.
import { ABSENT, PRESENT, UNREACHABLE, classify, describe as report, summarise } from '../../../scripts/lib/deployment.mjs';

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

  it('is absent only when a chain answered and none had it', () => {
    expect(summarise([ABSENT, ABSENT, UNREACHABLE])).toBe(ABSENT);
    expect(summarise([ABSENT])).toBe(ABSENT);
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
});
