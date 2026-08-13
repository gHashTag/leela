import { describe, expect, it } from 'vitest';
import { LANGUAGES, planFor } from '@leela/content';
import { LEGACY_MOBILE, TOTAL_PLANS, WIN_LOKA, applyRoll, initialState } from '@leela/engine';

import { Companion } from '../src/companion';
import { trimmedDescription } from '../src/canon';
import { DEITIES, deityFor, DEFAULT_DEITY } from '../src/deities';
import { screenFor, toneOf } from '../src/hud';
import { isFace, pipsFor } from '../src/die';
import { DETENTS, dragged, nearest, stepped } from '../src/sheet';
import { arrowProfile, snakeProfile, wiggle } from '../src/tube';

const titleOf = (plan: number): string => planFor('en', plan).title;

// --- what the screen says ---------------------------------------------------

describe('the readout', () => {
  it('shows a dash and the invitation before anybody has thrown', () => {
    const opening = screenFor('en', WIN_LOKA, false, titleOf, null);
    expect(opening.number).toBe('—');
    expect(opening.plan).toBeNull();
    expect(opening.progress).toBe(0);
    expect(opening.tone).toBe('wait');
  });

  /**
   * A waiting player and a finished one both sit on `WIN_LOKA` with
   * `is_finished` set. The board this replaced read position alone and told a
   * player who had not started that they had reached Cosmic Consciousness.
   */
  it('does not mistake waiting to enter for having arrived at 68', () => {
    const waiting = screenFor('en', WIN_LOKA, false, titleOf, null);
    const arrived = screenFor('en', WIN_LOKA, true, titleOf, null);
    expect(waiting.number).toBe('—');
    expect(arrived.number).toBe(String(WIN_LOKA));
    expect(arrived.progress).toBe(1);
  });

  it('measures progress against the winning square, not the last one', () => {
    expect(screenFor('en', WIN_LOKA, true, titleOf, null).progress).toBe(1);
    // The four squares past 68 are the ones you walk back from. None of them
    // may read as less far along than 68 is.
    for (const beyond of [69, 70, 71, TOTAL_PLANS]) {
      expect(screenFor('en', beyond, true, titleOf, null).progress).toBe(1);
    }
  });

  it('names every square it stands on, in every language, without blanking', () => {
    for (const language of LANGUAGES) {
      for (let plan = 1; plan <= TOTAL_PLANS; plan += 1) {
        const standing = screenFor(language, plan, true, (p) => planFor(language, p).title, null);
        expect(standing.title.length).toBeGreaterThan(0);
        expect(standing.say.length).toBeGreaterThan(0);
      }
    }
  });

  it('gives each kind of move its own stripe', () => {
    expect(toneOf('snake 🐍')).toBe('snake');
    expect(toneOf('arrow 🏹')).toBe('arrow');
    expect(toneOf('win 🕉')).toBe('win');
    expect(toneOf('step 🚶🏼')).toBe('step');
    expect(toneOf('')).toBe('wait');
    expect(toneOf(undefined)).toBe('wait');
  });

  /**
   * A refused throw is news. The opening line — *a six puts you on the board* —
   * is only for the moment before anyone has thrown at all; after a 4, the
   * player is owed *you threw 4, it takes a six*.
   */
  it('reports a refused throw rather than repeating the invitation', () => {
    const before = initialState();
    const { event } = applyRoll(before, 4, LEGACY_MOBILE);
    const after = screenFor('en', WIN_LOKA, false, titleOf, event);
    const opening = screenFor('en', WIN_LOKA, false, titleOf, null);
    expect(after.say).not.toBe(opening.say);
    expect(after.say).toContain('4');
  });
});

// --- the die ----------------------------------------------------------------

