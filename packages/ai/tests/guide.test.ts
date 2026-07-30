import { describe, expect, it, vi } from 'vitest';
import { planFor } from '@leela/content';
import {
  Guide,
  ModelError,
  PromptError,
  fallbackText,
  fixedModel,
  recordingModel,
  type LanguageModel,
} from '../src';

const ask = { plan: 12, language: 'en' as const };

/** A guide whose log is captured rather than printed. */
function guideWith(model: LanguageModel, timeoutMs?: number) {
  const logged: string[] = [];
  const guide = new Guide({ model, timeoutMs, log: (message) => logged.push(message) });
  return { guide, logged };
}

describe('reflect', () => {
  it('returns what the model said', async () => {
    const { guide } = guideWith(fixedModel('  a reply  '));
    const reflection = await guide.reflect('my report', ask);

    expect(reflection.text).toBe('a reply');
    expect(reflection.fromModel).toBe(true);
  });

  it('sends the canonical text along with the report', async () => {
    const model = recordingModel();
    const { guide } = guideWith(model);
    await guide.reflect('my report', ask);

    const [call] = model.calls;
    expect(call.messages[0].role).toBe('system');
    expect(call.messages[0].content).toContain(planFor('en', 12).title);
    expect(call.messages.at(-1)?.content).toBe('my report');
  });

  it('sends the text in the player’s language', async () => {
    const model = recordingModel();
    const { guide } = guideWith(model);
    await guide.reflect('отчёт', { plan: 12, language: 'ru' });

    expect(model.calls[0].messages[0].content).toContain(planFor('ru', 12).title);
    expect(model.calls[0].messages[0].content).toContain('Answer in Russian.');
  });

  it('passes how the player arrived, so the answer can meet them there', async () => {
    const model = recordingModel();
    const { guide } = guideWith(model);
    await guide.reflect('report', { ...ask, direction: 'snake 🐍', previousPlan: 30 });

    const prompt = model.calls[0].messages[0].content;
    expect(prompt).toMatch(/brought down/i);
    expect(prompt).toContain('came from plan 30');
  });
});

describe('answer', () => {
  it('answers a question about the plan', async () => {
    const model = recordingModel('the text says…');
    const { guide } = guideWith(model);
    const reflection = await guide.answer('what is maya?', ask);

    expect(reflection.text).toBe('the text says…');
    expect(model.calls[0].messages.at(-1)?.content).toBe('what is maya?');
  });
});

describe('when the model fails', () => {
  // The game must not stop working because a companion is unavailable: the
  // reflection is the game, and the companion is a help with it.

  it('falls back to a usable answer instead of throwing', async () => {
    const broken: LanguageModel = {
      id: 'broken',
      async complete() {
        throw new ModelError('the model refused the request (500)', 500);
      },
    };
    const { guide, logged } = guideWith(broken);
    const reflection = await guide.reflect('report', ask);

    expect(reflection.fromModel).toBe(false);
    expect(reflection.text).toBe(fallbackText(ask));
    expect(logged.join()).toMatch(/500/);
  });

  it('names the plan even in the fallback, so it still helps', () => {
    expect(fallbackText({ plan: 42, language: 'en' })).toContain('42');
  });

  it('falls back on a network error too, not only an API error', async () => {
    const offline: LanguageModel = {
      id: 'offline',
      async complete() {
        throw new TypeError('fetch failed');
      },
    };
    const { guide } = guideWith(offline);
    expect((await guide.reflect('report', ask)).fromModel).toBe(false);
  });

  it('gives up rather than leaving a player waiting', async () => {
    vi.useFakeTimers();
    try {
      const hangs: LanguageModel = {
        id: 'hangs',
        complete(_messages, options) {
          return new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          });
        },
      };
      const { guide } = guideWith(hangs, 5_000);
      const pending = guide.reflect('report', ask);

      await vi.advanceTimersByTimeAsync(5_000);
      const reflection = await pending;
      expect(reflection.fromModel).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('always returns something to show', async () => {
    const empty: LanguageModel = {
      id: 'empty',
      async complete() {
        throw new ModelError('the model returned an empty reply');
      },
    };
    const { guide } = guideWith(empty);
    expect((await guide.reflect('report', ask)).text.trim().length).toBeGreaterThan(0);
  });
});

describe('when the caller is wrong', () => {
  // A malformed request is a bug in the calling code, not the world being
  // unreliable — swallowing it would hide the bug behind a friendly sentence.

  it('rethrows an empty report rather than papering over it', async () => {
    const { guide } = guideWith(fixedModel('x'));
    await expect(guide.reflect('   ', ask)).rejects.toThrow(PromptError);
  });

  it('rethrows a plan that is not on the board', async () => {
    const { guide } = guideWith(fixedModel('x'));
    await expect(guide.reflect('report', { ...ask, plan: 99 })).rejects.toThrow(PromptError);
  });
});

describe('the guide sees the path', () => {
  it('sends the journey along with the report', async () => {
    const model = recordingModel();
    const { guide } = guideWith(model);

    await guide.reflect('now this', {
      ...ask,
      journey: [
        { plan: 6, text: 'the beginning felt abrupt' },
        { plan: 23, text: 'lighter here' },
      ],
    });

    const prompt = model.calls[0].messages[0].content;
    expect(prompt).toContain('the beginning felt abrupt');
    expect(prompt).toContain('lighter here');
  });

  it('works without one, because a first report has no path yet', async () => {
    const model = recordingModel();
    const { guide } = guideWith(model);
    await guide.reflect('my first', ask);

    expect(model.calls[0].messages[0].content).not.toMatch(/Where they have been/);
  });

  it('passes the journey on a question too, not only a report', async () => {
    const model = recordingModel();
    const { guide } = guideWith(model);
    await guide.answer('what is maya?', { ...ask, journey: [{ plan: 2, text: 'noted' }] });

    expect(model.calls[0].messages[0].content).toContain('noted');
  });
});

describe('the fallback speaks the language the player is playing in', () => {
  // A companion outage is the moment the game explains itself least well, and
  // it used to explain itself in English to everyone. The assertion is that
  // the fallback follows the context's language, not that one sentence exists.
  it('names the plan in Russian for a Russian player', () => {
    const text = fallbackText({ plan: 41, language: 'ru' });
    expect(text).toContain('41');
    expect(text).toMatch(/[а-яё]/i);
    expect(text).not.toMatch(/[A-Za-z]/);
  });

  it('falls back to English for a language with no catalogue', () => {
    expect(fallbackText({ plan: 41, language: 'ja' })).toBe(
      fallbackText({ plan: 41, language: 'en' }),
    );
  });

  it('always names the plan, whatever the language', () => {
    for (const language of ['en', 'ru', 'de', 'zh'] as const) {
      expect(fallbackText({ plan: 7, language })).toContain('7');
    }
  });
});
