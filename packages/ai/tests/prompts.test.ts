import { describe, expect, it } from 'vitest';
import { LANGUAGES, planFor } from '@leela/content';
import { TOTAL_PLANS, WIN_LOKA } from '@leela/engine';
import {
  MAX_HISTORY,
  MAX_JOURNEY_CHARS,
  MAX_JOURNEY_ENTRIES,
  MAX_JOURNEY_ENTRY_CHARS,
  MAX_PLAN_CHARS,
  PromptError,
  questionPrompt,
  reportPrompt,
  summariseJourney,
  systemPrompt,
  trimToParagraph,
} from '../src';

const base = { plan: 1, language: 'en' as const };

describe('the prompt rests on the canonical text', () => {
  // This is the defect the package exists to fix: the service it replaces
  // asked the model to invent a description of the plan, with the traditional
  // text sitting unused in the repository.

  it('puts the plan text into the prompt rather than asking for one', () => {
    const prompt = systemPrompt({ plan: 1, language: 'en' });
    const canonical = planFor('en', 1);

    expect(prompt).toContain(canonical.title);
    expect(prompt).toContain(canonical.body.slice(0, 120));
  });

  it('never asks the model to produce the plan text itself', () => {
    // The shape of the old defect: an instruction to generate the teaching.
    // Matching the bare word "invent" would also catch this prompt's own
    // instruction *not* to, so match the request, not the vocabulary.
    const asksForContent =
      /\b(write|create|generate|compose|produce|make up)\b[^.]{0,40}\b(description|text|teaching|meaning) of\b/i;

    for (let plan = 1; plan <= TOTAL_PLANS; plan++) {
      expect(systemPrompt({ plan, language: 'en' }), `plan ${plan}`).not.toMatch(asksForContent);
    }
  });

  it('forbids inventing what the text does not say', () => {
    expect(systemPrompt(base)).toMatch(/rather than\s+inventing/i);
  });

  it('tells the model the text is the source and it is not', () => {
    const prompt = systemPrompt(base);
    expect(prompt).toMatch(/It is the source; you are not/i);
    expect(prompt).toMatch(/do not contradict it/i);
  });

  it('carries the right text for every plan', () => {
    for (let plan = 1; plan <= TOTAL_PLANS; plan++) {
      const prompt = systemPrompt({ plan, language: 'en' });
      expect(prompt, `plan ${plan}`).toContain(planFor('en', plan).title);
      expect(prompt).toContain(`plan ${plan}:`);
    }
  });

  it('carries the text in the player’s own language', () => {
    for (const language of LANGUAGES) {
      const prompt = systemPrompt({ plan: 1, language });
      expect(prompt, language).toContain(planFor(language, 1).title);
    }
  });

  it('names the answer language explicitly rather than implying it', () => {
    expect(systemPrompt({ plan: 1, language: 'ru' })).toContain('Answer in Russian.');
    expect(systemPrompt({ plan: 1, language: 'ja' })).toContain('Answer in Japanese.');
  });

  it('falls back to English for a locale the dataset does not carry', () => {
    // `language` is typed, but a value can still arrive from a database row.
    const prompt = systemPrompt({ plan: 1, language: 'kl' as never });
    expect(prompt).toContain('Answer in English.');
  });
});

describe('the prompt describes the move', () => {
  it('says how the player arrived, when it knows', () => {
    expect(systemPrompt({ ...base, direction: 'snake 🐍' })).toMatch(/brought down/i);
    expect(systemPrompt({ ...base, direction: 'arrow 🏹' })).toMatch(/carried up/i);
    expect(systemPrompt({ ...base, direction: 'step 🚶🏼' })).toMatch(/one square at a time/i);
  });

  it('says where they came from, when that is somewhere else', () => {
    expect(systemPrompt({ ...base, plan: 23, previousPlan: 10 })).toContain('came from plan 10');
    expect(systemPrompt({ ...base, plan: 10, previousPlan: 10 })).not.toContain('came from');
  });

  it('marks the win square as an ending and a beginning', () => {
    expect(systemPrompt({ plan: WIN_LOKA, language: 'en' })).toMatch(/end of a game/i);
  });
});

describe('the prompt sets limits', () => {
  it('asks for brevity, because a companion is not an essayist', () => {
    expect(systemPrompt(base)).toMatch(/brief/i);
  });

  it('forbids fortune-telling and verdicts on a life', () => {
    const prompt = systemPrompt(base);
    expect(prompt).toMatch(/do not predict the/i);
    expect(prompt).toMatch(/what their life means/i);
  });

  it('says plainly that it is not a therapist', () => {
    // The published app carries the same disclaimer; a companion that implies
    // otherwise is the failure mode worth guarding against.
    expect(systemPrompt(base)).toMatch(/not a\s+therapist/i);
    expect(systemPrompt(base)).toMatch(/someone qualified/i);
  });
});

