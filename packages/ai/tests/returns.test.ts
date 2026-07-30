import { describe, expect, it } from 'vitest';
import { planFor } from '@leela/content';
import {
  MAX_RETURN_ENTRIES,
  summariseReturns,
  systemPrompt,
  type JourneyEntry,
} from '../src/index';

/**
 * The square the player is standing on, and the last times they stood on it.
 *
 * The journey the companion was given is the eight most recent squares. That is
 * recency, and recency is structurally blind to the one thing this game is
 * about. A player on 41 for the fourth time wrote about it in February and in
 * June; if forty squares have passed since, neither is inside the window, and
 * the companion meets the most loaded square in their game as though it were
 * new — while the app beside it shows all three accounts one under the other.
 *
 * So the rule is not "include more". It is: **whatever else is dropped, what
 * the player wrote on this square is not.**
 */

/** A long game: forty squares walked since the last time 41 came up. */
function longGame(): JourneyEntry[] {
  const early: JourneyEntry[] = [
    { plan: 41, text: 'February. I could not sit still on this one.' },
    { plan: 41, text: 'June. Quieter. The same question underneath.' },
  ];

  const since = Array.from({ length: 40 }, (_, index) => ({
    plan: ((index * 7) % 39) + 2, // never 41, and never past the board
    text: `Something about square ${index}.`,
  }));

  return [...early, ...since];
}

describe('what the player wrote here before', () => {
  it('reaches the model however far back it is', () => {
    // The shape of the defect: the entries are the first two of forty-two, and
    // the recency window cannot see them.
    const prompt = systemPrompt({ plan: 41, language: 'en', journey: longGame() });

    expect(prompt).toContain('February. I could not sit still');
    expect(prompt).toContain('June. Quieter.');
  });

  it('is nothing at all for a square never written about', () => {
    // 60 is outside the 2..40 the walk generates and is not 41.
    const prompt = systemPrompt({ plan: 60, language: 'en', journey: longGame() });
    expect(prompt).not.toContain('stood here before');
  });

  it('carries only this square, never another', () => {
    const summary = summariseReturns(longGame(), 41, 'en');

    for (const written of summary.split('\n').slice(1)) {
      expect(written.startsWith('41.'), written).toBe(true);
    }
  });

  it('is oldest first, which is the only order that says anything', () => {
    const summary = summariseReturns(longGame(), 41, 'en');
    expect(summary.indexOf('February')).toBeLessThan(summary.indexOf('June'));
  });

  it('says how many it left out rather than implying it showed them all', () => {
    // A summary that quietly drops five accounts is a companion reasoning from
    // a path it has been told is complete.
    const many = Array.from({ length: MAX_RETURN_ENTRIES + 3 }, (_, index) => ({
      plan: 41,
      text: `Account number ${index}.`,
    }));

    const summary = summariseReturns(many, 41, 'en');
    expect(summary).toContain(`of ${many.length} times`);
    expect(summary.split('\n')).toHaveLength(MAX_RETURN_ENTRIES + 1);
  });

  it('keeps the ones nearest to now when it cannot keep them all', () => {
    const many = Array.from({ length: MAX_RETURN_ENTRIES + 2 }, (_, index) => ({
      plan: 41,
      text: `Account number ${index}.`,
    }));

    const summary = summariseReturns(many, 41, 'en');
    expect(summary).toContain(`Account number ${many.length - 1}.`);
    expect(summary).not.toContain('Account number 0.');
  });

  it('says nothing rather than a heading with nothing under it', () => {
    // At a budget too small for a single line. The parameter exists so this is
    // tested rather than assumed.
    expect(summariseReturns(longGame(), 41, 'en', 5)).toBe('');
  });
});

describe('what the returns must not cost', () => {
  it('never crowds out the plan’s own text, which the answer rests on', () => {
    const prompt = systemPrompt({ plan: 41, language: 'en', journey: longGame() });
    const body = planFor('en', 41).body;

    expect(prompt).toContain(body.slice(0, 120));
  });

  it('never counts a square twice', () => {
    // The recent-squares section used to be everything, so a square that is
    // both recent and returned to would appear in both — budget spent saying
    // one thing, at the expense of the text.
    const journey: JourneyEntry[] = [
      { plan: 41, text: 'The older account.' },
      { plan: 3, text: 'Somewhere else.' },
      { plan: 41, text: 'The account from just now.' },
    ];

    const prompt = systemPrompt({ plan: 41, language: 'en', journey });
    const appearances = prompt.split('The account from just now.').length - 1;

    expect(appearances).toBe(1);
  });

  it('still tells the model the writing is the player’s and not to read it back', () => {
    const prompt = systemPrompt({ plan: 41, language: 'en', journey: longGame() });
    expect(prompt).toMatch(/not to read it back|Do not\s*\n?read it back/i);
  });

  it('never asks the model to supply the teaching', () => {
    // The rule the whole package exists for, restated over the new section: the
    // returns are the player's words, and the plan's text is the source.
    const prompt = systemPrompt({ plan: 41, language: 'en', journey: longGame() });

    expect(prompt).toContain('It is the source; you are not.');
    expect(prompt).not.toMatch(/write (a|the) (description|commentary) (of|for) (the |this )?plan/i);
  });
});
