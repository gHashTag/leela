import { describe, expect, it } from 'vitest';
// @ts-expect-error - the audit's logic is plain JavaScript, shared with the script
import { bookGap, gaps, keyOf, sharedChapters, unrecorded } from '../../../scripts/lib/book.mjs';
import { LANGUAGES, bookFor, rulesFor } from '../src/index';

/**
 * Whether the rules book is the same book in every language.
 *
 * `audit-dataset` checks that a chapter is written in the script it is filed
 * under, and it caught an English book carrying a Russian seventh chapter.
 * Nothing asked whether the book has the same *chapters* everywhere, and it
 * does not: Ukrainian, Malay and Arabic carry `online` — a chat-moderation
 * policy, "the following topics are strictly forbidden: racism, nazism, drugs"
 * — and `foreword`, and have **no chapter on the chakras**. Two of the three
 * have no chapter on the meaning of the game either.
 *
 * They are the same three languages that came from the English edition rather
 * than the Russian one, found in the pass before this. A different donor, a
 * different contents page, and nothing in this repository looking at it — so a
 * reader in those languages opened the rules and the chakras were simply not
 * there.
 *
 * The rule is stated over what the two editions agree on: they are the sources
 * every other language came through one of, so a chapter both of them teach is
 * a chapter every reader is owed. A chapter only one has is that edition's own
 * choice, and lacking it is not a loss.
 */

const chapter = (slug: string) => ({ slug, title: slug, body: 'text', source: 'test' });

describe('what every reader is owed', () => {
  it('is what both editions teach, and not one edition’s own choices', () => {
    const english = [chapter('summary'), chapter('chakras'), chapter('notes')];
    const russian = [chapter('summary'), chapter('chakras'), chapter('appendix')];

    expect(sharedChapters(english, russian)).toEqual(['summary', 'chakras']);
  });

  it('is nothing at all when the two editions share nothing', () => {
    expect(sharedChapters([chapter('a')], [chapter('b')])).toEqual([]);
  });
});

describe('one book against that floor', () => {
  const shared = ['summary', 'meaning', 'chakras'];

  it('names what is missing and what arrived instead', () => {
    const book = [chapter('summary'), chapter('online'), chapter('foreword')];

    expect(bookGap(book, shared)).toEqual({
      missing: ['meaning', 'chakras'],
      extra: ['online', 'foreword'],
    });
  });

  it('treats extra chapters as extra, not as a fault', () => {
    // `online` and `foreword` are real text somebody wrote. A book with more in
    // it than the English one is a book with more in it.
    const book = [...shared.map(chapter), chapter('foreword')];

    expect(bookGap(book, shared).missing).toEqual([]);
    expect(bookGap(book, shared).extra).toEqual(['foreword']);
  });

  it('reports only the books with something missing, in a fixed order', () => {
    // A report that reorders itself between two runs over the same data is a
    // report nobody can diff.
    const books = {
      uk: [chapter('summary')],
      de: shared.map(chapter),
      ar: [chapter('summary'), chapter('meaning')],
    };

    expect(gaps(books, shared).map(keyOf)).toEqual([
      'ar: chakras',
      'uk: meaning,chakras',
    ]);
  });

  it('fails only on a book nobody has recorded', () => {
    const found = ['uk: meaning,chakras'];

    expect(unrecorded(found, ['uk: meaning,chakras'])).toEqual([]);
    expect(unrecorded([...found, 'de: chakras'], found)).toEqual(['de: chakras']);
  });
});

describe('the book a reader actually gets', () => {
  it('leaves nobody without a chapter both editions teach', () => {
    // The whole point, over the shipped data rather than a fixture: whatever
    // English and Russian agree on, every reader can reach.
    const shared = sharedChapters(rulesFor('en'), rulesFor('ru')) as string[];

    for (const language of LANGUAGES) {
      const covered = new Set(bookFor(language).map((chapter) => chapter.slug));
      for (const slug of shared) expect(covered.has(slug), `${language}/${slug}`).toBe(true);
    }
  });

  it('marks what it borrowed and nothing else', () => {
    for (const language of LANGUAGES) {
      const own = new Set(rulesFor(language).map((chapter) => chapter.slug));
      if (own.size === 0) continue;

      for (const entry of bookFor(language)) {
        expect(entry.borrowed ?? false, `${language}/${entry.slug}`).toBe(!own.has(entry.slug));
      }
    }
  });

  it('never displaces what the reader’s own book has', () => {
    // A borrowed chapter is an addition. Pushing somebody's own text down the
    // list to make room for English would be the cure being the disease.
    for (const language of LANGUAGES) {
      const own = rulesFor(language);
      if (own.length === 0) continue;

      expect(bookFor(language).slice(0, own.length), language).toEqual(own);
    }
  });
});
