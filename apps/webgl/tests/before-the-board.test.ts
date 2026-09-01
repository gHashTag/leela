import { describe, expect, it, vi } from 'vitest';

import { Companion } from '../src/companion';

/**
 * Words typed before the first six.
 *
 * `said()` used to return without a sound when no plan was underfoot — the
 * player's question vanished: no line, no note, no request. The rule the
 * no-model branch has always kept — not an apology and not a silent drop —
 * now covers the doorstep too: the words are answered in the note, in the
 * language of the question, and the note leaves when the arrival answers it.
 */
describe('a question asked before the board', () => {
  const arrive = (companion: Companion): void =>
    companion.arrived(6, null, 'A six. You enter the game on 6.');

  it('is answered in the note, not dropped', async () => {
    const ask = vi.fn();
    const companion = new Companion({ language: 'en', ask });

    await companion.say('how do I start?');

    const view = companion.view();
    expect(view.note).toContain('throw a six');
    expect(ask).not.toHaveBeenCalled();
    // No plan to anchor a line to: the thread stays empty rather than
    // carrying a line about a square nobody stands on.
    expect(view.lines).toEqual([]);
  });

  it('answers in the language of the question, not of the board', async () => {
    const companion = new Companion({ language: 'en', ask: vi.fn() });

    await companion.say('Как начать игру?');

    expect(companion.view().note).toContain('шестёрку');
  });

  it('says nothing for words that are only whitespace', async () => {
    const companion = new Companion({ language: 'en', ask: vi.fn() });

    await companion.say('   ');

    expect(companion.view().note).toBeNull();
  });

  it('the arrival takes the note down: the refusal it explains has ended', async () => {
    const companion = new Companion({ language: 'en', ask: vi.fn() });

    await companion.say('anyone there?');
    expect(companion.view().note).not.toBeNull();

    arrive(companion);

    expect(companion.view().note).toBeNull();
  });

  it('stands whether or not a model is configured', async () => {
    const withoutModel = new Companion({ language: 'en' });

    await withoutModel.say('how do I start?');

    // The doorstep answer comes before the model question: a keyless build
    // gives the same honest sentence, not the unavailable-companion one.
    expect(withoutModel.view().note).toContain('throw a six');
    expect(withoutModel.view().lines).toEqual([]);
  });
});