describe('trimToParagraph', () => {
  it('leaves a short text alone', () => {
    expect(trimToParagraph('short', 100)).toBe('short');
  });

  it('cuts on a paragraph break rather than mid-sentence', () => {
    const text = `${'a'.repeat(60)}\n\n${'b'.repeat(60)}`;
    expect(trimToParagraph(text, 80)).toBe('a'.repeat(60));
  });

  it('falls back to a sentence end when there is no usable break', () => {
    const text = `${'word '.repeat(15)}. ${'more '.repeat(20)}`;
    const out = trimToParagraph(text, 80);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith('.')).toBe(true);
  });

  it('never returns more than it was asked for, for any plan', () => {
    for (let plan = 1; plan <= TOTAL_PLANS; plan++) {
      for (const language of LANGUAGES) {
        const trimmed = trimToParagraph(planFor(language, plan).body);
        expect(trimmed.length, `${language} plan ${plan}`).toBeLessThanOrEqual(MAX_PLAN_CHARS);
      }
    }
  });

  it('keeps a useful amount of text rather than cutting to nothing', () => {
    for (let plan = 1; plan <= TOTAL_PLANS; plan++) {
      const body = planFor('en', plan).body;
      const trimmed = trimToParagraph(body);
      const kept = trimmed.length / Math.min(body.length, MAX_PLAN_CHARS);
      expect(kept, `plan ${plan}`).toBeGreaterThan(0.4);
    }
  });
});

describe('reportPrompt', () => {
  it('is a system prompt then the report', () => {
    const messages = reportPrompt(base, 'what came up for me');
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1]).toEqual({ role: 'user', content: 'what came up for me' });
  });

  it('trims the report, and refuses an empty one', () => {
    expect(reportPrompt(base, '  spaced  ')[1].content).toBe('spaced');
    for (const empty of ['', '   ', '\n\t']) {
      expect(() => reportPrompt(base, empty)).toThrow(PromptError);
    }
  });

  it('refuses a plan off the board', () => {
    for (const plan of [0, 73, -1, 1.5]) {
      expect(() => reportPrompt({ ...base, plan }, 'x'), `plan ${plan}`).toThrow(PromptError);
    }
  });

  it('carries recent history, oldest first', () => {
    const history = [
      { role: 'user' as const, content: 'first' },
      { role: 'assistant' as const, content: 'answer' },
    ];
    const messages = reportPrompt(base, 'now', history);
    expect(messages.map((m) => m.content)).toEqual([
      messages[0].content,
      'first',
      'answer',
      'now',
    ]);
  });

  it('keeps only the most recent turns, so old talk cannot crowd out the text', () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      role: 'user' as const,
      content: `turn ${i}`,
    }));
    const messages = reportPrompt(base, 'now', history);
    expect(messages).toHaveLength(MAX_HISTORY + 2);
    expect(messages[1].content).toBe('turn 24');
  });

  it('drops any system message from history — there is exactly one', () => {
    const history = [
      { role: 'system' as const, content: 'an old system prompt' },
      { role: 'user' as const, content: 'hello' },
    ];
    const messages = reportPrompt(base, 'now', history);
    expect(messages.filter((m) => m.role === 'system')).toHaveLength(1);
    expect(messages.map((m) => m.content)).not.toContain('an old system prompt');
  });
});

describe('questionPrompt', () => {
  it('is shaped like a report prompt', () => {
    const messages = questionPrompt(base, 'what does maya mean here?');
    expect(messages[0].role).toBe('system');
    expect(messages.at(-1)?.content).toBe('what does maya mean here?');
  });

  it('refuses an empty question', () => {
    expect(() => questionPrompt(base, '  ')).toThrow(PromptError);
  });

  it('tells the model to admit what the text does not answer', () => {
    expect(questionPrompt(base, 'q')[0].content).toMatch(/say so plainly/i);
  });
});

