import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { blank } from '../../../scripts/lib/source.mjs';
import { order, revisited, writingsOn as writingsOnEntries } from '@leela/journal';
import { EMPTY_PATH, pathOf, record, takeIn, toShare, writingsOn, type Journal } from '../src/journal';
import { HANDLE } from '../src/handles';

/**
 * Reading the whole path.
 *
 * This app could write a path, carry it away and bring one back, and never once
 * show it. It printed what was written about the square being stood on and
 * nothing else — so the record the game exists to produce could only be read by
 * sending it somewhere else. The bot has `/path` and `/returns`; the mini app
 * has a view with a section per seat.
 *
 * It was named out loud one pass ago and then worked around: the sentence about
 * a device refusing a write had to stop saying *save a copy from “My path”*,
 * because there was no such screen here. That workaround is the shape of an
 * absence — a sentence bent around a hole rather than the hole being filled.
 *
 * `revisited` and `writingsOn` are `@leela/journal`'s. A square that came back
 * is the same square on all three surfaces, and counting them again here would
 * be a second answer to a question already answered — which is how the bot's
 * plain standings once came to disagree with its own board.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = blank(readFileSync(join(HERE, '..', 'src', 'App.tsx'), 'utf8'));

/** A path written over a game: some squares once, some more than once. */
function walked(visits: ReadonlyArray<[plan: number, at: number]>): Journal {
  return visits.reduce(
    (journal, [plan, at]) => record(journal, plan, `what ${plan} asked at ${at}`, at),
    EMPTY_PATH,
  );
}

const A_GAME: ReadonlyArray<[number, number]> = [
  [6, 1_000],
  [30, 2_000],
  [8, 3_000],
  [30, 4_000],
  [12, 5_000],
  [30, 6_000],
  [8, 7_000],
];

describe('the whole path', () => {
  it('holds every account and invents none', () => {
    // The first thing a reader checks by eye, and the one a filter can get
    // wrong in either direction.
    const journal = walked(A_GAME);
    const path = pathOf(journal);

    expect(path.entries).toHaveLength(A_GAME.length);
    expect(new Set(path.entries.map((entry) => entry.at)).size).toBe(A_GAME.length);
    for (const entry of journal.entries) {
      expect(path.entries, `${entry.plan}@${entry.at}`).toContainEqual(entry);
    }
  });

  it('reads oldest first, in the format\'s order and not its own', () => {
    /**
     * Asserted against `order` rather than against a hand-written sequence: the
     * ordering of a path is the format's, so a path read here is the path the
     * bot prints and the mini app draws.
     */
    const journal = walked(A_GAME);

    expect(pathOf(journal).entries).toEqual(order(journal.entries));
    expect(pathOf(journal).entries.map((entry) => entry.at)).toEqual(
      [...A_GAME].map(([, at]) => at).sort((a, b) => a - b),
    );
  });

  it('is empty for a player who has written nothing', () => {
    // Not "a heading with nothing under it", which reads as a screen that
    // failed rather than a path not yet walked.
    expect(pathOf(EMPTY_PATH)).toEqual({ returns: [], entries: [] });
  });

  it('survives a path brought back from a file', () => {
    // The round trip the whole format exists for: what was carried away is
    // what is read here.
    const mine = walked(A_GAME);
    const brought = takeIn(EMPTY_PATH, JSON.stringify(toShare(mine, 'why I am playing')), '');

    expect(brought.readable).toBe(true);
    expect(pathOf(brought.journal).entries).toEqual(pathOf(mine).entries);
  });
});

/**
 * A path where the square that came back least was stood on first.
 *
 * `revisited` orders by how often, not by when. A counter kept in a `Map`
 * returns them in first-seen order, and on `A_GAME` the two agree by luck.
 */
const UNSORTED: ReadonlyArray<[number, number]> = [
  [8, 1_000],
  [8, 2_000],
  [30, 3_000],
  [30, 4_000],
  [30, 5_000],
];

