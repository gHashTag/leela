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
  type Reflection,
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

/**
 * A failure that cannot fix itself was treated like weather.
 *
 * The live bot held a DeepSeek key with an empty balance. Every report made a
 * round trip, waited, got `402 Insufficient Balance`, and answered with the
 * fallback — a sentence that had been decided before the call was made. The
 * log line was identical to a one-off network blip, so nothing in it said the
 * deployment had never worked.
 *
 * These are about the classes of failure, not about 402. A status that means
 * "a human must act" must not be retried on the next report; one that means
 * "try again" must be.
 */
describe('failures a retry cannot fix', () => {
  /** A model that always fails with the given status, counting attempts. */
  function refusing(status: number) {
    let calls = 0;
    return {
      get calls() {
        return calls;
      },
      model: {
        id: `refusing:${status}`,
        async complete() {
          calls += 1;
          throw new ModelError(`refused (${status})`, status);
        },
      } as LanguageModel,
    };
  }

  /** A clock the test moves by hand. */
  function clock(start = 1_000) {
    let time = start;
    return { now: () => time, advance: (ms: number) => (time += ms) };
  }

  const ask = { language: 'en', plan: 6 } as const;
  const quiet = () => undefined;

  const NEEDS_A_HUMAN = [401, 402, 403, 404];
  const WEATHER = [408, 429, 500, 502, 503];

  it.each(NEEDS_A_HUMAN)('stops calling after %i, which no retry will change', async (status) => {
    const refuser = refusing(status);
    const guide = new Guide({ model: refuser.model, log: quiet, now: clock().now });

    for (let report = 0; report < 5; report += 1) {
      const reflection = await guide.reflect('a report', ask);
      expect(reflection.fromModel).toBe(false);
      expect(reflection.text.length).toBeGreaterThan(0);
    }

    expect(refuser.calls).toBe(1);
    expect(guide.status().available).toBe(false);
    expect(guide.status().skipped).toBe(4);
  });

  it.each(WEATHER)('keeps calling after %i, which might be over by the next report', async (status) => {
    const refuser = refusing(status);
    const guide = new Guide({ model: refuser.model, log: quiet, now: clock().now });

    for (let report = 0; report < 5; report += 1) await guide.reflect('a report', ask);

    expect(refuser.calls).toBe(5);
    expect(guide.status().available).toBe(true);
    expect(guide.status().skipped).toBe(0);
  });

  it('says why, in terms someone can act on', async () => {
    const said: string[] = [];
    const guide = new Guide({
      model: refusing(402).model,
      log: (message) => said.push(message),
      now: clock().now,
    });

    await guide.reflect('a report', ask);

    expect(said.join(' ')).toContain('balance');
    expect(guide.status().reason).toContain('balance');
    expect(guide.status().reason).toContain('402');
  });

  it('says it once per cool-down, not once per report', async () => {
    const said: string[] = [];
    const guide = new Guide({
      model: refusing(401).model,
      log: (message) => said.push(message),
      now: clock().now,
    });

    for (let report = 0; report < 6; report += 1) await guide.reflect('a report', ask);

    expect(said).toHaveLength(1);
  });

  it('tries again once the cool-down passes, so a fix needs no restart', async () => {
    const time = clock();
    const refuser = refusing(402);
    const guide = new Guide({
      model: refuser.model,
      log: quiet,
      now: time.now,
      silenceMs: 60_000,
    });

    await guide.reflect('a report', ask);
    expect(refuser.calls).toBe(1);

    await guide.reflect('a report', ask);
    expect(refuser.calls).toBe(1);

    time.advance(60_001);
    expect(guide.status().available).toBe(true);
    await guide.reflect('a report', ask);
    expect(refuser.calls).toBe(2);
  });

  it('forgets the silence the moment a call works', async () => {
    // Someone tops up the balance. The next attempt after the cool-down
    // succeeds, and nothing should carry the old refusal forward.
    const time = clock();
    let calls = 0;
    const model: LanguageModel = {
      id: 'recovers',
      async complete() {
        calls += 1;
        if (calls === 1) throw new ModelError('no balance', 402);
        return 'a reflection';
      },
    };
    const guide = new Guide({ model, log: quiet, now: time.now, silenceMs: 1000 });

    await guide.reflect('a report', ask);
    expect(guide.status().available).toBe(false);

    time.advance(1001);
    const healed = await guide.reflect('a report', ask);

    expect(healed.fromModel).toBe(true);
    expect(guide.status()).toMatchObject({ available: true, reason: undefined });
  });

  it('treats a failure with no status as weather', async () => {
    // A network error, an abort, anything that is not an HTTP refusal. It is
    // not evidence that a human has to do something.
    let calls = 0;
    const model: LanguageModel = {
      id: 'offline',
      async complete() {
        calls += 1;
        throw new Error('fetch failed');
      },
    };
    const guide = new Guide({ model, log: quiet, now: clock().now });

    await guide.reflect('a report', ask);
    await guide.reflect('a report', ask);

    expect(calls).toBe(2);
    expect(guide.status().available).toBe(true);
  });

  it('still answers the player either way', async () => {
    // The whole point of the fallback: silence is a worse failure than a
    // plain sentence, and a silenced companion must not become silence.
    const guide = new Guide({ model: refusing(402).model, log: quiet, now: clock().now });
    const first = await guide.reflect('a report', ask);
    const second = await guide.reflect('a report', ask);
    expect(first.text).toBe(second.text);
    expect(second.text).toContain('6');
  });
});

