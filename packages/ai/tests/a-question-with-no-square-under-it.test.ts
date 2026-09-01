/**
 * A question asked before the game — no table, no square, no journey.
 *
 * The bot dead-ended these words in *No table here yet* — a refusal, read by
 * somebody who had just asked the companion a question. `aboutPrompt` and
 * `Guide.about` are the answer: the same voice and the same failure machinery
 * as the plan prompts, resting on the one thing that exists before a game
 * does — the rules of the board.
 *
 * The rules arrive from the caller, and that is the decision most of this file
 * defends: `@leela/engine` holds the board, whoever holds the engine renders
 * it, and a copy written into this package would be the restated list this
 * repository has met six times. What the package owes in exchange is what it
 * owes for every input a caller holds — a bound — and the flood tests below
 * mirror `nothing-a-caller-holds.test.ts` for the three inputs `about` takes.
 */

import { describe, expect, it } from 'vitest';
import { messageFor } from '@leela/content';
import {
  Guide,
  MAX_HISTORY,
  MAX_HISTORY_CHARS,
  MAX_REPORT_CHARS,
  MAX_RULES_CHARS,
  ModelError,
  PromptError,
  aboutFallbackText,
  aboutPrompt,
  fixedModel,
  recordingModel,
  type LanguageModel,
  type Message,
} from '../src';

/** A board small enough to read whole in a failure message. */
const RULES =
  'The board has 72 plans. A six enters the game on plan 6. ' +
  'Arrows lift: 10->23. Snakes drop: 12->8. Reaching plan 68 completes the game.';

const HERE = { language: 'en' as const, rules: RULES };

/** A guide whose log is captured rather than printed. */
function guideWith(model: LanguageModel) {
  const logged: string[] = [];
  const guide = new Guide({ model, log: (message) => logged.push(message) });
  return { guide, logged };
}

describe('the shape of the prompt', () => {
  it('is a system instruction, then the question, in the caller’s order', () => {
    const messages = aboutPrompt(HERE, 'how do I start?');

    expect(messages[0]?.role).toBe('system');
    expect(messages.at(-1)?.role).toBe('user');
    expect(messages.at(-1)?.content).toBe('how do I start?');
  });

  it('rests the answer on the rules the caller rendered', () => {
    const system = aboutPrompt(HERE, 'where do the snakes go?')[0]?.content ?? '';

    expect(system).toContain(RULES);
    expect(system, 'and says they are the source').toContain('They are the source; you are not.');
  });

  it('tells the model to offer /new, so the code never has to append it', () => {
    // The instruction lives in the prompt on purpose: appended by code it
    // would be a footer under every answer, including the ones where it reads
    // as a refusal to engage.
    const system = aboutPrompt(HERE, 'can we play?')[0]?.content ?? '';
    expect(system).toContain('/new opens a table');
  });

  it('claims no square, because there is none to claim', () => {
    // The plan prompts say *The player is on plan N*; this one must not — a
    // model told a square exists will answer about it.
    const system = aboutPrompt(HERE, 'what is this game?')[0]?.content ?? '';
    expect(system).not.toMatch(/The player is on plan/);
    expect(system).toContain('standing on no plan');
  });

  it('names the language to answer in, as an instruction and not an implication', () => {
    expect(aboutPrompt({ ...HERE, language: 'ru' }, 'как играть?')[0]?.content).toContain(
      'Answer in Russian.',
    );
    expect(aboutPrompt(HERE, 'how to play?')[0]?.content).toContain('Answer in English.');
  });

  it('speaks with the same voice as the plan prompts', () => {
    // `HOW_TO_SPEAK` is one constant shared by both system prompts, so the
    // assertion is on a sentence only it carries: tuning the voice must reach
    // a question asked off the board too.
    const system = aboutPrompt(HERE, 'what should I do?')[0]?.content ?? '';
    expect(system).toContain('Be brief');
    expect(system).toContain('You are not a');
  });

  it('carries the conversation so far, between the system and the question', () => {
    const history: Message[] = [
      { role: 'user', content: 'what is a plan?' },
      { role: 'assistant', content: 'a square on the board, and a state to sit with' },
    ];
    const messages = aboutPrompt(HERE, 'and how many are there?', history);

    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(messages[2]?.content).toContain('a square on the board');
  });

  it('refuses an empty question as a caller bug, not a model failure', () => {
    expect(() => aboutPrompt(HERE, '   ')).toThrow(PromptError);
  });

  it('refuses empty rules, because an answer resting on nothing is invention', () => {
    // The whole package exists so the model never supplies the teaching. With
    // no rules the answer could only come from what the model remembers about
    // Leela — the exact defect the plan prompts were written against.
    expect(() => aboutPrompt({ ...HERE, rules: '  ' }, 'how do I start?')).toThrow(PromptError);
  });
});