describe('the path the report belongs to', () => {
  // Without it a reflection on plan 40 is read as though it were the first
  // thing the player had ever said. The game is a path.

  const journey = [
    { plan: 6, text: 'the beginning felt abrupt' },
    { plan: 23, text: 'lighter here, and suspicious of it' },
    { plan: 41, text: 'the same impatience as at 6' },
  ];

  it('reaches the prompt, with each square named', () => {
    const prompt = systemPrompt({ plan: 50, language: 'en', journey });
    for (const entry of journey) {
      expect(prompt).toContain(entry.text);
      expect(prompt).toContain(planFor('en', entry.plan).title);
    }
  });

  it('is absent when there is no path, rather than an empty heading', () => {
    const prompt = systemPrompt({ plan: 6, language: 'en', journey: [] });
    expect(prompt).not.toMatch(/Where they have been/);
  });

  it('is absent when not given at all', () => {
    expect(systemPrompt({ plan: 6, language: 'en' })).not.toMatch(/Where they have been/);
  });

  it('tells the model not to read it back to the player', () => {
    const prompt = systemPrompt({ plan: 50, language: 'en', journey });
    expect(prompt).toMatch(/not yours to repeat back/i);
  });

  it('names the squares in the player’s language', () => {
    const prompt = systemPrompt({ plan: 50, language: 'ru', journey });
    expect(prompt).toContain(planFor('ru', 6).title);
  });
});

describe('the path never crowds out the plan text', () => {
  // The plan is what the answer must be faithful to. A long path that pushed
  // it out of the context window would leave the model nothing to rest on.

  const long = Array.from({ length: 60 }, (_, i) => ({
    plan: (i % 72) + 1,
    text: `report ${i} `.padEnd(600, 'x'),
  }));

  it('keeps the summary within its budget however long the path', () => {
    const summary = summariseJourney(long, 'en');
    expect(summary.length).toBeLessThan(MAX_JOURNEY_CHARS + 200);
  });

  it('keeps at most a handful of squares', () => {
    const lines = summariseJourney(long, 'en').split('\n').slice(1);
    expect(lines.length).toBeLessThanOrEqual(MAX_JOURNEY_ENTRIES);
  });

  it('clips a single long report rather than dropping the rest', () => {
    const summary = summariseJourney([{ plan: 6, text: 'x'.repeat(2000) }], 'en');
    expect(summary.length).toBeLessThan(MAX_JOURNEY_ENTRY_CHARS + 100);
    expect(summary).toContain('…');
  });

  it('keeps the plan text in the prompt even beside a long path', () => {
    const prompt = systemPrompt({ plan: 50, language: 'en', journey: long });
    const plan = planFor('en', 50);
    expect(prompt).toContain(plan.body.slice(0, 100));
  });

  it('says how much of the path it is showing when it shows only part', () => {
    expect(summariseJourney(long, 'en')).toMatch(/the last \d+ of 60 squares/);
  });

  it('shows the most recent squares, not the oldest', () => {
    const summary = summariseJourney(long, 'en');
    expect(summary).toContain('report 59');
    expect(summary).not.toContain('report 0 ');
  });

  it('flattens whitespace, so a multi-line report stays one line', () => {
    const summary = summariseJourney([{ plan: 6, text: 'one\n\ntwo\nthree' }], 'en');
    expect(summary.split('\n')).toHaveLength(2); // heading plus one entry
    expect(summary).toContain('one two three');
  });
});

describe('when the path does not fit its budget', () => {
  // Filling oldest-first meant the budget ran out before the newest squares,
  // so the entries a player just wrote were the ones dropped.

  const long = Array.from({ length: 20 }, (_, i) => ({
    plan: (i % 72) + 1,
    text: `entry ${i} `.padEnd(300, 'y'),
  }));

  it('drops the oldest entries, never the newest', () => {
    const summary = summariseJourney(long, 'en');
    expect(summary).toContain('entry 19');
    expect(summary).not.toContain('entry 12 ');
  });

  it('still lists what it keeps in walking order', () => {
    const summary = summariseJourney(long, 'en');
    const shown = [...summary.matchAll(/entry (\d+)/g)].map((m) => Number(m[1]));
    expect(shown).toEqual([...shown].sort((a, b) => a - b));
  });
});

describe('when the budget is too small for even one entry', () => {
  // Unreachable at the default budget: the longest possible entry runs to about
  // 175 characters against 1200. Reachable at a smaller one, and a heading with
  // nothing under it would be worse than saying nothing at all.

  it('says nothing rather than printing an empty heading', () => {
    const summary = summariseJourney([{ plan: 6, text: 'something' }], 'en', 5);
    expect(summary).toBe('');
  });

  it('still summarises what fits when the budget allows one entry', () => {
    const journey = [
      { plan: 6, text: 'first' },
      { plan: 23, text: 'second' },
    ];
    const summary = summariseJourney(journey, 'en', 60);
    expect(summary).toContain('second');
    expect(summary).not.toContain('first');
  });

  it('keeps the newest when only some fit, at any budget', () => {
    const journey = Array.from({ length: 6 }, (_, i) => ({ plan: i + 1, text: `entry ${i}` }));
    for (const budget of [40, 80, 200, 1200]) {
      const summary = summariseJourney(journey, 'en', budget);
      if (summary === '') continue;
      expect(summary, `budget ${budget}`).toContain('entry 5');
    }
  });
});
