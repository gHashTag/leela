import { describe, expect, it } from 'vitest';
import { MAX_INTENTION_CHARS, MIN_INTENTION_CHARS } from '@leela/journal';
import { isIntention, loadIntention, saveIntention, type Store } from '../src/journal';
import { mayThrow, newGame, throwDie } from '../src/game';

/**
 * One question, one answer.
 *
 * *Is this a question the game can hold* had three: the mini app's
 * `isIntention`, the bot's `said.length < 2 || said.length > MAX_INTENTION_CHARS`
 * written inline with the two as a literal, and this app about to write a
 * fourth. Each carried a comment saying it was the published app's bound —
 * `yup.string().min(2).max(800)` — and each was a separate place for that to
 * stop being true.
 *
 * It lives in `@leela/journal` now, which is the one package all three can
 * reach: no dependencies at all, on purpose, so a browser bundle, a Bun process
 * and a phone can each hold it.
 *
 * What is asserted here is the *separation*, not the numbers. Whether words are
 * a question is one question; whether a device kept them is another; and the
 * mini app spent four passes with a writer that answered both at once, so a
 * browser that refused the write told the player their sentence was too short.
 */

const keeps = (): Store & { held: Map<string, string> } => {
  const held = new Map<string, string>();
  return {
    held,
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => void held.set(key, value),
  };
};

const refuses: Store = {
  getItem: () => null,
  setItem: () => {
    throw new Error('no room');
  },
};

describe('what counts as a question', () => {
  it('is the format’s answer, at the bounds the format states', () => {
    // Against the constants rather than their values.
    expect(isIntention('x'.repeat(MIN_INTENTION_CHARS))).toBe(true);
    expect(isIntention('x'.repeat(MIN_INTENTION_CHARS - 1))).toBe(false);
    expect(isIntention('x'.repeat(MAX_INTENTION_CHARS))).toBe(true);
    expect(isIntention('x'.repeat(MAX_INTENTION_CHARS + 1))).toBe(false);
  });

  it('ignores the space around it, since a player does', () => {
    expect(isIntention('   to see it through   ')).toBe(true);
    expect(isIntention('   \n\t  ')).toBe(false);
  });
});

describe('whether it was kept is a different question', () => {
  it('says kept when it was, and gives it back', () => {
    const store = keeps();

    expect(saveIntention(store, 'to see what I keep avoiding')).toBe(true);
    expect(loadIntention(store)).toBe('to see what I keep avoiding');
  });

  it('says not kept when the device refuses', () => {
    expect(saveIntention(refuses, 'to see it through')).toBe(false);
  });

  it('says not kept when there is no store at all', () => {
    expect(saveIntention(undefined, 'to see it through')).toBe(false);
  });

  it('never confuses the two, which is the defect this is written from', () => {
    // A valid question the device refused is *valid* and *not kept*. The mini
    // app answered both with one boolean and told the player, in the one dialog
    // the game will not start without, that their sentence was too short.
    const said = 'to see what I keep avoiding';

    expect(isIntention(said), 'the words are fine').toBe(true);
    expect(saveIntention(refuses, said), 'the device is not').toBe(false);
  });
});

describe('what comes back when nothing is there', () => {
  it('is empty rather than a crash, whatever the store does', () => {
    const blind: Store = {
      getItem: () => {
        throw new Error('storage is disabled');
      },
      setItem: () => undefined,
    };

    expect(loadIntention(keeps())).toBe('');
    expect(loadIntention(undefined)).toBe('');
    expect(loadIntention(blind)).toBe('');
  });
});

describe('the die will not turn without a question', () => {
  /**
   * The published app will not let anybody near the board without one:
   * `if (!prof.intention) navigate('CHANGE_INTENTION_SCREEN', { blockGoBack: true })`
   * in `screens/helper.ts`, with the back gesture blocked. The mini app refuses
   * a throw for the same reason. This app let a player straight to the die — so
   * the same game on the same board asked a different thing of them depending
   * on what they were holding it in.
   *
   * The reasons are named rather than counted, and in the order a player meets
   * them, because a dimmed control with no explanation is the app ending
   * somebody's game without saying so.
   */
  const ASKING = 'to see what I keep avoiding';

  it('refuses, and says which of the reasons it is', () => {
    const game = newGame(4242);

    expect(mayThrow(game, ''), 'no question yet').toBe('no-intention');
    expect(mayThrow(game, '   '), 'and space is not one either').toBe('no-intention');
    expect(mayThrow(game, ASKING), 'and with one, the die turns').toBe('yes');
  });

  it('refuses the act as well as the drawing', () => {
    // A disabled button is a drawing, and a drawing refuses nothing: a double
    // tap, a keyboard, or a line written next year walks straight past it.
    const game = newGame(4242);
    const attempted = throwDie(game, '');

    expect(attempted.game, 'nothing moved').toBe(game);
    expect(attempted.roll, 'and no throw was taken').toBe(0);
  });

  it('asks for the question before the account, which is the order they arrive in', () => {
    // A player who owes a report and has no question is asked for the question:
    // it is the frame the report is written inside, so asking for the writing
    // first would be asking them to answer a question nobody has put.
    let game = newGame(4242);
    for (let turn = 0; turn < 40 && mayThrow(game, ASKING) === 'yes'; turn += 1) {
      game = throwDie(game, ASKING).game;
    }

    expect(mayThrow(game, ASKING), 'owing an account, with a question').toBe('owes-report');
    expect(mayThrow(game, ''), 'owing an account, without one').toBe('no-intention');
  });

  it('is the same refusal whatever the words are, so long as there are some', () => {
    // The shape rather than one sentence: what somebody is playing for is
    // theirs to phrase, and the gate is about having answered at all.
    // Note which question this gate is asking. Not `isIntention` — that is
    // what the *writer* asks before keeping one, and it has a minimum. This
    // asks whether anything was answered at all, so a single character opens
    // the die and an empty field does not. Two questions, kept apart on
    // purpose, as everywhere else in this file.
    for (const asked of ['to stop hurrying', 'зачем я это делаю', '?', 'ok', '   x   ']) {
      expect(mayThrow(newGame(4242), asked), asked).toBe('yes');
    }

    expect(isIntention('?'), 'and the writer would refuse this one').toBe(false);

    expect(mayThrow(newGame(4242), ''), 'and nothing at all is the one refusal').toBe(
      'no-intention',
    );
  });
});
