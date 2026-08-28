import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe as group, expect, it } from 'vitest';

import { endsProperly, markupIn, proseProblems } from '../../../scripts/lib/prose.mjs';

/**
 * The shipped text is prose, and not the markup it was carried in.
 *
 * `audit-prose.mjs` is the gate; this is the check on the gate. Everything
 * here feeds it something a reader should never see and requires it to say so.
 *
 * The case it was written for: the Malay sixth plan carried a paragraph
 * reading `& Nbsp; & nbsp; & nbsp; & nbsp;`, and **a sweep for `&nbsp;` across
 * 1,584 bodies found nothing** — a translator that mangles an entity does not
 * leave it canonical. Half of these tests are about the mangled spellings,
 * because the tidy one was never the problem.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

group('markup a reader should never see', () => {
  it('CATCHES the shape that got past the first sweep', () => {
    // Exactly what shipped in Malay: a space after each ampersand, the first
    // one capitalised. `&nbsp;` would have been found by anybody looking.
    expect(markupIn('dipanggil\n\n& Nbsp; & nbsp; & nbsp; & nbsp;\n\nKrodh')).toContain(
      'an HTML entity',
    );
  });

  it('catches the tidy spelling too, and the numeric one', () => {
    expect(markupIn('a&nbsp;b')).toContain('an HTML entity');
    expect(markupIn('a&#160;b')).toContain('an HTML entity');
    expect(markupIn('a & AMP ; b')).toContain('an HTML entity');
  });

  it('catches the markdown a donor could leak', () => {
    expect(markupIn('# A heading\n\nwords')).toContain('a markdown heading');
    expect(markupIn('this is **bold** text')).toContain('markdown emphasis');
    expect(markupIn('see [the rules](rules.html)')).toContain('a markdown link');
    expect(markupIn('```\ncode\n```')).toContain('a fenced code block');
    expect(markupIn('<p>hello</p>')).toContain('an HTML tag');
  });

  it('leaves prose alone, including prose with punctuation in it', () => {
    /*
     * The half that decides whether anybody keeps this check. A reader that
     * calls ordinary text markup is a reader somebody switches off — so an
     * ampersand between words, a lone asterisk, brackets and a less-than sign
     * with a space after it all have to pass.
     */
    expect(markupIn('Krodh & Lobh are two of the four.')).toEqual([]);
    expect(markupIn('the sum is 9 * 280')).toEqual([]);
    expect(markupIn('a value < 5 is small')).toEqual([]);
    expect(markupIn('he said (in passing) that [see note] applies')).toEqual([]);
    expect(markupIn('снятие покровов — тапас')).toEqual([]);
  });

  it('answers for nothing without throwing', () => {
    expect(markupIn(null)).toEqual([]);
    expect(markupIn(undefined)).toEqual([]);
    expect(markupIn('')).toEqual([]);
  });
});

group('a body that finishes its last sentence', () => {
  it('knows the full stop of every script the book is set in', () => {
    /*
     * Six of the twenty-two do not use the Latin one, and a reader that knew
     * only `.` would call four whole editions truncated on every page — which
     * is how a check gets deleted rather than obeyed.
     */
    expect(endsProperly('This is a sentence.')).toBe(true);
    expect(endsProperly('یہ ایک جملہ ہے۔')).toBe(true); // Urdu
    expect(endsProperly('এটি একটি বাক্য।')).toBe(true); // danda
    expect(endsProperly('这是一个句子。')).toBe(true); // CJK
    expect(endsProperly('هل هذا سؤال؟')).toBe(true); // Arabic question mark
    expect(endsProperly('He said "yes."')).toBe(true); // a quote may follow
  });

  it('CATCHES a body that stops in the middle of a clause', () => {
    expect(endsProperly('The player moves to the next')).toBe(false);
    expect(endsProperly('The player moves,')).toBe(false);
  });

  it('refuses a colon and a semicolon on purpose', () => {
    /*
     * A body ending on either was about to say something. MEASURED: no plan in
     * any language ends on one today, so refusing them costs nothing now and
     * catches the next truncation.
     */
    expect(endsProperly('the four are:')).toBe(false);
    expect(endsProperly('one thing;')).toBe(false);
  });

  it('does not call an empty body truncated', () => {
    // Absent is a different finding, and `audit-dataset` already makes it.
    expect(endsProperly('')).toBe(true);
    expect(endsProperly(null)).toBe(true);
  });
});

group('the whole plan, as the audit reads it', () => {
  it('names the field, because a title is a different repair from a body', () => {
    const problems = proseProblems({
      language: 'ms',
      plan: 6,
      title: 'Delusion',
      description: null,
      body: 'called\n\n& Nbsp;\n\nmore.',
    });

    expect(problems).toEqual(['ms plan 6 body: an HTML entity']);
  });

  it('says nothing about a plan that is prose and finished', () => {
    expect(
      proseProblems({ language: 'en', plan: 1, title: 'Birth (janma)', description: null, body: 'A sentence.' }),
    ).toEqual([]);
  });

  it('is true of the shipped data, which is the claim the audit makes', () => {
    /*
     * Over the real corpus rather than a fixture: a reader that works on
     * examples and not on the thing it was written for is worth nothing. The
     * Malay sixth plan is the one this whole file exists for, so it is named.
     */
    const malay = JSON.parse(readFileSync(resolve(ROOT, 'packages/content/data/plans.ms.json'), 'utf8'));
    const six = malay.find((plan: { plan: number }) => plan.plan === 6);

    expect(six.body).not.toMatch(/&/);
    expect(proseProblems({ language: 'ms', ...six })).toEqual([]);
  });
});