describe('an input a caller holds is an input this package clips', () => {
  // The property `nothing-a-caller-holds.test.ts` states for the plan
  // prompts, asked of the about prompt's own three inputs. The ceiling is the
  // package's own constants, not a measurement.
  const FLOOD = 40_000;
  const long = (count: number) => 'слово '.repeat(Math.ceil(count / 6)).slice(0, count);

  const FRAMING = 2_000;
  const CEILING =
    MAX_RULES_CHARS + MAX_REPORT_CHARS + MAX_HISTORY * MAX_HISTORY_CHARS + FRAMING;

  const sizeOf = (messages: ReadonlyArray<Message>) =>
    messages.reduce((total, message) => total + message.content.length, 0);

  const INPUTS: Array<readonly [string, (flood: string) => Message[]]> = [
    ['the rules', (flood) => aboutPrompt({ ...HERE, rules: flood }, 'a question')],
    ['the question', (flood) => aboutPrompt(HERE, flood)],
    [
      'the history',
      (flood) =>
        aboutPrompt(HERE, 'a question', [
          { role: 'user', content: flood },
          { role: 'assistant', content: flood },
        ]),
    ],
  ];

  it('does not let any of them grow the prompt without a bound', () => {
    const unbounded: string[] = [];

    for (const [what, build] of INPUTS) {
      const size = sizeOf(build(long(FLOOD)));
      if (size > CEILING) unbounded.push(`${what}: ${size} characters, past ${CEILING}`);
    }

    expect(unbounded).toEqual([]);
  });

  it('carries each of them when it is short, so this is not a check on nothing', () => {
    const mark = 'a phrase that appears nowhere else in any prompt';

    expect(aboutPrompt({ ...HERE, rules: `The rule: ${mark}.` }, 'q')[0]?.content).toContain(mark);
    expect(aboutPrompt(HERE, mark).some((one) => one.content.includes(mark))).toBe(true);
    expect(
      aboutPrompt(HERE, 'q', [{ role: 'user', content: mark }]).some((one) =>
        one.content.includes(mark),
      ),
    ).toBe(true);
  });

  it('states its ceiling from the package’s own numbers', () => {
    expect(CEILING).toBeLessThan(FLOOD / 2);
    expect(MAX_RULES_CHARS, 'a bound exists for the rules at all').toBeGreaterThan(0);
  });
});

describe('the guide, off the board', () => {
  it('returns what the model said', async () => {
    const { guide } = guideWith(fixedModel('  a six is what enters  '));
    const reflection = await guide.about('how do I get on the board?', HERE);

    expect(reflection.text).toBe('a six is what enters');
    expect(reflection.fromModel).toBe(true);
  });

  it('hands the model the rules and the question, nothing invented between', async () => {
    const model = recordingModel();
    const { guide } = guideWith(model);
    await guide.about('where do the snakes go?', HERE);

    const [call] = model.calls;
    expect(call.messages[0]?.role).toBe('system');
    expect(call.messages[0]?.content).toContain(RULES);
    expect(call.messages.at(-1)?.content).toBe('where do the snakes go?');
  });

  it('carries the history a caller passes, as reflect and answer do', async () => {
    const model = recordingModel();
    const { guide } = guideWith(model);
    await guide.about('and after that?', {
      ...HERE,
      history: [
        { role: 'user', content: 'what begins the game?' },
        { role: 'assistant', content: 'a six begins it' },
      ],
    });

    expect(model.calls[0]?.messages.map((m) => m.content).join('\n')).toContain('a six begins it');
  });

  it('rethrows an empty question rather than papering over the caller', async () => {
    const { guide } = guideWith(fixedModel('x'));
    await expect(guide.about('   ', HERE)).rejects.toThrow(PromptError);
  });

  it('falls back to a sentence with no plan in it, because there is no plan', async () => {
    // `fallbackText` names the square to sit with in the meantime; a player
    // with no table has none, so the fallback is the catalogue's own sentence
    // for a companion that is not answering — reused, not a new key.
    const { guide } = guideWith(fixedModel('   '));
    const reflection = await guide.about('how do I start?', HERE);

    expect(reflection.fromModel).toBe(false);
    expect(reflection.text).toBe(aboutFallbackText('en'));
    expect(reflection.text).toBe(messageFor('en', 'ask.silent'));
  });

  it('falls back in the player’s language, like every other outage sentence', async () => {
    const broken: LanguageModel = {
      id: 'broken',
      async complete() {
        throw new ModelError('refused (500)', 500);
      },
    };
    const { guide } = guideWith(broken);
    const reflection = await guide.about('как начать?', { ...HERE, language: 'ru' });

    expect(reflection.fromModel).toBe(false);
    expect(reflection.text).toBe(aboutFallbackText('ru'));
    expect(reflection.text).toMatch(/[а-яё]/i);
  });

  it('is behind the same silence as the plan prompts, not a way around it', async () => {
    // A 402 silences the companion as a whole. A route that kept calling
    // around the cool-down would spend exactly the round trips it exists to
    // save — so `about` must skip, and skip without touching the model.
    let calls = 0;
    const refusing: LanguageModel = {
      id: 'refusing',
      async complete() {
        calls += 1;
        throw new ModelError('no balance (402)', 402);
      },
    };
    let time = 1_000;
    const guide = new Guide({ model: refusing, log: () => undefined, now: () => time });

    const first = await guide.about('how do I start?', HERE);
    expect(first.fromModel).toBe(false);

    const second = await guide.about('and now?', HERE);
    expect(second.fromModel).toBe(false);
    expect(second.text).toBe(aboutFallbackText('en'));
    expect(calls, 'the silence was honoured, not re-proved').toBe(1);
    expect(guide.status().available).toBe(false);

    // And the way back is the same too: the cool-down passes, the next
    // question is tried rather than skipped.
    time += 31 * 60_000;
    await guide.about('is anyone there?', HERE);
    expect(calls).toBe(2);
  });

  it('shares that silence with reflect, because the balance is one balance', async () => {
    const refusing: LanguageModel = {
      id: 'refusing',
      async complete() {
        throw new ModelError('no balance (402)', 402);
      },
    };
    const guide = new Guide({ model: refusing, log: () => undefined, now: () => 1_000 });

    await guide.reflect('a report', { language: 'en', plan: 6 });
    expect(guide.status().available, 'silenced by the report').toBe(false);

    const skipped = guide.status().skipped;
    await guide.about('how do I start?', HERE);
    expect(guide.status().skipped, 'about skipped rather than called').toBe(skipped + 1);
  });
});
