import { describe, expect, it } from 'vitest';
// @ts-expect-error - the audit's logic is plain JavaScript, shared with the script
import { lossesIn, lostFrom, numbersIn, toAsciiDigits, unrecorded } from '../../../scripts/lib/numbers.mjs';

/**
 * The board references inside the traditional text.
 *
 * The plans talk about the board: "(field 72)", "boxes 38, prana, 39, apana",
 * "until he reaches field 68" — and plan 9 argues from arithmetic,
 * `9x5=45=9; 9x6=54=9; …`. A cross-reference whose number is gone points
 * nowhere, and an argument whose premises are gone is not an argument. The
 * companion now quotes this text and is told *it is the source; you are not*.
 *
 * The translation audit before this one checked terms — transliterations,
 * duplicate bodies, script density — found nothing, and was looking one layer
 * above the damage.
 *
 * Most of this file is about the three false alarms that had to be closed
 * before the real finding could be believed, because a check that cries wolf in
 * eight languages is a check nobody reads. That is the shape being asserted: a
 * loss is a number **both editions state** and the translation does not, in the
 * numerals and grouping that language actually writes.
 */

const plan = (n: number, body: string) => ({ plan: n, title: `Plan ${n}`, body });

describe('a number is the same number however it is written', () => {
  it('reads the digits of every script the 22 languages use', () => {
    // A `\d` scan reports every number in Arabic, Urdu, Hindi and Marathi as
    // missing — a check failing loudest exactly where it understands least.
    for (const [written, meant] of [
      ['٦٨', '68'], // Arabic-Indic
      ['۶۸', '68'], // Extended Arabic-Indic — Urdu
      ['६८', '68'], // Devanagari — Hindi, Marathi
      ['৬৮', '68'], // Bengali
      ['੬੮', '68'], // Gurmukhi — Punjabi
      ['௬௮', '68'], // Tamil
      ['౬౮', '68'], // Telugu
      ['６８', '68'], // Fullwidth — CJK
    ] as const) {
      expect(toAsciiDigits(written), written).toBe(meant);
      expect(numbersIn(`field ${written}`), written).toEqual([meant]);
    }
  });

  it('reads a grouped thousand as one number, not two', () => {
    // `72,000` and `72 000` and `72000` are one number written three ways, and
    // comparing them naively made every language — English included — look
    // damaged in plan 9.
    for (const written of ['72000', '72,000', '72 000', '72.000']) {
      expect(numbersIn(`there are ${written} of them`), written).toEqual(['72000']);
    }
  });

  it('does not mistake a list of squares for a grouped number', () => {
    // "boxes 38, 39 and 40" is three cross-references. The rule is that a
    // separator only groups when exactly three digits follow it.
    expect(numbersIn('see boxes 38, 39, and 40')).toEqual(['38', '39', '40']);
    expect(numbersIn('9x5=45=9; 9x6=54=9')).toEqual(['9', '5', '45', '9', '9', '6', '54', '9']);
  });
});

describe('what counts as a loss', () => {
  const russian = 'до поля 68 и клетки 21';
  const english = 'until field 68 and box 21';

  it('is a number both editions state and the translation does not', () => {
    expect(lostFrom('до поля 68', russian, english)).toEqual(['21']);
    expect(lostFrom('until field 68 and box 21', russian, english)).toEqual([]);
  });

  it('is not a difference between the two editions themselves', () => {
    // Ukrainian, Malay and Arabic follow the English text and the rest follow
    // the Russian, and the editions phrase things differently. A number only
    // one of them carries is a phrasing choice, and flagging it would bury the
    // real finding under noise.
    // 45 is only in the Russian and 72 is in both: the first is a phrasing
    // choice, the second is a loss, and only the second is reported.
    expect(lostFrom('a translation of neither', 'поле 45 и 72', 'field 72')).toEqual(['72']);
    expect(lostFrom('field 72 kept', 'поле 45 и 72', 'field 72')).toEqual([]);
  });

  it('is not a number written in the language’s own digits', () => {
    expect(lostFrom('حتى الحقل ٦٨ والمربع ٢١', russian, english)).toEqual([]);
  });

  it('reads the same way twice', () => {
    // Sorted numerically, because a report that reorders itself between two
    // runs over the same data is a report nobody can diff.
    expect(lostFrom('nothing here', 'поля 68, 21, 100', 'fields 68, 21, 100')).toEqual([
      '21',
      '68',
      '100',
    ]);
  });
});

describe('the audit over a whole language', () => {
  const russian = [plan(9, 'девять: 9x5=45'), plan(60, 'до поля 68'), plan(1, 'ничего')];
  const english = [plan(9, 'nine: 9x5=45'), plan(60, 'until field 68'), plan(1, 'nothing')];

  it('names the plan and the numbers, and says nothing about the rest', () => {
    const damaged = [plan(9, 'nine: nine times five'), plan(60, 'until field 68'), plan(1, 'x')];

    expect(lossesIn(damaged, russian, english)).toEqual([{ plan: 9, lost: ['5', '9', '45'] }]);
  });

  it('is silent on a translation that kept everything', () => {
    expect(lossesIn(english, russian, english)).toEqual([]);
  });

  it('ignores a plan the editions do not both have', () => {
    // A language mid-build, or a plan added on one side: neither is a lost
    // cross-reference, and reporting it as one would be this audit inventing
    // damage.
    expect(lossesIn([plan(70, 'no source for this one')], russian, english)).toEqual([]);
  });
});

describe('what is already known', () => {
  it('fails only on damage nobody has seen before', () => {
    // The losses found are real and cannot be repaired here — repairing means
    // translating, which needs a service this repository does not call. So they
    // are recorded, named every run, and the audit's job is the forty-third.
    const found = ['uk/60: 68', 'ms/51: 72'];

    expect(unrecorded(found, ['uk/60: 68', 'ms/51: 72'])).toEqual([]);
    expect(unrecorded([...found, 'de/9: 45'], found)).toEqual(['de/9: 45']);
  });

  it('does not treat a repaired line as new damage', () => {
    expect(unrecorded(['uk/60: 68'], ['uk/60: 68', 'ms/51: 72'])).toEqual([]);
  });
});
