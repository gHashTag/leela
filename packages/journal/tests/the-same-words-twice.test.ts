/**
 * A return told in the same words was not a return at all.
 *
 * Both surfaces that ask the companion anything take the player's path and
 * remove the entry it is about to answer, so that the words being answered are
 * not also handed over as history. Both wrote the removal by hand and both
 * wrote it the same way: `entry.plan !== plan || entry.text !== text`. That is
 * not *this entry*. It is *every entry that says what this one says*.
 *
 * Measured through the real prompt, before anything changed. A player on plan
 * 41 who had stood there before:
 *
 *   told in different words   the path keeps 2 of 3, and the prompt says
 *                             "They have stood here before, and wrote: …"
 *   told in the same words    the path keeps 1 of 3, and the prompt says
 *                             nothing about a return at all
 *
 * The second is the case this game exists for. The prompt's own sentence says
 * so — *returning is what this game is about: the same state arrives again, and
 * what changed between the tellings is the thing worth noticing* — and when
 * nothing changed between the tellings, which is the loudest thing this record
 * can carry, the companion was told there had been no return.
 *
 * The rule asserted here is not about plan 41 or about two entries. It is that
 * removing the entry being answered removes **exactly one entry**, whatever it
 * says and whatever else says the same.
 */

import { describe, expect, it } from 'vitest';
import { revisited, withoutOne, writingsOn, type Report } from '../src/index';

const wrote = (plan: number, text: string, at: number): Report => ({ plan, text, at });

/** A path with every kind of repetition in it, oldest first. */
const path: Report[] = [
  wrote(6, 'the first step, and it frightens me', 100),
  wrote(12, 'envy — I recognised myself', 200),
  wrote(41, 'again the same thing', 300),
  wrote(12, 'envy — I recognised myself', 400),
  wrote(41, 'again the same thing', 500),
  wrote(41, 'and now something else', 600),
  wrote(41, 'again the same thing', 700),
];

describe('the entry a companion is about to answer', () => {
  it('is one entry, whatever else says the same', () => {
    // For every entry in the path — including the three that are word for word
    // identical — removing it leaves exactly one fewer.
    const wrong: string[] = [];

    for (const entry of path) {
      const left = withoutOne(path, entry);
      if (left.length !== path.length - 1) {
        wrong.push(`"${entry.text}" on ${entry.plan}: ${path.length} became ${left.length}`);
      }
    }

    expect(wrong).toEqual([]);
  });

  it('is the newest of them, because it is the one just written', () => {
    // The entry being answered was written a moment ago. An earlier telling of
    // the same thing is the return, and it is the part worth keeping.
    const left = withoutOne(path, wrote(41, 'again the same thing', 0));

    expect(left.map((entry) => entry.at)).toEqual([100, 200, 300, 400, 500, 600]);
  });

  it('leaves the earlier telling where a return can still be seen', () => {
    const left = withoutOne(path, wrote(41, 'again the same thing', 0));

    expect(writingsOn(left, 41).map((entry) => entry.at)).toEqual([300, 500, 600]);
    expect(revisited(left).find((square) => square.plan === 41)?.times).toBe(3);
  });

  it('reads the same path whichever way round it is handed over', () => {
    // The bot hands its rows newest-first and a file is oldest-first. Neither
    // says which, so the answer cannot depend on it.
    const answered = wrote(12, 'envy — I recognised myself', 0);

    const forwards = withoutOne(path, answered).map((entry) => entry.at);
    const backwards = withoutOne([...path].reverse(), answered)
      .map((entry) => entry.at)
      .reverse();

    expect(forwards).toEqual(backwards);
    expect(forwards).not.toContain(400);
    expect(forwards).toContain(200);
  });

  it('takes the moment from whoever owns it', () => {
    // The bot's rows carry `createdAt` and a file carries `at`. The rule is
    // written over the least either can supply, so the moment is asked for.
    const rows = [
      { plan: 41, text: 'again the same thing', createdAt: new Date(300) },
      { plan: 41, text: 'again the same thing', createdAt: new Date(700) },
    ];

    const left = withoutOne(rows, { plan: 41, text: 'again the same thing' }, (row) =>
      row.createdAt.getTime(),
    );

    expect(left.map((row) => row.createdAt.getTime())).toEqual([300]);
  });

  it('removes nothing when the entry is not there', () => {
    // A path that does not hold what is being answered is a path to hand over
    // whole. Dropping something at random would be worse than dropping nothing.
    expect(withoutOne(path, wrote(41, 'words nobody wrote', 0))).toHaveLength(path.length);
    expect(withoutOne([], wrote(41, 'anything', 0))).toEqual([]);
  });

  it('does not change the path it was given', () => {
    const before = path.map((entry) => entry.at);
    withoutOne(path, path[2] as Report);

    expect(path.map((entry) => entry.at)).toEqual(before);
  });
});
