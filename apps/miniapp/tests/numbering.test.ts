import { describe as group, expect, it } from 'vitest';

import { digitValue, numberIn, stripNumbering } from '../../../scripts/lib/numbering.mjs';

/**
 * Taking the plan number off the front of a title, in any script.
 *
 * The version this replaces searched for `String(plan)` — ASCII digits — and
 * stripped a separator from the list `[\s.:)\-–—、。]`. Its own comment records
 * that it was written because matching the WORD for "plan" in twenty-two
 * scripts *"does not scale and silently left the number in place for 15 of the
 * 22 languages"*. That was right, and it stopped one level short: it scaled
 * past the word and stayed in Latin for the digits and the stop.
 *
 * MEASURED against the shipped data on 2026-08-29 — seventy-three titles in
 * three languages still carried their label, and the fixtures below are those
 * titles, not inventions:
 *
 *     ur   49   "۔ پیدائش (جنما)"        ASCII numeral matched, Urdu stop left
 *     mr   20   "योजना ३. राग (क्रोधा)"    Devanagari numeral never matched
 *     bn    4   "পরিকল্পনা ২৮। প্রকৃত ধর্ম"  Bengali numeral and the danda
 */

group('reading a digit in any script', () => {
  it('values a digit its own runtime cannot parse', () => {
    /*
     * MEASURED, not assumed: `Number('३')`, `parseInt('३', 10)` and both
     * normalisation forms all give NaN or the character back. `\p{Nd}` matches
     * it, so a digit can be FOUND with a regular expression and cannot be
     * VALUED with one — which is the whole reason this function exists.
     */
    expect(Number('३')).toBeNaN();
    expect(digitValue('३')).toBe(3);
    expect(digitValue('২')).toBe(2);
    expect(digitValue('٧')).toBe(7);
    expect(digitValue('7')).toBe(7);
  });

  it('refuses what is not a digit', () => {
    expect(digitValue('x')).toBeNull();
    expect(digitValue('۔')).toBeNull();
    expect(digitValue('।')).toBeNull();
  });

  it('spells a whole number out of them', () => {
    expect(numberIn('২৮')).toBe(28);
    expect(numberIn('१२')).toBe(12);
    expect(numberIn('72')).toBe(72);
    expect(numberIn('1x')).toBeNull();
  });

  it('needs no table of scripts, which is the property that keeps it working', () => {
    /*
     * The zero of a digit run is found by walking back at most nine code
     * points to the first whose predecessor is not a digit. A table of scripts
     * would be a list nobody maintains and nobody notices going stale — this
     * repository's most-repeated defect — so the twenty-third language added
     * must work without an edit here. Four scripts the corpus does not use,
     * proving the rule is about Unicode rather than about this dataset.
     */
    expect(digitValue('٥')).toBe(5); // Arabic-Indic
    expect(digitValue('۵')).toBe(5); // Extended Arabic-Indic, Persian and Urdu
    expect(digitValue('๕')).toBe(5); // Thai
    expect(digitValue('௫')).toBe(5); // Tamil
  });
});

group('the numbering in front of a title', () => {
  it('takes a Latin label off, as it always did', () => {
    expect(stripNumbering('Plan 1. Birth (janma)', 1)).toBe('Birth (janma)');
    expect(stripNumbering('计划 12. 什么', 12)).toBe('什么');
  });

  it('takes the Urdu full stop that 49 titles kept', () => {
    // The ASCII numeral in «منصوبہ 1۔» was matched and the stop was not in the
    // old list, so the shipped title began with a full stop — and the book
    // prints its own "1." in front of it, giving the reader two.
    expect(stripNumbering('منصوبہ 1۔ پیدائش (جنما)', 1)).toBe('پیدائش (جنما)');
  });

  it('takes a label written in the language’s own digits', () => {
    // Twenty Marathi titles and four Bengali ones kept the whole label,
    // because `String(plan)` is "3" and the donor writes ३.
    expect(stripNumbering('योजना ३. राग (क्रोधा)', 3)).toBe('राग (क्रोधा)');
    expect(stripNumbering('पयोजना १२. मत्सर (इरस्य)', 12)).toBe('मत्सर (इरस्य)');
    expect(stripNumbering('পরিকল্পনা ২৮। প্রকৃত ধর্ম (সুধর্ম)', 28)).toBe('প্রকৃত ধর্ম (সুধর্ম)');
  });

  it('leaves a title that merely contains a number alone', () => {
    /*
     * The guard the old version had and this must keep. "The 3 gunas" is a
     * title with a number in it, not a numbered title, and the number is not
     * this plan's.
     */
    expect(stripNumbering('The 3 gunas', 40)).toBe('The 3 gunas');
    expect(stripNumbering('Plan 120. Not this', 12)).toBe('Plan 120. Not this');
  });

  it('leaves a number that is only far into the title alone', () => {
    // A label is a word or two. Past that we are reading a sentence.
    expect(stripNumbering('A very long preamble indeed 7. Something', 7)).toBe(
      'A very long preamble indeed 7. Something',
    );
  });

  it('keeps the title when cutting would leave nothing', () => {
    expect(stripNumbering('Plan 8.', 8)).toBe('Plan 8.');
    expect(stripNumbering('८', 8)).toBe('८');
  });

  it('answers null for nothing, because one caller has no heading', () => {
    expect(stripNumbering(null, 1)).toBeNull();
    expect(stripNumbering('', 1)).toBeNull();
  });
});
