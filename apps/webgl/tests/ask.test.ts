import { describe, expect, it } from 'vitest';
import { ARROWS, SNAKES, START_LOKA, WIN_LOKA } from '@leela/engine';
import { messageFor } from '@leela/content';

import { askOverHttp, askUrl, historyFor, rulesText, systemFor } from '../src/ask';
import type { Line, Rests } from '../src/companion';

/**
 * What travels with a question, checked because each of these was missing and
 * each absence looked like the model being poor rather than uninformed.
 */

const rests = (plan: number): Rests =>
  ({
    plan,
    title: 'Avarice (matsarya)',
    canonChars: 0,
    language: 'ru',
    direction: '',
  }) as Rests;

const line = (who: Line['who'], text: string, plan = 8): Line =>
  ({ who, text, source: who === 'player' ? 'player' : 'model', plan }) as Line;

describe('the rules that travel with a question', () => {
  const rules = rulesText();

  it('says a six is what enters, and where it lands', () => {
    expect(rules).toContain('six');
    expect(rules).toContain(String(START_LOKA));
  });

  it('says three sixes send the player back', () => {
    expect(rules.toLowerCase()).toContain('three sixes');
  });

  it('names the winning plan', () => {
    expect(rules).toContain(String(WIN_LOKA));
  });

  it('carries every snake and every arrow, not a sample', () => {
    for (const [head, tail] of Object.entries(SNAKES)) {
      expect(rules).toContain(`${head}->${tail}`);
    }
    for (const [foot, tip] of Object.entries(ARROWS)) {
      expect(rules).toContain(`${foot}->${tip}`);
    }
  });

  it('says a throw past the end does not move', () => {
    expect(rules).toContain('does not move');
  });

  it('says the die is closed until the player writes', () => {
    expect(rules).toContain('die stays closed');
  });
});

describe('the system message', () => {
  it('carries the rules, so the answer is about this board', () => {
    expect(systemFor(rests(8), 'ru', '')).toContain(rulesText());
  });

  it('names the square the player stands on', () => {
    const system = systemFor(rests(8), 'en', '');
    expect(system).toContain('plan 8');
    expect(system).toContain('Avarice');
  });

  it('quotes the plan text it is given', () => {
    expect(systemFor(rests(8), 'en', 'Greed with envy in it.')).toContain(
      'Greed with envy in it.',
    );
  });

  it('does not overrun on a very long plan text', () => {
    const long = 'x'.repeat(5000);
    expect(systemFor(rests(8), 'en', long).length).toBeLessThan(
      rulesText().length + 2500,
    );
  });

  it('asks for a closing line about the next act, in the reader language', () => {
    // Asked of the catalogue rather than written out here: the phrase belongs
    // to `button.roll` and this used to restate the Russian of it, which is the
    // shape this repository keeps catching - a test that copies a string
    // instead of stating the claim, and goes stale the day the wording does.
    expect(systemFor(rests(8), 'ru', '')).toContain(
      messageFor('ru', 'button.roll').replace(/^[^\p{L}]+/u, ''),
    );
    expect(systemFor(rests(8), 'en', '')).toContain(
      messageFor('en', 'button.roll').replace(/^[^\p{L}]+/u, ''),
    );
  });

  it('asks for the reply in the reader language', () => {
    // The endonym and the tag. `LANGUAGE_NAMES` holds what a language calls
    // itself, so the English name is not available - and *Reply in Русский*
    // alone asks a model to recognise a name written in the script it is being
    // asked to produce. The tag settles it.
    expect(systemFor(rests(8), 'ru', '')).toContain('Reply in Русский (ru)');
    expect(systemFor(rests(8), 'en', '')).toContain('Reply in English');
  });
});

describe('the thread that travels with a question', () => {
  it('is empty when nothing has been said', () => {
    expect(historyFor([])).toBe('');
  });

  it('keeps who said what', () => {
    const thread = historyFor([
      line('player', 'I keep coming back here'),
      line('companion', 'That is the pattern asking again'),
    ]);
    expect(thread).toContain('Player (plan 8): I keep coming back here');
    expect(thread).toContain('Companion (plan 8): That is the pattern asking again');
  });

  it('keeps the newest lines rather than the oldest', () => {
    const many = Array.from({ length: 30 }, (_, at) => line('player', `line ${at}`));
    const thread = historyFor(many);
    expect(thread).toContain('line 29');
    expect(thread).not.toContain('line 0:');
  });

  it('trims a long line so one plan text cannot crowd out the rest', () => {
    const thread = historyFor([line('companion', 'y'.repeat(5000))]);
    expect(thread.length).toBeLessThan(600);
  });

  it('carries the plan each line was about', () => {
    const thread = historyFor([line('player', 'here', 8), line('player', 'there', 35)]);
    expect(thread).toContain('plan 8');
    expect(thread).toContain('plan 35');
  });
});

