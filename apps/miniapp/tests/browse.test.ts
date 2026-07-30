import { describe, expect, it } from 'vitest';
import { LANGUAGES, rulesFor, type Language } from '@leela/content';
import { TOTAL_PLANS } from '@leela/engine';
import { planEntries, ruleEntries, ruleText, showsPathTools, type ReaderKind } from '../src/browse';

/**
 * The two lists the published app has and this one did not.
 *
 * `GameScreen`'s header carries two buttons: `:information_source:` opens
 * `RULES_SCREEN` and `:books:` opens `PLANS_SCREEN`. Both are lists of titles
 * that open a text — the rules book, and all 72 plans so a player can read a
 * square they have not landed on.
 *
 * The mini app had neither. It could read the plan you were standing on and
 * nothing else, and the rules book — carried in 22 languages since the third
 * pass — had no way in at all. A book nobody can open is a book nobody has.
 */

describe('every plan, so a square can be read before it is landed on', () => {
  it('lists all of them, in order, with no holes', () => {
    // The shape: a list with a gap in it is a list a player scrolls past
    // without noticing anything is missing.
    const entries = planEntries('en');

    expect(entries).toHaveLength(TOTAL_PLANS);
    expect(entries.map((entry) => entry.key)).toEqual(
      Array.from({ length: TOTAL_PLANS }, (_, index) => index + 1),
    );
  });

  it('gives every line something to read, in every language', () => {
    // A language missing a title still has a square. The number is the
    // fallback because the number is what the board shows.
    for (const language of LANGUAGES) {
      for (const entry of planEntries(language)) {
        expect(entry.title.trim().length, `${language}/${entry.key}`).toBeGreaterThan(0);
      }
    }
  });

  it('marks the square the player is standing on, and only that one', () => {
    const entries = planEntries('en', 41);
    expect(entries.filter((entry) => entry.here).map((entry) => entry.key)).toEqual([41]);
  });

  it('marks nothing when the player has not entered the game', () => {
    // Standing nowhere is a real state — everyone starts in it — and a list
    // that marked a square then would be pointing at a square nobody is on.
    expect(planEntries('en').some((entry) => entry.here)).toBe(false);
    expect(planEntries('en', 0).some((entry) => entry.here)).toBe(false);
  });
});

describe('the rules book, which had no way in', () => {
  it('lists the chapters the language actually has', () => {
    for (const language of LANGUAGES) {
      const entries = ruleEntries(language);
      expect(entries.length, language).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry.title.trim().length, `${language}/${entry.key}`).toBeGreaterThan(0);
      }
    }
  });

  it('opens every chapter it lists', () => {
    // The rule that matters for a list: nothing in it is a dead end.
    for (const language of LANGUAGES) {
      for (const entry of ruleEntries(language)) {
        const chapter = ruleText(language, String(entry.key));
        expect(chapter, `${language}/${entry.key}`).not.toBeNull();
        expect(chapter?.body.trim().length, `${language}/${entry.key}`).toBeGreaterThan(0);
      }
    }
  });

  it('falls back as a whole book rather than chapter by chapter', () => {
    // A book half in one language and half in another is worse than a book in
    // a language the reader can at least read.
    const unknown = 'zz' as Language;
    expect(ruleEntries(unknown).map((entry) => entry.key)).toEqual(
      rulesFor('en').map((chapter) => chapter.slug),
    );
  });

  it('marks a chapter borrowed from English, and only that one', () => {
    // Three books came through a different donor and are missing the chapter
    // on the chakras — Ukrainian and Malay the chapter on the meaning of the
    // game as well. `bookFor` borrows those so no reader is left without the
    // teaching; the list has to say which, because "written for you" and "the
    // only copy there is" are not the same offer.
    for (const language of LANGUAGES) {
      const own = new Set(rulesFor(language).map((chapter) => chapter.slug));
      if (own.size === 0) continue;

      for (const entry of ruleEntries(language)) {
        expect(entry.borrowed ?? false, `${language}/${entry.key}`).toBe(!own.has(String(entry.key)));
      }
    }
  });

  it('borrows something somewhere, or the marking is untested', () => {
    // Guards the check above from passing for want of a case.
    const borrowed = LANGUAGES.flatMap((language) =>
      ruleEntries(language).filter((entry) => entry.borrowed),
    );

    expect(borrowed.length).toBeGreaterThan(0);
  });

  it('has nothing to open for a chapter no book has', () => {
    expect(ruleText('en', 'no-such-chapter')).toBeNull();
  });

  it('never hands a reader a chapter titled with its own slug', () => {
    // The slug is the last-resort title, and if it ever shows up on screen the
    // data is wrong rather than the list.
    for (const language of LANGUAGES) {
      for (const entry of ruleEntries(language)) {
        expect(entry.title, `${language}/${entry.key}`).not.toBe(entry.key);
      }
    }
  });
});

describe("the journal's own controls", () => {
  /**
   * "Save a copy" and "Bring one back" export and import the player's journal,
   * and they live in the same dialog as the plan texts. Only the export was
   * ever hidden — so reading a plan showed a "Bring one back" button under the
   * traditional text of the square you were standing on, and the rules book
   * inherited it the day the rules book existed.
   *
   * Found by tapping through the app in a simulator rather than by reading it,
   * which is now three defects that way.
   */
  const KINDS: ReaderKind[] = ['plan', 'chapter', 'path'];

  it('belong to the journal and to nothing else', () => {
    // The rule, over every kind of thing the one reader can show — so a kind
    // added later has to decide rather than inherit.
    for (const kind of KINDS) {
      expect(showsPathTools(kind), kind).toBe(kind === 'path');
    }
  });

  it('are shown for the journal, which is what they are for', () => {
    expect(showsPathTools('path')).toBe(true);
  });
});
