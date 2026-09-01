import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { blank } from '../../../scripts/lib/source.mjs';
import { MAX_INTENTION_CHARS, MIN_INTENTION_CHARS } from '@leela/journal';
import { askingFor, isIntention, mayChangeIntention } from '../src/journal';
import { HANDLE } from '../src/handles';

/**
 * The question the game is played to answer.
 *
 * This app asked it once and locked it. `intention === ''` was the whole
 * condition for the box being open, so a player who had answered could never
 * revise it — over seventy-two squares, where the question somebody starts with
 * is the one most likely to change — and it never showed them what they had
 * said, while writing it into every square they shared.
 *
 * Both other surfaces do both. The published app has a screen for it reachable
 * **twice**: `screens/helper.ts` sends a player who has none there with
 * `blockGoBack: true`, and `ProfileScreen/Tabs/IntentionOfGame.tsx` sends
 * anyone there at any time with `{ prevIntention: intention }` and no block.
 * The mini app shows it at the head of the path with a *Change it* beside it.
 *
 * `app.intentionYours` and `app.intentionChange` have been in the catalogue in
 * English and Russian since the mini app needed them. This surface said
 * neither.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = blank(readFileSync(join(HERE, '..', 'src', 'App.tsx'), 'utf8'));

describe('when the box is open', () => {
  it('opens for a player who has not answered', () => {
    expect(askingFor('', false).open).toBe(true);
  });

  it('opens again for one who wants to change their answer', () => {
    // The whole defect: this was `intention === ''` and nothing else, so the
    // second time was never.
    expect(askingFor('to see what I keep avoiding', true).open).toBe(true);
  });

  it('is shut for a player who has answered and is not changing it', () => {
    expect(askingFor('to see what I keep avoiding', false).open).toBe(false);
  });

  it('is open on the first answer whether or not they asked to change it', () => {
    // A player with no question is not changing one, and the gate that keeps
    // them off the board must not depend on a control they have never seen.
    for (const changing of [true, false]) {
      expect(askingFor('', changing).open, `changing: ${changing}`).toBe(true);
    }
  });
});

describe('what the box opens with', () => {
  it('opens with theirs when they are changing it', () => {
    /**
     * `defaultValues: { newIntention: prevIntention || '' }` in the published
     * app's own `ChangeIntention`. Revising eight hundred characters is editing
     * and not retyping, and that is the whole difference between a question
     * somebody can change and one they can only replace.
     */
    const theirs = 'to find out what I do when nothing is asked of me';
    expect(askingFor(theirs, true).prefill).toBe(theirs);
  });

  it('opens empty for a first answer', () => {
    expect(askingFor('', false).prefill).toBe('');
    expect(askingFor('', true).prefill).toBe('');
  });

  it('opens with something the save will accept', () => {
    // A box pre-filled with what it will then refuse is a control that cannot
    // be dismissed. Held over the bounds rather than an example: `isIntention`
    // is the one question all three surfaces ask.
    const longest = 'x'.repeat(MAX_INTENTION_CHARS);
    const shortest = 'x'.repeat(MIN_INTENTION_CHARS);

    for (const theirs of [shortest, longest, 'a sentence they meant']) {
      expect(isIntention(askingFor(theirs, true).prefill), theirs.slice(0, 20)).toBe(true);
    }
  });
});

describe('whether there is a question to change', () => {
  it('is no when none has been given', () => {
    expect(mayChangeIntention('')).toBe(false);
    expect(mayChangeIntention('   \n ')).toBe(false);
  });

  it('is yes once one has', () => {
    expect(mayChangeIntention('to stop deciding twice')).toBe(true);
  });

  it('never says yes at the same moment the first box is open', () => {
    /**
     * The shape rather than the two cases: the control that reopens the
     * question and the box that first asks it are the same question read two
     * ways, and a screen showing both would be asking somebody to change an
     * answer they have not given.
     */
    for (const intention of ['', '  ', 'an answer', 'x'.repeat(MAX_INTENTION_CHARS)]) {
      for (const changing of [true, false]) {
        const shown = mayChangeIntention(intention) && !askingFor(intention, changing).open;
        expect(shown && askingFor(intention, changing).open, `${intention.length}/${changing}`).toBe(
          false,
        );
      }
    }
  });
});

describe('the screen says it, and lets them change it', () => {
  it('shows the answer back', () => {
    // It never did. The question was asked, kept, written into every shared
    // square, and never once shown to the player who gave it.
    expect(APP).toContain(`testID={HANDLE.intentionYours}`);
    expect(APP).toContain("messageFor(language, 'app.intentionYours')");
  });

  it('offers a way to change it', () => {
    expect(APP).toContain(`testID={HANDLE.intentionChange}`);
    expect(APP).toContain("messageFor(language, 'app.intentionChange')");
  });

  it('opens that box with what they wrote, through the rule and not by hand', () => {
    expect(APP).toContain('setAsking(askingFor(intention, true).prefill)');
  });

  it('draws the box from the rule rather than from a comparison', () => {
    // `intention === ''` was the condition, in the screen, and there was
    // nowhere else for a second reason to open it to live.
    expect(APP).toContain('const ask = askingFor(intention, changing)');
    expect(APP).toContain('{ask.open ? (');
    expect(APP, 'no second answer written in the screen').not.toMatch(/\{intention === '' \? \(/);
  });

  it('shuts it again when the answer is kept', () => {
    // Otherwise the box stays open over a question that has just been answered,
    // and the only way out is to answer it again.
    expect(APP).toContain('setChanging(false)');
  });

  it('names both controls, as every control on this screen is named', () => {
    expect(HANDLE.intentionYours).toBe('intention-yours');
    expect(HANDLE.intentionChange).toBe('intention-change');
  });
});