describe('the die', () => {
  it('shows the pips every real die shows', () => {
    for (let face = 1; face <= 6; face += 1) {
      expect(pipsFor(face)).toHaveLength(face);
      expect(new Set(pipsFor(face)).size).toBe(face);
      for (const cell of pipsFor(face)) {
        expect(cell).toBeGreaterThanOrEqual(1);
        expect(cell).toBeLessThanOrEqual(9);
      }
    }
  });

  it('is symmetric about the centre, as a die is', () => {
    for (let face = 1; face <= 6; face += 1) {
      const cells = new Set(pipsFor(face));
      for (const cell of cells) expect(cells.has(10 - cell)).toBe(true);
    }
  });

  /** A die showing a one before anyone has thrown is a lie a player acts on. */
  it('shows nothing at all for a value that is not a face', () => {
    for (const value of [0, 7, -1, 1.5, Number.NaN]) {
      expect(pipsFor(value), `${value} produced a face`).toEqual([]);
      expect(isFace(value)).toBe(false);
    }
    expect(isFace(3)).toBe(true);
  });
});

// --- the sheet --------------------------------------------------------------

describe('the sheet', () => {
  const heights = { peek: 130, half: 400, full: 760 };

  it('snaps to whichever detent the drag ended nearest', () => {
    expect(nearest(120, heights)).toBe('peek');
    expect(nearest(390, heights)).toBe('half');
    expect(nearest(700, heights)).toBe('full');
  });

  /** A tie uncovers the board rather than covering it: covering hides the
      thing the player was reaching for, and uncovering is one drag away. */
  it('keeps the smaller detent when a drag lands exactly between two', () => {
    expect(nearest((130 + 400) / 2, heights)).toBe('peek');
    expect(nearest((400 + 760) / 2, heights)).toBe('half');
  });

  it('grows by one step and then collapses, so a keyboard reaches all three', () => {
    expect(stepped('peek')).toBe('half');
    expect(stepped('half')).toBe('full');
    expect(stepped('full')).toBe('peek');
    // Every detent is reachable by pressing the handle repeatedly.
    const walked = new Set<string>();
    let at = DETENTS[0] as 'peek';
    for (let press = 0; press < DETENTS.length; press += 1) {
      walked.add(at);
      at = stepped(at) as 'peek';
    }
    expect(walked.size).toBe(DETENTS.length);
  });

  it('reads a drag downward as making the sheet smaller', () => {
    expect(dragged(760, 400, heights)).toBe('half');
    expect(dragged(400, -350, heights)).toBe('full');
  });
});

// --- the pieces -------------------------------------------------------------

describe('who the player plays as', () => {
  /**
   * The roster is grounded, not invented: every name offered must be one the
   * seventy-two texts actually use. Ganesha, Lakshmi and Hanuman are absent
   * from the dataset and so are absent from the board.
   */
  it('offers only deities the canonical texts name', () => {
    const corpus = Array.from({ length: TOTAL_PLANS }, (_, at) => planFor('en', at + 1))
      .map((plan) => `${plan.title} ${plan.description ?? ''} ${plan.body}`)
      .join(' ')
      .toLowerCase();

    for (const deity of DEITIES) {
      expect(corpus, `${deity.latin} is offered but never named`).toContain(deity.latin.toLowerCase());
    }
  });

  it('gives each one its own identity, so two tokens are never the same', () => {
    expect(new Set(DEITIES.map((d) => d.id)).size).toBe(DEITIES.length);
    expect(new Set(DEITIES.map((d) => d.colour)).size).toBe(DEITIES.length);
    expect(new Set(DEITIES.map((d) => d.emblem)).size).toBe(DEITIES.length);
    for (const deity of DEITIES) {
      expect(deity.sanskrit.length).toBeGreaterThan(0);
      expect(deity.latin.length).toBeGreaterThan(0);
    }
  });

  /** The id comes out of localStorage, which is to say out of whatever an
      older release wrote there. A changed roster costs a preference, not a
      game that will not open. */
  it('falls back rather than throwing on an id it does not know', () => {
    expect(deityFor('ganesha')).toBe(DEFAULT_DEITY);
    expect(deityFor(null)).toBe(DEFAULT_DEITY);
    expect(deityFor(undefined)).toBe(DEFAULT_DEITY);
    expect(deityFor('durga').latin).toBe('Durga');
  });
});