describe('a route that explains itself', () => {
  const rests: Rests = {
    plan: 8,
    title: 'Greed',
    previousPlan: null,
    direction: null,
    canonChars: 10,
    language: 'en',
    model: 'test',
    journey: 0,
  };
  const textFor = () => 'the plan text';

  /** Runs `body` with `fetch` swapped, and puts the real one back either way. */
  const withFetch = async (stub: unknown, body: () => Promise<void>): Promise<void> => {
    const real = globalThis.fetch;
    globalThis.fetch = stub as typeof fetch;
    try {
      await body();
    } finally {
      globalThis.fetch = real;
    }
  };

  const answering = (status: number, said: unknown) => async () =>
    new Response(JSON.stringify(said), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  it('carries the reason the route gave, rather than blaming the model', async () => {
    // The defect this exists for: with no key the route answers 503 *no model
    // configured*, the ask returned '', and the companion - which treats no
    // answer as the model answering nothing - wrote *the model answered with
    // nothing* into the one diagnostic the screen shows. The model was never
    // reached. Somebody reading that note goes looking at the model instead of
    // at the key that is missing.
    await withFetch(answering(503, { error: 'no model configured' }), async () => {
      await expect(
        askOverHttp('en', textFor)('what does this plan ask', rests, []),
      ).rejects.toThrow('no model configured');
    });
  });

  it('says what it was told even when the route explains nothing', async () => {
    await withFetch(answering(502, {}), async () => {
      await expect(askOverHttp('en', textFor)('anything', rests, [])).rejects.toThrow('502');
    });
  });

  it('stays silent for a network that simply went away', async () => {
    // Not a refusal anybody explained: a dropped connection is the companion's
    // supported offline mode, and it has a sentence for that already.
    await withFetch(
      async () => {
        throw new Error('network down');
      },
      async () => {
        await expect(askOverHttp('en', textFor)('anything', rests, [])).resolves.toBe('');
      },
    );
  });
});

describe('what the companion is told to rest on', () => {
  it('names the scriptures rather than gesturing at them', () => {
    // This line read *answer from this board and the Vedic sources it rests
    // on*, which asks a model to remember that Leela has sources without
    // saying which. Naming them is the difference between an answer grounded in
    // a tradition and an answer that sounds like one.
    const said = systemFor(rests(8), 'en', '');
    for (const text of ['Bhagavad Gita', 'Upanishads', 'Vedas', 'Purana', 'Yoga Sutras']) {
      expect(said, text).toContain(text);
    }
  });

  it('puts the plan before the tradition', () => {
    // A plan's own text is what the player is standing on. A scripture that
    // contradicts it is being applied to the wrong square.
    const said = systemFor(rests(8), 'en', 'the text of plan 8');
    expect(said.indexOf('the text of plan 8')).toBeLessThan(said.indexOf('Bhagavad Gita'));
  });

  it('forbids an invented citation', () => {
    // The one failure mode of asking for chapter and verse. A named source can
    // be looked up and argued with; a fabricated one is worse than none, in a
    // game played on the strength of what the plans mean.
    expect(systemFor(rests(8), 'en', '')).toContain('Never invent a citation');
  });

  it('still carries the rules of this board', () => {
    // The scriptures were added beside the rules, not in place of them.
    expect(systemFor(rests(8), 'en', '')).toContain(rulesText());
  });

  it('asks for the reply in a language it can be sure of, for all of them', () => {
    // Not two. `Reply in ${russian ? 'Russian' : 'English'}` stood here while
    // the catalogue carried twenty-two, so a Ukrainian or Hindi player was
    // answered in English by instruction.
    for (const language of ['ru', 'uk', 'hi', 'ja', 'ar'] as const) {
      expect(systemFor(rests(8), language, ''), language).toContain(`(${language})`);
    }
  });
});

describe('where a question is sent', () => {
  it('stays relative in a browser, where page and route share an origin', () => {
    delete (globalThis as { __leelaAsk?: unknown }).__leelaAsk;
    expect(askUrl()).toBe('/api/ask');
  });

  it('goes to the host the app names, because file:// has nowhere to be relative to', () => {
    (globalThis as { __leelaAsk?: unknown }).__leelaAsk = 'https://ask.example.com';
    expect(askUrl()).toBe('https://ask.example.com/api/ask');
  });

  it('does not double the slash when the host is written with one', () => {
    (globalThis as { __leelaAsk?: unknown }).__leelaAsk = 'https://ask.example.com/';
    expect(askUrl()).toBe('https://ask.example.com/api/ask');
    delete (globalThis as { __leelaAsk?: unknown }).__leelaAsk;
  });

  it('ignores anything that is not a string, rather than asking undefined', () => {
    // A page is a thing other software writes into. A bad value should leave
    // the browser case working, not produce `undefined/api/ask`.
    (globalThis as { __leelaAsk?: unknown }).__leelaAsk = 42;
    expect(askUrl()).toBe('/api/ask');
    (globalThis as { __leelaAsk?: unknown }).__leelaAsk = '';
    expect(askUrl()).toBe('/api/ask');
    delete (globalThis as { __leelaAsk?: unknown }).__leelaAsk;
  });
});
