/**
 * A prompt is bounded by this package, not by whoever called it.
 *
 * `MAX_HISTORY_CHARS` records why that sentence exists. The history used to be
 * clipped by *count* alone, so six messages of any length went in whole — and
 * the note ends: *"the prompt this package so carefully bounds was bounded by
 * whatever the caller happened to be holding."* It lists what is clipped: the
 * plan's text, a journey line, the intention.
 *
 * The two things the player **writes** were not on that list, and were not
 * clipped. Measured before this was written: forty thousand characters of
 * report made a prompt of forty-three thousand, and so did forty thousand
 * characters of question, while the same forty thousand as an *intention* added
 * eight hundred and the same again as a *journey* added a hundred and seventy.
 *
 * Nothing shipped that way. The bot slices a report at `MAX_REPORT_CHARS`
 * before it arrives, and Telegram will not carry a message past four thousand
 * and ninety-six — so both bounds belonged to callers, which is the thing the
 * note argues against. A second caller is a phone away, and the failure it
 * would produce is the quiet kind the note also names: a refused request comes
 * back as the fallback sentence, so a companion that had stopped answering the
 * longest conversations would look, from inside the game, exactly like a
 * companion having a bad day.
 *
 * So this asks the property rather than the two fields: **every input a caller
 * supplies is one the package clips.** Each is handed forty thousand characters
 * in turn, and the prompt has to stay inside a ceiling this package can state
 * from its own constants. A field added tomorrow that forgets to clip fails
 * here without being named.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_HISTORY,
  MAX_HISTORY_CHARS,
  MAX_INTENTION_CHARS,
  MAX_PLAN_CHARS,
  MAX_REPORT_CHARS,
  questionPrompt,
  reportPrompt,
  systemPrompt,
  type Message,
  type PlanContext,
} from '../src/index';

/** Long enough that no bound in this package could be an accident. */
const FLOOD = 40_000;

const long = (count: number) => 'слово '.repeat(Math.ceil(count / 6)).slice(0, count);

const HERE: PlanContext = { plan: 41, language: 'en' };

const sizeOf = (messages: ReadonlyArray<Message>) =>
  messages.reduce((total, message) => total + message.content.length, 0);

/**
 * The ceiling, from this package's own numbers rather than from a measurement.
 *
 * A number copied out of a run is a number that agrees with whatever the code
 * did that day. Every part is one of the constants, and the slack is for the
 * framing sentences around them — which are prose this package writes and
 * bounds by writing.
 */
const FRAMING = 4_000;
const CEILING =
  MAX_PLAN_CHARS + MAX_INTENTION_CHARS + MAX_REPORT_CHARS + MAX_HISTORY * MAX_HISTORY_CHARS + FRAMING;

/** Every input a caller hands in, each flooded on its own. */
const INPUTS: Array<readonly [string, (flood: string) => Message[]]> = [
  ['the report', (flood) => reportPrompt(HERE, flood)],
  ['the question', (flood) => questionPrompt(HERE, flood)],
  [
    'the intention',
    (flood) => reportPrompt({ ...HERE, intention: flood }, 'an account of the square'),
  ],
  [
    'the journey',
    (flood) =>
      reportPrompt(
        { ...HERE, journey: [1, 2, 3].map((nth) => ({ plan: 40 + nth, text: flood })) },
        'an account of the square',
      ),
  ],
  [
    'the history',
    (flood) =>
      reportPrompt(HERE, 'an account of the square', [
        { role: 'user', content: flood },
        { role: 'assistant', content: flood },
      ]),
  ],
];

describe('an input a caller holds', () => {
  it('does not make the prompt grow without a bound', () => {
    const unbounded: string[] = [];

    for (const [what, build] of INPUTS) {
      const size = sizeOf(build(long(FLOOD)));
      if (size > CEILING) unbounded.push(`${what}: ${size} characters, past ${CEILING}`);
    }

    expect(unbounded).toEqual([]);
  });

  it('changes the prompt by less than it was given', () => {
    // The sharper half. A ceiling alone would pass on a field clipped to
    // something enormous, so each is asked what flooding it actually costs:
    // less than the flood, by an order of magnitude.
    const costly: string[] = [];

    for (const [what, build] of INPUTS) {
      const small = sizeOf(build(long(100)));
      const flooded = sizeOf(build(long(FLOOD)));

      if (flooded - small > FLOOD / 4) {
        costly.push(`${what}: ${FLOOD} characters added ${flooded - small}`);
      }
    }

    expect(costly).toEqual([]);
  });

  it('is carried at all when it is short, so this is not a check on nothing', () => {
    // The guard. Every one of these must reach the prompt when it fits, or the
    // two above would pass over inputs the package silently drops.
    const mark = 'a phrase that appears nowhere else in any prompt';

    expect(sizeOf(reportPrompt(HERE, mark))).toBeGreaterThan(0);
    expect(reportPrompt(HERE, mark).some((one) => one.content.includes(mark))).toBe(true);
    expect(questionPrompt(HERE, mark).some((one) => one.content.includes(mark))).toBe(true);
    expect(systemPrompt({ ...HERE, intention: mark })).toContain(mark);
    expect(systemPrompt({ ...HERE, journey: [{ plan: 41, text: mark }] })).toContain(mark);
    expect(
      reportPrompt(HERE, 'an account', [{ role: 'user', content: mark }]).some((one) =>
        one.content.includes(mark),
      ),
    ).toBe(true);
  });

  it('states its ceiling from the package’s own numbers', () => {
    // A ceiling read off a run is a ceiling that agrees with whatever the code
    // did that day. Each part has to be a constant this package exports, and
    // the whole has to be smaller than the flood it is asked to survive.
    expect(CEILING).toBeLessThan(FLOOD / 2);
    expect(MAX_REPORT_CHARS, 'the report’s bound is the format’s own').toBeGreaterThan(0);
  });
});