describe('the squares that came back', () => {
  it('names only the ones stood on more than once', () => {
    const path = pathOf(walked(A_GAME));

    expect(path.returns.map((visit) => visit.plan)).toEqual([30, 8]);
    expect(path.returns.map((visit) => visit.times)).toEqual([3, 2]);
  });

  it('counts them the format\'s way, not a second way', () => {
    /**
     * The shape, over a path rather than an example: whatever `revisited` says
     * about these entries is what this says. A count written here would be a
     * second answer to a question already answered, and the two would agree
     * until the day they did not.
     */
    for (const visits of [A_GAME, [], [[41, 1] as [number, number]], A_GAME.slice(0, 3), UNSORTED]) {
      const journal = walked(visits);
      expect(pathOf(journal).returns).toEqual(revisited(journal.entries));
    }
  });

  it('puts the most-returned first, whatever order they were walked in', () => {
    /**
     * The case that tells a second implementation from the format's. A count
     * kept in a `Map` comes back in the order the squares were first stood on,
     * and here that is the opposite of the order `revisited` promises — so a
     * reimplementation passes every other assertion and fails this one.
     *
     * Written because it had to be: a hand-rolled counter was put back into
     * `pathOf` to prove these tests, and every one of them still passed.
     */
    const path = pathOf(walked(UNSORTED));

    expect(path.returns.map((visit) => visit.plan)).toEqual([30, 8]);
    expect(path.returns.map((visit) => visit.times)).toEqual([3, 2]);
  });

  it('agrees with what the square itself shows', () => {
    // `writingsOn` is what the board prints under a square a player is standing
    // on again. A return counted here and not shown there would be the two
    // halves of one fact disagreeing.
    const journal = walked(A_GAME);

    for (const visit of pathOf(journal).returns) {
      expect(writingsOn(journal, visit.plan), `plan ${visit.plan}`).toHaveLength(visit.times);
    }
  });
});

describe('one square, read the format\'s way', () => {
  it('is the format\'s answer and not a copy of it', () => {
    /**
     * This was `journal.entries.filter(…)` here, under a comment promising an
     * order it did not impose — true only because `record` and `takeIn` keep
     * the list ordered three functions away. A promise held up by an invariant
     * is a promise the next writer breaks.
     */
    const journal = walked(A_GAME);

    for (const plan of [6, 8, 12, 30, 41]) {
      expect(writingsOn(journal, plan), `plan ${plan}`).toEqual(
        writingsOnEntries(journal.entries, plan),
      );
    }
  });

  it('orders a list that arrives out of order', () => {
    // The case the local copy got right by luck. Built by hand rather than
    // through `record`, because `record` is what maintains the invariant.
    const jumbled: Journal = {
      entries: [
        { plan: 30, text: 'third', at: 3_000 },
        { plan: 30, text: 'first', at: 1_000 },
        { plan: 30, text: 'second', at: 2_000 },
      ],
    };

    expect(writingsOn(jumbled, 30).map((entry) => entry.text)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });
});

describe('the screen can be walked', () => {
  it('has a control that opens it', () => {
    expect(HANDLE.path).toBe('path');
    expect(APP).toContain('testID={HANDLE.path}');
    expect(APP).toContain("messageFor(language, 'app.path')");
  });

  it('reads the path through the format rather than assembling one', () => {
    expect(APP).toContain('const path = pathOf(journal)');
    expect(APP, 'no second count in the screen').not.toMatch(/revisited\(/);
  });

  it('says how much there is, and says so when there is none', () => {
    expect(APP).toContain("messageFor(language, 'app.pathCount'");
    expect(APP).toContain("messageFor(language, 'app.pathEmpty')");
  });

  it('puts the question above the writing it frames', () => {
    // The mini app's placement and its reason: an account is written inside a
    // question, and a page of accounts with no question on it is a page of
    // answers to nothing.
    const at = APP.indexOf('{walking ? (');
    const section = APP.slice(at, APP.indexOf('{reading', at));

    expect(at, 'the path section').toBeGreaterThan(-1);
    expect(section.indexOf('app.intentionYours')).toBeGreaterThan(-1);
    expect(section.indexOf('app.intentionYours')).toBeLessThan(section.indexOf('path.entries.map'));
  });
});