// --- snakes and arrows ------------------------------------------------------

describe('the shape of a jump', () => {
  /**
   * The head is the square you land on and the tail is where you end up. A
   * snake tapering the wrong way is a snake you appear to slide *up*.
   */
  it('makes a snake thickest at its head and thinnest at its tail', () => {
    const profile = snakeProfile(0.1);
    expect(profile(0)).toBeGreaterThan(profile(0.5));
    expect(profile(0.5)).toBeGreaterThan(profile(1));
    expect(profile(0)).toBeCloseTo(0.1);
  });

  it('never gives a snake a negative or absent thickness', () => {
    const profile = snakeProfile(0.1);
    for (let step = 0; step <= 20; step += 1) {
      expect(profile(step / 20)).toBeGreaterThan(0);
    }
    expect(profile(-1)).toBe(profile(0));
    expect(profile(2)).toBe(profile(1));
  });

  it('keeps an arrow shaft even, because a tapering shaft is a spear', () => {
    const profile = arrowProfile(0.07);
    for (let step = 0; step <= 10; step += 1) expect(profile(step / 10)).toBe(0.07);
  });

  /**
   * The bends have to die at both ends. A snake whose head misses the square it
   * is the head of is the same defect as a piece parked at the origin, and just
   * as hard to see on a board of thirty of them.
   */
  it('brings a snake back to both of its squares exactly', () => {
    expect(wiggle(0, 0.8)).toBeCloseTo(0);
    expect(wiggle(1, 0.8)).toBeCloseTo(0);
  });

  it('bends the body in between, or it is a straight line', () => {
    let most = 0;
    for (let step = 1; step < 20; step += 1) most = Math.max(most, Math.abs(wiggle(step / 20, 0.8)));
    expect(most).toBeGreaterThan(0.2);
  });
});

// --- the text ---------------------------------------------------------------

describe('the opening remark', () => {
  /**
   * The defect is a cut *in the middle of a word*, and it cannot be seen in the
   * output alone: `…moves from square…` and `…moves from squ…` both end in a
   * letter and an ellipsis. The first check here asked only that, and failed on
   * a correct cut.
   *
   * What tells them apart is the source: the kept text must be a prefix of it,
   * and the character the original carries on with must not be another letter.
   */
  it('never cuts a word in half', () => {
    for (let plan = 1; plan <= TOTAL_PLANS; plan += 1) {
      const text = planFor('en', plan);
      const whole = (text.description ?? '').trim() || text.body.trim();
      const short = trimmedDescription(text, 200);
      if (short === whole) continue;

      const kept = short.replace(/…$/, '');
      expect(whole.startsWith(kept), `plan ${plan}: the abridgement is not a prefix`).toBe(true);
      expect(whole.slice(kept.length, kept.length + 1)).not.toMatch(/[\p{L}\p{N}]/u);
    }
  });

  /** Thirteen of the seventy-two have no description. A card that is blank on
      those thirteen is how a dataset's holes become a screen's. */
  it('says something for every plan, in every language', () => {
    for (const language of LANGUAGES) {
      for (let plan = 1; plan <= TOTAL_PLANS; plan += 1) {
        expect(trimmedDescription(planFor(language, plan), 320).length).toBeGreaterThan(0);
      }
    }
  });

  it('leaves a short text alone rather than adding an ellipsis to it', () => {
    expect(trimmedDescription({ plan: 1, title: 't', description: 'Short.', body: 'Short.', source: 's' }, 100)).toBe(
      'Short.',
    );
  });
});

// --- the companion ----------------------------------------------------------

