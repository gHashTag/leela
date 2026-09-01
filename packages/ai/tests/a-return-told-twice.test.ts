/**
 * What the companion is told about a player who has been here before.
 *
 * `systemPrompt` gives a return a section of its own, and a sentence saying why
 * it has one: *returning is what this game is about: the same state arrives
 * again, and what changed between the tellings is the thing worth noticing.*
 *
 * The two callers hand it the path with the entry being answered removed, so
 * that the words being answered are not also offered as history. Both removed
 * it by content — every entry saying what this one says — so a player who came
 * back to a square and wrote the same sentence again had **both** tellings
 * dropped, and the section was never reached. A return told in different words
 * was reported; the same return told in the same words was invisible.
 *
 * These assert the consequence rather than the helper: whatever the player
 * wrote, if they have written on this square before, the companion is told.
 */

import { describe, expect, it } from 'vitest';
import { withoutOne, type Report } from '@leela/journal';
import { systemPrompt } from '../src/prompts';

const RETURNED = 'They have stood here before';

const wrote = (plan: number, text: string, at: number): Report => ({ plan, text, at });

/** Exactly what a caller does: the path, minus the entry being answered. */
const journeyFor = (history: ReadonlyArray<Report>, answering: Report) =>
  withoutOne(history, answering)
    .map((entry) => ({ plan: entry.plan, text: entry.text }));

const promptFor = (history: ReadonlyArray<Report>, answering: Report) =>
  systemPrompt({ plan: answering.plan, language: 'en', journey: journeyFor(history, answering) });

describe('a player standing where they have stood before', () => {
  it('is reported however alike the two tellings are', () => {
    // The shape: the words chosen do not decide whether a return happened.
    const said = [
      'again the same thing',
      'nothing new',
      '.',
      'a much longer account of what it is like to be here for the second time',
    ];

    const missed: string[] = [];

    for (const first of said) {
      for (const second of said) {
        const history = [wrote(41, first, 100), wrote(12, 'elsewhere', 200), wrote(41, second, 300)];
        const prompt = promptFor(history, wrote(41, second, 300));

        if (!prompt.includes(RETURNED)) missed.push(`"${first}" then "${second}"`);
      }
    }

    expect(missed).toEqual([]);
  });

  it('is not reported when they have not been here before', () => {
    // Otherwise the assertion above is satisfied by saying it always.
    const history = [wrote(12, 'elsewhere', 100), wrote(41, 'the first time here', 200)];

    expect(promptFor(history, wrote(41, 'the first time here', 200))).not.toContain(RETURNED);
  });

  it('does not hand back the words it is being asked about', () => {
    // The reason the entry is removed at all: the companion answering a report
    // must not also be told the player wrote it earlier.
    const answering = wrote(41, 'a sentence written exactly once', 300);
    const history = [wrote(12, 'elsewhere', 100), answering];

    const prompt = promptFor(history, answering);

    expect(prompt).not.toContain('a sentence written exactly once');
    expect(prompt).toContain('elsewhere');
  });

  it('shows the earlier telling and not the one being answered', () => {
    const answering = wrote(41, 'again the same thing', 300);
    const history = [wrote(41, 'the first time, frightened', 100), answering];

    const prompt = promptFor(history, answering);

    expect(prompt).toContain('the first time, frightened');
    // Once: the removed entry is gone, and the surviving one is not doubled.
    expect(prompt.split('the first time, frightened')).toHaveLength(2);
  });

  it('counts a square written on three times as a return twice over', () => {
    const answering = wrote(41, 'again the same thing', 500);
    const history = [
      wrote(41, 'again the same thing', 100),
      wrote(41, 'again the same thing', 300),
      answering,
    ];

    const prompt = promptFor(history, answering);

    expect(prompt).toContain(RETURNED);
    expect(prompt.split('again the same thing')).toHaveLength(3);
  });
});
