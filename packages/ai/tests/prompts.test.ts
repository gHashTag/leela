import { describe, expect, it } from 'vitest';
import type { Direction } from '@leela/engine';
import { LANGUAGES, planFor } from '@leela/content';
import { TOTAL_PLANS, WIN_LOKA } from '@leela/engine';
import { MAX_REPORT_CHARS } from '@leela/journal';
import {
  MAX_HISTORY,
  MAX_HISTORY_CHARS,
  MAX_INTENTION_CHARS,
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

describe('how the player arrived', () => {
  /**
   * `Guide` has accepted a direction since it was written, and the bot never
   * passed one — so these five sentences went into the prompt exactly never.
   * Three of them did not agree with the "They" they follow: *"They was brought
   * down here by a snake."* Nobody had read them, because there was nothing to
   * read: code that never runs is code nobody has read.
   */

  const DIRECTIONS: Direction[] = ['step 🚶🏼', 'snake 🐍', 'arrow 🏹', 'stop 🛑', 'win 🕉'];

  const arrivalLine = (direction: Direction) =>
    systemPrompt({ language: 'en', plan: 8, direction })
      .split('\n')
      .find((line) => line.startsWith('They ')) ?? '';

  it('says something about every direction the engine can produce', () => {
    // A direction with no sentence is a silent gap: the model is simply not
    // told, and nothing anywhere says so.
    for (const direction of DIRECTIONS) {
      expect(arrivalLine(direction), direction).not.toBe('');
    }
  });

  it('agrees with the pronoun it follows, in every direction', () => {
    // The rule rather than the three that were wrong: a singular verb after
    // "They" is the mistake, whichever sentence makes it.
    for (const direction of DIRECTIONS) {
      expect(arrivalLine(direction), direction).not.toMatch(/^They (was|has|is|does|goes)\b/);
    }
  });

  it('is a whole sentence, ending where a sentence ends', () => {
    for (const direction of DIRECTIONS) {
      expect(arrivalLine(direction).endsWith('.'), direction).toBe(true);
    }
  });

  it('says nothing at all when the arrival is unknown', () => {
    // The bot cannot always find the seat, and a companion that fell silent
    // over a missing detail would be worse than one that says less.
    const prompt = systemPrompt({ language: 'en', plan: 8 });
    expect(prompt.split('\n').some((line) => line.startsWith('They '))).toBe(false);
    expect(prompt).toContain('plan 8');
  });

  it('does not repeat the square as somewhere they came from', () => {
    // Standing on 8 having come from 8 is a jump home, and "They came from
    // plan 8" while on plan 8 reads as a mistake to anyone, model included.
    const prompt = systemPrompt({ language: 'en', plan: 8, previousPlan: 8 });
    expect(prompt).not.toContain('came from plan 8');
  });
});

describe('a prompt this package builds is a prompt this package bounds', () => {
  /**
   * Every part of the prompt is clipped by this package — the plan's text, each
   * journey line, the intention — except the one it was handed. The history was
   * clipped by *count*, so six messages of any length went in whole, and the
   * carefully bounded prompt was bounded by whatever the caller was holding.
   *
   * It fails quietly, which is what makes it worth a test rather than a note. A
   * request refused for length comes back as the fallback sentence, so a
   * companion that had stopped answering its longest conversations would look,
   * from inside the game, exactly like one having a bad day.
   *
   * Stated as a ceiling on the whole thing rather than on the piece that was
   * missing a bound: a seventh part added tomorrow has to fit in it too.
   */
  const enormous = (n: number) => 'x'.repeat(n);

  const worstCase = () => ({
    plan: 23,
    language: 'ur' as const,
    intention: enormous(MAX_INTENTION_CHARS * 3),
    direction: 'snake 🐍' as const,
    previousPlan: 44,
    journey: Array.from({ length: MAX_JOURNEY_ENTRIES * 4 }, (_, index) => ({
      plan: (index % TOTAL_PLANS) + 1,
      text: enormous(4000),
    })),
  });

  const history = Array.from({ length: MAX_HISTORY * 3 }, (_, index) => ({
    role: (index % 2 ? 'assistant' : 'user') as 'assistant' | 'user',
    content: enormous(9000),
  }));

  const sizeOf = (messages: Array<{ content: string }>) =>
    messages.reduce((total, message) => total + message.content.length, 0);

  /**
   * What everything the package decides comes to, plus what it carries.
   *
   * Derived from the constants rather than written down, so raising one of them
   * moves this and a new part has to declare itself.
   */
  const CEILING = 6_400 + MAX_REPORT_CHARS + MAX_HISTORY * MAX_HISTORY_CHARS;

  it('never builds one past its own ceiling, in any language, on any square', () => {
    for (const language of LANGUAGES) {
      for (let plan = 1; plan <= TOTAL_PLANS; plan += 1) {
        const context = { ...worstCase(), plan, language };

        expect(
          sizeOf(reportPrompt(context, enormous(MAX_REPORT_CHARS), history)),
          `${language}/${plan}`,
        ).toBeLessThanOrEqual(CEILING);
        expect(
          sizeOf(questionPrompt(context, enormous(MAX_REPORT_CHARS), history)),
          `${language}/${plan}`,
        ).toBeLessThanOrEqual(CEILING);
      }
    }
  });

  it('is bounded in bytes as well, which is what a context window counts', () => {
    /**
     * A character is not a character. The same prompt, with the player writing
     * in their own script, is about seventeen thousand characters in every one
     * of the twenty-two languages — and 17,262 bytes in English against 47,615
     * in Japanese. Tamil, Telugu, Bengali and Marathi sit near 2.5; Russian,
     * Ukrainian, Arabic and Urdu near 1.8; the Latin languages at 1.0.
     *
     * Every constant in `prompts.ts` is justified against English — *the
     * longest plan runs past 6000 characters* — so the ceiling the pass before
     * put on this file is an English ceiling, and it buys a third as much
     * context in Japanese as it looks like it does.
     *
     * Nothing is clipped differently for it. A denser script carries more of
     * the plan in the same characters, which is the other half of the trade,
     * and the clip does not even reach the Japanese and Chinese texts: their
     * plans are shorter than `MAX_PLAN_CHARS` to begin with. What is asserted
     * is that the cost cannot grow silently — a script needing four bytes a
     * character, or a bound raised without anyone weighing it, fails here.
     */
    const BYTES_PER_CHARACTER = 3;
    const weigh = (messages: Array<{ content: string }>) =>
      messages.reduce((total, message) => total + new TextEncoder().encode(message.content).length, 0);

    for (const language of LANGUAGES) {
      // Written in the language's own script, since that is what a player of it
      // writes — measuring with ASCII padding hides the whole effect.
      const own = planFor(language, 40).body.repeat(20);
      const said = (length: number) => own.slice(0, length);

      const messages = reportPrompt(
        {
          ...worstCase(),
          language,
          intention: said(MAX_INTENTION_CHARS),
          journey: Array.from({ length: MAX_JOURNEY_ENTRIES * 2 }, (_, index) => ({
            plan: (index % TOTAL_PLANS) + 1,
            text: said(400),
          })),
        },
        said(MAX_REPORT_CHARS),
        Array.from({ length: MAX_HISTORY }, (_, index) => ({
          role: (index % 2 ? 'assistant' : 'user') as 'assistant' | 'user',
          content: said(MAX_HISTORY_CHARS),
        })),
      );

      expect(weigh(messages), language).toBeLessThanOrEqual(CEILING * BYTES_PER_CHARACTER);
    }
  });

  it('clips a long exchange rather than dropping it', () => {
    // The other half: a bound that discarded the message would lose the thread
    // the history exists to keep.
    const [, first] = reportPrompt(worstCase(), 'a report', [
      { role: 'user', content: `The question begins here. ${enormous(9000)}` },
    ]);

    expect(first?.content.length).toBeLessThanOrEqual(MAX_HISTORY_CHARS);
    expect(first?.content, 'and it is the beginning that is kept').toContain('question begins');
  });

  it('leaves a short exchange exactly as it was', () => {
    const said = 'What is this square asking of me?';
    const [, first] = reportPrompt(worstCase(), 'a report', [{ role: 'user', content: said }]);

    expect(first?.content).toBe(said);
  });
});
