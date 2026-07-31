import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LANGUAGES, plansFor } from '../src';
import {
  alsoWrittenOutSomewhere,
  editionOf,
  identifyingTerms,
  kindOf,
  lossesIn,
  lostFrom,
  namesOf,
  numbersIn,
  toAsciiDigits,
  unrecorded,
  withoutArithmetic,
  withoutEnumeration,
  writtenOut,
  // @ts-expect-error - the audit's logic is plain JavaScript, shared with the script
} from '../../../scripts/lib/numbers.mjs';

/** The editions nothing ships, which the audits read to tell a loss from a difference. */
const readEdition = (name: string) =>
  JSON.parse(readFileSync(new URL(`../data/editions/${name}.json`, import.meta.url), 'utf8'));

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
    // No language was translated from the same edition as its neighbour, and
    // the editions phrase things differently. A number only one of them carries
    // is a phrasing choice, and flagging it would bury the real finding under
    // noise. Which edition each language came from is `editionOf`'s question,
    // below — this one is about what follows once it is answered.
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
  // The fixture was `9x5=45` until the pass that took equations out of this
  // question — which turned it into a test of the exclusion rather than of the
  // audit. A cross-reference says the same thing about the audit and is what
  // the audit is for.
  const russian = [plan(9, 'девять: см. поля 45 и 54'), plan(60, 'до поля 68'), plan(1, 'ничего')];
  const english = [plan(9, 'nine: see fields 45 and 54'), plan(60, 'until field 68'), plan(1, 'nothing')];

  it('names the plan and the numbers, and says nothing about the rest', () => {
    const damaged = [plan(9, 'nine: see the fields'), plan(60, 'until field 68'), plan(1, 'x')];

    expect(lossesIn(damaged, russian, english)).toEqual([{ plan: 9, lost: ['45', '54'] }]);
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

describe('a reference written as a word is not a missing one', () => {
  /**
   * The fourth false alarm, and the only one that had been believed. This check
   * counts digits, so a translation that spells a number out reads as damage —
   * and six of the forty-two recorded losses were exactly that. The worst was
   * Ukrainian plan 60, whose sentence carries the *winning square* in full:
   * `шістдесят восьмий квадрат`. The audit called it gone.
   *
   * The shape, not the six: **the check must be about the reference, and a
   * reference is not a numeral.** Whether a language writes it in digits is a
   * fact about the language, and this repository has already learned that
   * lesson three times — Arabic digits, grouped thousands, two source editions —
   * each time by reporting damage that was not there.
   */
  const russian = 'Но пока он не достигнет поля 68, четыре аспекта продолжают работать.';
  const english = 'But until he reaches field 68, the four aspects continue to work.';

  it('counts a spelled-out reference as present', () => {
    const ukrainian = 'Але поки не досягнуть шістдесят восьмий квадрат, чотири здібності працюють.';

    expect(lostFrom(ukrainian, russian, english, 'uk')).toEqual([]);
    expect(lostFrom(ukrainian, russian, english, ''), 'and only for the language it was read in')
      .toEqual(['68']);
  });

  it('still counts a reference that is really gone', () => {
    // The guard against the fix becoming a way of not seeing anything: a
    // sentence with the number nowhere in it, in words or figures, is a loss.
    const ukrainian = 'Але поки він не досягне мети, чотири здібності продовжують працювати.';

    expect(lostFrom(ukrainian, russian, english, 'uk')).toEqual(['68']);
  });

  it('knows a word form only where somebody read it', () => {
    // Every entry is a quotation from the file it came from, not vocabulary.
    // A language that has never been read gets no benefit of the doubt.
    expect(writtenOut('uk', 68, 'шістдесят восьмий квадрат')).toBe(true);
    expect(writtenOut('ta', 68, 'шістдесят восьмий квадрат'), 'never read').toBe(false);
    expect(writtenOut('uk', 45, 'шістдесят восьмий квадрат'), 'a number never read').toBe(false);
  });

  /**
   * Reading is done one file at a time, and nothing pointed from one to the
   * next. `uk/68` was excused eleven passes ago; the same sentence in Malay and
   * Arabic — *until the sixty-eighth square is reached*, spelled out in both —
   * stayed in the recorded damage the whole time, and so did *the eighth plane*
   * in three languages and *four aspects* in three more.
   *
   * Eight records, and every one of them was found by this: a number one
   * translator wrote as a word is a number to check the others for. The audit
   * cannot read Malay. It can say where to look.
   */
  it('says which numbers somebody somewhere writes as a word', () => {
    expect(alsoWrittenOutSomewhere(68), 'read in three languages now').toBe(true);
    expect(alsoWrittenOutSomewhere(4), 'the four aspects of mind').toBe(true);
    expect(alsoWrittenOutSomewhere(72), 'nobody has seen this one spelled out').toBe(false);
  });
});

describe('a translation is judged against the edition it was made from', () => {
  /**
   * The third false alarm, closed against the wrong English for as long as this
   * check has existed.
   *
   * *Not every language was translated from the same edition* — the audit knew
   * that and compared everything to the one English this dataset ships. Arabic,
   * Malay and Ukrainian come from `leela/src/locales/<lang>`, whose sibling is
   * `leela/src/locales/en`: a **third** edition, older and shorter, which the
   * generator reads and throws away. It says *the snake of tamoguna* where the
   * shipped English says *the tamoguna square (field 72)*, and *see the lokas
   * prana, apana and vyana* where the shipped one numbers all three.
   *
   * So twenty-one of twenty-three recorded losses were translations faithfully
   * carrying a sentence that never had a number in it. The two that remain are
   * real, and both were read: `leela-en` states *72,000 nerves in the body,
   * called nadis* and the Arabic keeps `nadi` without the number; it states
   * *(see square 11)* on plan 23 and the Ukrainian has no 11 anywhere.
   *
   * What is asserted is the shape: which edition a language followed is read
   * off the plans themselves, because every plan carries the file it came from.
   * A list of three language codes would have been a fourth thing to keep by
   * hand.
   */
  it('reads the edition off the plans rather than off a list', () => {
    expect(editionOf(plansFor('ar')), 'the published app’s locales').toBe('leela-en');
    expect(editionOf(plansFor('ms'))).toBe('leela-en');
    expect(editionOf(plansFor('uk'))).toBe('leela-en');

    // The nineteen machine translations came from `translate-leela/docs`, which
    // is English and is *not* the English this dataset ships —
    // `NeuroLeelaAgent/docs/plans/1-birth.md` is 2,240 bytes where
    // `translate-leela/docs/1-birth.md` is 1,977, and they say different things.
    // This was written down as *the rest follow the Russian* for a long time.
    expect(editionOf(plansFor('de')), 'a translation of English, not of Russian').toBe(
      'translate-leela-en',
    );
    expect(editionOf(plansFor('zh'))).toBe('translate-leela-en');

    // The two originals are nobody's translation.
    expect(editionOf(plansFor('ru'))).toBe(null);
    expect(editionOf(plansFor('en'))).toBe(null);
  });

  it('every shipped language names an edition or is an original', () => {
    // The shape rather than the twenty-two: a language whose edition is unknown
    // is judged against the shipped English by default, and a default that is
    // wrong is what this pass and the one before it were both about.
    for (const language of LANGUAGES) {
      const edition = editionOf(plansFor(language));
      const original = language === 'en' || language === 'ru';

      expect(original ? edition === null : typeof edition === 'string', language).toBe(true);
    }
  });

  it('says nothing when the edition never stated the number', () => {
    // The whole finding, as a shape: a number the *shipped* English states and
    // the translation's own edition does not is not a loss, however loudly the
    // shipped one says it.
    const shipped = 'a snake leading from the tamoguna square (field 72)';
    const ownEdition = 'the snake of tamoguna, to bring them back to earth';
    const translated = 'ular tamoguna, untuk membawa mereka kembali ke bumi';

    expect(lostFrom(translated, 'змея тамогуны (поле 72)', shipped, 'ms')).toEqual(['72']);
    expect(lostFrom(translated, 'змея тамогуны (поле 72)', ownEdition, 'ms')).toEqual([]);
  });

  it('still says so when the edition did state it', () => {
    // The guard against the fix becoming a way of seeing nothing. `leela-en`
    // states 72,000 nadis and the Arabic dropped the number: still a loss.
    const ownEdition = 'There are 72,000 nerves in the body, called nadis.';

    expect(lostFrom('يوجد في الجسم أعصاب تسمى نادي.', 'В теле 72 000 нервов, нади.', ownEdition, 'ar'))
      .toEqual(['72000']);
  });

  it('has an edition that covers every plan the languages using it have', () => {
    // A plan the edition lacks is a plan nothing is expected of, so every number
    // in it is excused — and a silent excuse reads exactly like a language with
    // nothing wrong. The editions are generated: a rebuild from a moved source
    // directory would empty this file and turn the audit green.
    for (const language of LANGUAGES) {
      const name = editionOf(plansFor(language));
      if (name === null) continue;

      const edition = readEdition(name);
      expect(edition.length, name).toBe(72);
      for (const plan of plansFor(language)) {
        expect(
          edition.some((one: { plan: number }) => one.plan === plan.plan),
          `${language}/${plan.plan} against ${name}`,
        ).toBe(true);
      }
    }
  });
});

describe('a numbered list is not a set of squares', () => {
  /**
   * The fifth false alarm, and the same mistake as the times tables: a numeral
   * that was never a board reference, counted as one. Plan 6 lists the four
   * possessions and both editions number them `1.` to `4.`; Arabic, Malay and
   * Ukrainian keep all four items and drop the numbering.
   *
   * The tell was in the record itself. It said `1,4` in all three languages and
   * never `2,3` — because those two digits happen to occur elsewhere in each of
   * those bodies, and the check asked only whether a number appeared *anywhere*.
   * A record that reports two items of a list of four is not reporting a list.
   */
  const listed = (opening: string) =>
    `${opening}\n\n1. kama,\n\n2. krodha,\n\n3. lobha,\n\n4. moha.\n\nAnd so on.`;

  it('does not expect a translation to keep the numbering', () => {
    const source = listed('There are four possessions.');
    const translated = 'Empat: kama, krodha, lobha, moha. Dan seterusnya.';

    expect(lostFrom(translated, source, source, 'ms')).toEqual([]);
  });

  it('still expects the squares the same plan points at', () => {
    // The guard against the exclusion becoming a way of seeing nothing: a plan
    // with a list in it is still a plan that can lose a cross-reference.
    const source = `${listed('See field 45 first.')}`;

    expect(lostFrom('Empat: kama, krodha, lobha, moha.', source, source, 'ms')).toEqual(['45']);
  });

  it('is a run from one, and long enough to be a list', () => {
    // Two numbered items are not distinguishable from sentences that open with
    // a figure, and a run starting at 5 continues something this plan does not
    // contain. Both must keep their numbers.
    expect(numbersIn(withoutEnumeration('\n1. one\n\n2. two\n'))).toEqual(['1', '2']);
    expect(numbersIn(withoutEnumeration('\n5. five\n\n6. six\n\n7. seven\n'))).toEqual([
      '5',
      '6',
      '7',
    ]);
    expect(numbersIn(withoutEnumeration('\n1. one\n\n2. two\n\n3. three\n'))).toEqual([]);
  });

  it('leaves a figure that merely ends a sentence alone', () => {
    // `field 45.` is not item 45 of anything, and a rule keyed on the full stop
    // rather than the line would eat it.
    expect(numbersIn(withoutEnumeration('He reaches field 45. Then 46.'))).toEqual(['45', '46']);
  });
});

describe('what kind of loss a record is, asked of the edition itself', () => {
  /**
   * Two very different things had been recorded under one word. One repair is a
   * numeral put back where a sentence already points; the other is a sentence
   * to write, and only the first can be done without a translator.
   *
   * It used to be five lines somebody had read — a sample, not a record, and
   * wrong in one of the five. What replaces them asks the *translation* which
   * square a term is, because every locale keeps the parenthesised
   * transliteration in its own titles. So the mapping is inside the file being
   * judged rather than trusted from the English one.
   */
  const edition = [
    { plan: 38, title: 'Plane of life energy (prana-loka)', body: '' },
    { plan: 39, title: 'Plane of elimination (apana-loka)', body: '' },
    { plan: 44, title: 'Ignorance', body: '' },
  ];

  it('says a reference survives when the plan still names the square', () => {
    const terms = identifyingTerms(edition);

    expect(kindOf('see the lokas prana and apana', 38, terms)).toEqual({
      kind: 'numeral only',
      names: ['prana'],
    });
    expect(kindOf('the four faculties continue to work', 38, terms)).toEqual({
      kind: 'reference gone',
      names: [],
    });
  });

  it('says nothing at all about a square with no name of its own', () => {
    // `Ignorance`, `Earth`: nothing to look for, so silence rather than a guess
    // dressed as an answer. A classifier that answers a third of the time was
    // written once and thrown away; this one declines out loud.
    expect(kindOf('anything', 44, identifyingTerms(edition))).toBe(null);
  });

  it('ignores a word that names more than one square', () => {
    // `loka` is in a dozen titles and tells them apart from nothing. Dropping it
    // takes no vocabulary and no list — only counting, which is what keeps this
    // working in scripts nobody here reads.
    const terms = identifyingTerms(edition);

    expect(namesOf('this plan mentions a loka', 38, terms)).toEqual([]);
    expect([...terms.get(38)]).toEqual(['prana']);
  });

  it('reads whole words', () => {
    // `prana` inside `pranayama` is a different word, and counting it would
    // report a sentence about breathing exercises as a surviving cross-reference
    // to square 38.
    const terms = identifyingTerms(edition);

    expect(namesOf('the practice of pranayama', 38, terms)).toEqual([]);
    expect(namesOf('the prana, which is vital force', 38, terms)).toEqual(['prana']);
  });
});

describe('a board reference is not a term in a times table', () => {
  /**
   * Plans 8 and 9 argue from arithmetic — *eight is a number that decreases
   * when multiplied*, and nine is one that does not — and each lists its own
   * multiplication table. This check was reading every term of those tables as
   * a cross-reference to a square, so a translation that writes a shorter table
   * was reported as having lost the board. Five of the thirty-six records were
   * that, and nothing else.
   *
   * Those tables belong to `audit-arithmetic`, which holds them to a stricter
   * rule than presence: every product checked, in every language. Two checks,
   * two questions. This one asks whether a sentence still points at the square
   * it points at.
   *
   * What the exclusion must not do is hide a reference that happens to sit in
   * the same plan as a table — which is how `72000` came out of the Arabic
   * record it had been buried in.
   */
  const table = 'Nine keeps itself: 9x5=45=9; 9x6=54=9; 9x7=63=9.';

  it('leaves the terms out of a loss, and in the reading', () => {
    // `numbersIn` still reports them: somebody asking what numbers a text
    // states wants the table. A *loss* is the other question.
    expect(numbersIn(table)).not.toEqual([]);
    expect(numbersIn(withoutArithmetic(table))).toEqual([]);
  });

  it('still reads the numbers around one', () => {
    expect(numbersIn(withoutArithmetic(`There are 72000 nadis. ${table} And field 68.`))).toEqual([
      '72000',
      '68',
    ]);
  });

  it('counts a shorter table as no loss at all', () => {
    // The Ukrainian shape: fewer rows, every product correct. `lostFrom` used
    // to call the missing rows lost board references.
    const shorter = 'Дев’ять зберігає себе: 9х5=45=9.';

    expect(lostFrom(shorter, table, table, 'uk')).toEqual([]);
  });

  it('still sees a reference lost from a plan that has a table in it', () => {
    const withoutTheNadis = 'Дев’ять зберігає себе: 9х5=45=9.';
    const source = `There are 72000 nadis. ${table}`;

    expect(lostFrom(withoutTheNadis, source, source, 'uk')).toEqual(['72000']);
  });
});

describe('the evidence behind a record is in the data', () => {
  /**
   * What the derivation says about the shipped translations, against what four
   * passes of reading them by hand said.
   *
   * This is the check on the check. A rule that classifies thirty-one records
   * is worth nothing if it disagrees with the sentences somebody actually read,
   * and it agrees with all four that were read correctly: Malay plan 30 keeps
   * `prana` and `apana` and has lost `vyana`; plan 51 keeps `tamoguna`;
   * Ukrainian plan 30 has lost all three and plan 44 has lost `jnana`.
   *
   * It disagrees with the fifth, and the fifth was wrong. `ms/60` was written
   * down as *the sentence is still there, pointing at a square it no longer
   * numbers* — but the sentence numbers it, in words: `sehingga persegi enam
   * puluh lapan dicapai`. The reading had named `buddhi` and `ahamkara`, which
   * are terms of plan 60 itself and not of square 68, so the note was true about
   * the wrong squares.
   */
  const bodyOf = (language: string, plan: number) =>
    plansFor(language).find((entry) => entry.plan === plan)?.body ?? '';
  const termsOf = (language: string) => identifyingTerms(plansFor(language));

  it('agrees with what Malay was read to keep', () => {
    const terms = termsOf('ms');

    expect(kindOf(bodyOf('ms', 30), 38, terms).kind).toBe('numeral only');
    expect(kindOf(bodyOf('ms', 30), 39, terms).kind).toBe('numeral only');
    expect(kindOf(bodyOf('ms', 30), 40, terms).kind, 'vyana was never claimed').toBe(
      'reference gone',
    );
    expect(kindOf(bodyOf('ms', 51), 72, terms).kind).toBe('numeral only');
  });

  it('agrees with what Ukrainian was read to have lost', () => {
    const terms = termsOf('uk');

    for (const square of [38, 39, 40]) {
      expect(kindOf(bodyOf('uk', 30), square, terms).kind, `square ${square}`).toBe(
        'reference gone',
      );
    }
    expect(kindOf(bodyOf('uk', 44), 37, terms).kind).toBe('reference gone');
  });

  it('reads each translation with its own titles, not the English ones', () => {
    // Arabic keeps the same two references Malay does, and says so in Arabic:
    // `برانا` and `أبانا` are what `(برانا لوكا)` on plan 38 makes findable. A
    // check that looked terms up in English would call this a total loss.
    expect(kindOf(bodyOf('ar', 30), 38, termsOf('ar'))).toEqual({
      kind: 'numeral only',
      names: ['برانا'],
    });
  });

  it('and the numbers are still missing, which is why the lines are recorded', () => {
    // The guard against a record outliving its reason: if a numeral comes back,
    // `audit-numbers` says to take the line out, and this says so too.
    expect(numbersIn(bodyOf('ms', 30))).not.toContain('38');
    expect(numbersIn(bodyOf('uk', 44))).not.toContain('37');
  });

  it('no longer records the plan whose sentence spells the number out', () => {
    // `ms/60` and `ar/60` said *until the sixty-eighth square is reached* the
    // whole time, in words, exactly as the Ukrainian that was excused for it.
    expect(writtenOut('ms', 68, bodyOf('ms', 60)), 'enam puluh lapan').toBe(true);
    expect(writtenOut('ar', 68, bodyOf('ar', 60)), 'الثامن والستين').toBe(true);
    expect(writtenOut('uk', 68, bodyOf('uk', 60)), 'шістдесят восьмий').toBe(true);
  });
});