describe('the deadline', () => {
  /**
   * A promise about how long a player waits is only worth what the slowest
   * model keeps, and `LanguageModel` is an interface anyone may implement.
   *
   * The test that was here handed the guide a model which listened for the
   * abort and rejected on it — so it proved the signal was passed, which was
   * never the doubtful part. Every model that does *not* listen went untested,
   * and one of them never returned at all: no answer, no fallback, no error,
   * the player shown nothing forever.
   *
   * So the assertion is about the shape of the promise rather than about the
   * models that happen to keep it: **whatever is behind the interface, an
   * answer arrives.** Each of these is a plausible mistake in somebody's
   * adapter, and one is not a mistake at all.
   */
  const slow = 10_000;
  const models: Array<{ what: string; model: LanguageModel }> = [
    { what: 'never returns', model: { id: 'a', complete: () => new Promise<string>(() => {}) } },
    {
      what: 'answers long after anyone is waiting',
      model: {
        id: 'b',
        complete: () => new Promise<string>((resolve) => setTimeout(() => resolve('late'), slow)),
      },
    },
    {
      what: 'fails long after anyone is waiting',
      model: {
        id: 'c',
        complete: () =>
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('late')), slow)),
      },
    },
    {
      what: 'listens for the abort, as an adapter should',
      model: {
        id: 'd',
        complete: (_messages, options) =>
          new Promise<string>((_, reject) => {
            options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      },
    },
  ];

  for (const { what, model } of models) {
    it(`answers within it, given a model that ${what}`, async () => {
      const logged: string[] = [];
      const guide = new Guide({ model, timeoutMs: 20, log: (message) => logged.push(message) });

      const answered = await Promise.race([
        guide.answer('what does 41 ask of me', { language: 'en', plan: 41 }),
        new Promise<'nothing at all'>((resolve) => setTimeout(() => resolve('nothing at all'), 800)),
      ]);

      expect(answered, 'a player is never left with nothing').not.toBe('nothing at all');
      expect((answered as Reflection).fromModel).toBe(false);
      expect((answered as Reflection).text).toContain('41');
    }, 5_000);
  }

  it('says a deadline passed rather than that something failed', async () => {
    // An operator reading "model failed" goes looking for a status code that
    // was never issued. Nothing answered; that is the fact to log.
    const logged: string[] = [];
    const guide = new Guide({
      model: { id: 'a', complete: () => new Promise<string>(() => {}) },
      timeoutMs: 20,
      log: (message) => logged.push(message),
    });

    await guide.answer('what does 41 ask of me', { language: 'en', plan: 41 });

    expect(logged.join(' ')).toMatch(/timed out/i);
  }, 5_000);

  it('is not a reason to go quiet, because the next one may be answered', async () => {
    // Unlike a refused key. A slow minute is weather, and half an hour of
    // silence over one of them would cost the reports it was meant to protect.
    let hang = true;
    const guide = new Guide({
      model: {
        id: 'sometimes',
        complete: () => (hang ? new Promise<string>(() => {}) : Promise.resolve('an answer')),
      },
      timeoutMs: 20,
      log: () => undefined,
    });

    await guide.answer('what does 41 ask of me', { language: 'en', plan: 41 });
    expect(guide.status().available, 'still trying').toBe(true);

    hang = false;
    const second = await guide.answer('and now', { language: 'en', plan: 41 });
    expect(second.fromModel).toBe(true);
    expect(guide.status().skipped, 'nothing was skipped unasked').toBe(0);
  }, 5_000);
});