describe('the companion', () => {
  const landing = (companion: Companion, plan: number): void => {
    companion.arrived(plan, null, 'You threw 3.');
  };

  it('speaks first on every landing, rather than waiting to be addressed', () => {
    const companion = new Companion({ language: 'en' });
    expect(companion.view().lines).toHaveLength(0);
    landing(companion, 34);
    expect(companion.view().lines.length).toBeGreaterThan(0);
    expect(companion.view().lines.every((line) => line.who === 'companion')).toBe(true);
  });

  /**
   * With no model configured the status is `offline` and every line is marked
   * `canon`. A screen that renders the dataset's authority and a model's guess
   * identically has quietly lent one to the other.
   */
  it('says where every line came from', () => {
    const companion = new Companion({ language: 'en' });
    landing(companion, 34);
    expect(companion.view().status).toBe('offline');
    for (const line of companion.view().lines) expect(line.source).toBe('canon');
  });

  it('reports what it is working from, including the fields it has nothing in', () => {
    const companion = new Companion({ language: 'en' });
    landing(companion, 34);
    const rests = companion.view().rests;
    expect(rests).not.toBeNull();
    expect(rests?.plan).toBe(34);
    expect(rests?.canonChars).toBeGreaterThan(0);
    // Nothing configured is reported as nothing, not omitted.
    expect(rests?.model).toBeNull();
    expect(rests?.previousPlan).toBeNull();
  });

  it('keeps what the player wrote even when nothing can answer it', async () => {
    const companion = new Companion({ language: 'en' });
    landing(companion, 34);
    await companion.say('This one lands hard.');
    const lines = companion.view().lines;
    expect(lines.some((line) => line.who === 'player' && line.text === 'This one lands hard.')).toBe(true);
    expect(lines.at(-1)?.source).toBe('fallback');
  });

  it('ignores an empty report rather than posting a blank bubble', async () => {
    const companion = new Companion({ language: 'en' });
    landing(companion, 34);
    const before = companion.view().lines.length;
    await companion.say('   ');
    expect(companion.view().lines).toHaveLength(before);
  });

  it('answers from a model when there is one, and marks it as the model', async () => {
    const companion = new Companion({ language: 'en', ask: async () => 'Sit with it.' });
    landing(companion, 34);
    await companion.say('What now?');
    expect(companion.view().lines.at(-1)).toMatchObject({ source: 'model', text: 'Sit with it.' });
  });

  /**
   * `@leela/ai` learned this from a provider answering 200 with an empty
   * choice: nothing is not an answer, and the type promises one.
   */
  it('treats an empty completion as a failure rather than as an answer', async () => {
    const companion = new Companion({ language: 'en', ask: async () => '   ' });
    landing(companion, 34);
    await companion.say('What now?');
    expect(companion.view().lines.at(-1)?.source).toBe('fallback');
    expect(companion.view().lines.at(-1)?.text.length).toBeGreaterThan(0);
  });

  it('falls into an answer rather than an exception when the model throws', async () => {
    const companion = new Companion({
      language: 'en',
      ask: async () => {
        throw new Error('402 no balance');
      },
    });
    landing(companion, 34);
    await expect(companion.say('What now?')).resolves.toBeUndefined();
    expect(companion.view().status).toBe('silenced');
    expect(companion.view().note).toContain('402');
  });

  it('carries the whole text when the opening remark is an abridgement of it', () => {
    const companion = new Companion({ language: 'en' });
    landing(companion, 34);
    const opening = companion.view().lines.at(-1);
    expect(opening?.more?.length ?? 0).toBeGreaterThan((opening?.text ?? '').length);
  });

  it('starts over with the game', () => {
    const companion = new Companion({ language: 'en' });
    landing(companion, 34);
    companion.reset();
    expect(companion.view().lines).toHaveLength(0);
    expect(companion.view().rests).toBeNull();
  });
});
