/**
 * The question, through every door that carries one.
 *
 * A path leaves this app two ways: the whole thing as a file, and one square in
 * words somebody can send to a friend. Each is written by this package and read
 * back by it, so there are four doors — and they gave three different answers
 * about the question the path was written under.
 *
 * `squareText` and `toDocument` wrote one of any length. `parseDocument` dropped
 * one past the ceiling. `parseSquare` *clamped* one. Measured: the same question
 * a character over the bound came back cut short when it was shared as a square
 * and came back as nothing when it was carried as a file — one question, two
 * doors, two different things arriving at the far end.
 *
 * Neither reader applied the floor, either: a file carrying `"x"` handed back a
 * question `isIntention` says the game does not hold, and that no surface would
 * have let anybody write.
 *
 * **The clamp is the one that goes.** `journal.test.ts` records the decision —
 * *dropped rather than shortened: a question cut in half is a different
 * question, and a report cut short is still most of what was said* — and it is a
 * judgement that was made rather than an oversight. The report text is clamped
 * one screen up for a reason argued about reports.
 *
 * So this asks two properties, and neither of them names a case:
 *
 * - **whatever comes back is a question the game holds, or nothing** — the floor
 *   and the ceiling at every door, in one sentence;
 * - **a question the game holds is never lost**, and every door hands back the
 *   same one.
 *
 * The space is built from the bounds rather than listed, so moving either bound
 * moves the test with it, and every length is tried under every kind of
 * surrounding whitespace. A door added tomorrow that forgets one of the two
 * fails here.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_INTENTION_CHARS,
  MIN_INTENTION_CHARS,
  asIntention,
  isIntention,
  parseDocument,
  parseSquare,
  squareText,
  toDocument,
  type Report,
} from '../src/index';

const ENTRY: Report = {
  plan: 5,
  text: 'an account of the fifth square, and what it turned out to be about',
  at: 1_700_000_000_000,
};

/** Lengths at and around both bounds, plus one well past the far one. */
const LENGTHS = [
  0,
  MIN_INTENTION_CHARS - 1,
  MIN_INTENTION_CHARS,
  MIN_INTENTION_CHARS + 1,
  MAX_INTENTION_CHARS - 1,
  MAX_INTENTION_CHARS,
  MAX_INTENTION_CHARS + 1,
  MAX_INTENTION_CHARS + 500,
];

/**
 * Spaces rather than newlines, because a shared square carries the question on
 * **one line** — `— <question>` — and a newline in it is not a question written
 * oddly but a square that no longer says what it says. Asking every door the
 * same input is the point, so the space is what all four can carry; the newline
 * an editor actually leaves is asked of the file below, where it is meaningful.
 */
const SURROUNDINGS = ['', ' ', '  ', '   '];

/**
 * A question of a given length, in words rather than one repeated letter.
 *
 * A run of `q` would be clamped mid-nothing; real words make a clamp visible as
 * a sentence cut short, which is what the assertions are about.
 */
const questionOf = (length: number): string =>
  'to understand why I put off what matters, and what I am afraid it would mean '
    .repeat(Math.ceil(length / 77) + 1)
    .slice(0, length);

const asked = LENGTHS.flatMap((length) =>
  SURROUNDINGS.flatMap((before) =>
    SURROUNDINGS.map((after) => ({
      what: `${length} chars, ${JSON.stringify(before)}…${JSON.stringify(after)}`,
      text: `${before}${questionOf(length)}${after}`,
    })),
  ),
);

/**
 * Every door, and the readers on their own as well as behind their writers.
 *
 * The round trips alone were not enough, and finding that out was the point of
 * trying: with the writers fixed, restoring the clamp inside `parseSquare` broke
 * nothing, because a question past the bound never reached it. A reader is not
 * only reached through our own writer — a shared square is text somebody pastes,
 * a file has been through an editor, and both may have been written by a build
 * from before any of this. So each reader is asked directly too, with a document
 * made by hand rather than by us.
 */
const doors = {
  'as a file': (question: string) =>
    parseDocument(JSON.stringify(toDocument([ENTRY], question)))?.intention ?? null,
  'as a square': (question: string) =>
    parseSquare(squareText(ENTRY.plan, 'Cosmic Consciousness', ENTRY.text, question))?.intention ??
    null,
  'in a file made by hand': (question: string) =>
    parseDocument(
      JSON.stringify({ schemaVersion: 1, app: 'leela', entries: [ENTRY], intention: question }),
    )?.intention ?? null,
  'in a square made by hand': (question: string) =>
    parseSquare(`${ENTRY.plan}. Cosmic Consciousness\n\n${ENTRY.text}\n\n— ${question}`)
      ?.intention ?? null,
};

const names = Object.keys(doors) as Array<keyof typeof doors>;

describe('a question carried in something written', () => {
  it('comes back as one the game holds, or not at all', () => {
    const wrong: string[] = [];

    for (const { what, text } of asked) {
      for (const door of names) {
        const back = doors[door](text);
        if (back !== null && !isIntention(back)) {
          wrong.push(`${door} ${what}: handed back ${back.length} chars`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });

  it('is not lost when the game holds it', () => {
    // The other half. A question inside the bounds must arrive whole through
    // both doors — a path that loses it is a year of answers with the question
    // missing, which is what the file format grew an `intention` field for.
    const lost: string[] = [];

    for (const { what, text } of asked) {
      if (!isIntention(text)) continue;

      for (const door of names) {
        if (doors[door](text) !== text.trim()) lost.push(`${door} ${what}: ${doors[door](text)}`);
      }
    }

    expect(lost).toEqual([]);
  });

  it('is the same question whichever way it was carried', () => {
    const differing: string[] = [];

    for (const { what, text } of asked) {
      const answers = names.map((door) => doors[door](text));

      if (new Set(answers).size !== 1) {
        differing.push(`${what}: ${answers.map((a) => (a === null ? 'lost' : a.length)).join(' vs ')}`);
      }
      // And it is the one rule, not two that happen to agree today.
      if (answers[0] !== asIntention(text)) {
        differing.push(`${what}: doors say ${answers[0]?.length ?? 'lost'}, the rule says ${asIntention(text)?.length ?? 'lost'}`);
      }
    }

    expect(differing).toEqual([]);
  });

  it('loses the newline an editor leaves on a file, and keeps the question', () => {
    // Where a newline actually lands. The question above is asked with spaces
    // because a shared square is one line; a file is not, and a path that went
    // through an editor comes back with the line ending still on it.
    const question = questionOf(40);

    for (const around of ['\n', '\r\n', '\n\n', ' \n ']) {
      const file = JSON.stringify({
        schemaVersion: 1,
        app: 'leela',
        entries: [ENTRY],
        intention: `${around}${question}${around}`,
      });

      expect({ around, back: parseDocument(file)?.intention }).toEqual({ around, back: question });
    }
  });

  it('is asked of lengths that actually straddle both bounds', () => {
    // The guard against a check that cannot fail: if the space held only short
    // questions, or only ones inside the bounds, everything above would pass
    // over a question nobody asked.
    expect(LENGTHS.some((length) => length < MIN_INTENTION_CHARS)).toBe(true);
    expect(LENGTHS.some((length) => length > MAX_INTENTION_CHARS)).toBe(true);
    expect(questionOf(MAX_INTENTION_CHARS + 1)).toHaveLength(MAX_INTENTION_CHARS + 1);

    // And that both doors are carrying the question at all.
    const ordinary = questionOf(40);
    for (const door of names) expect({ door, back: doors[door](ordinary) }).toEqual({ door, back: ordinary });
  });
});