describe('every option a caller gives reaches the prompt', () => {
  /**
   * `contextOf` copies `AskOptions` into a `PlanContext` field by field, which
   * is a restated list — and this repository has had six of those go wrong.
   * It bit immediately: `arrival` was declared on both types and left out of
   * the copy, so the fix that stops the companion being told a player is
   * standing on a square somebody sent them would have been dead code with
   * nothing to say so.
   *
   * Asserted through the prompt the model is actually handed, not through the
   * function: a field that reaches the context and is never rendered is the
   * same silence one field further on.
   */
  const seen: string[] = [];
  const remembers: LanguageModel = {
    id: 'test',
    async complete(messages) {
      seen.push(messages.map((one) => one.content).join('\n'));
      return 'something';
    },
  };

  it('carries every one of them', async () => {
    seen.length = 0;
    const guide = guideWith(remembers).guide;

    await guide.reflect('a report about this square', {
      plan: 41,
      language: 'en',
      arrival: 'received',
      direction: 'snake 🐍',
      previousPlan: 12,
      intention: 'What am I holding on to?',
      journey: [{ plan: 41, text: 'an earlier account of this very square' }],
    });

    const prompt = seen.at(-1) ?? '';

    // Each option, by something only it can put there.
    expect(prompt, 'plan').toContain('41');
    expect(prompt, 'intention').toContain('What am I holding on to?');
    expect(prompt, 'journey').toContain('an earlier account of this very square');
    expect(prompt, 'arrival').toContain('sent the player');
  });

  it('says a received square is not where the player stands', async () => {
    seen.length = 0;
    const guide = guideWith(remembers).guide;

    await guide.reflect('what somebody else wrote', {
      plan: 41,
      language: 'en',
      arrival: 'received',
    });

    const prompt = seen.at(-1) ?? '';
    expect(prompt).toContain('not standing there');
    expect(prompt, 'the ordinary sentence').not.toContain('The player is on plan 41');
  });

  it('describes no arrival for a square nobody arrived on', async () => {
    // A snake brought nobody here. Saying it would be a fact invented about a
    // square the player has never been on.
    seen.length = 0;
    const guide = guideWith(remembers).guide;

    await guide.reflect('what somebody else wrote', {
      plan: 41,
      language: 'en',
      arrival: 'received',
      direction: 'snake 🐍',
      previousPlan: 12,
    });

    const prompt = seen.at(-1) ?? '';
    expect(prompt).not.toContain('came from plan 12');
  });

  it('still says it plainly for a square the player is on', async () => {
    // The guard against the fix becoming a way of never saying where they are.
    seen.length = 0;
    const guide = guideWith(remembers).guide;

    await guide.reflect('my own account', { plan: 41, language: 'en', direction: 'snake 🐍' });

    const prompt = seen.at(-1) ?? '';
    expect(prompt).toContain('The player is on plan 41');
    expect(prompt, 'and how they got there').toContain('snake');
  });

  it('does not call the winning square an ending for somebody handed it', async () => {
    seen.length = 0;
    const guide = guideWith(remembers).guide;

    await guide.reflect('a square somebody sent', { plan: 68, language: 'en', arrival: 'received' });

    expect(seen.at(-1) ?? '', 'the sender finished, not the reader').not.toContain(
      'This is the end of a game',
    );
  });
});
