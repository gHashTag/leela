import { describe, expect, it } from 'vitest';
import { messageFor, planFor } from '@leela/content';
import {
  Guide,
  PromptError,
  engagementFallbackText,
  engagementPrompt,
  fixedModel,
  type LanguageModel,
} from '../src';

const context = {
  language: 'en' as const,
  plan: 12,
  intention: 'notice where I avoid a choice',
  journey: [
    { plan: 6, text: 'I entered' },
    { plan: 9, text: 'I stopped' },
  ],
};

describe('the proactive plan bridge', () => {
  it('rests on the exact plan, intention and walked path', () => {
    const messages = engagementPrompt(context, true);
    const system = messages[0]?.content ?? '';
    const instruction = messages[1]?.content ?? '';

    expect(system).toContain(planFor('en', 12).title);
    expect(system).toContain(planFor('en', 12).body.slice(0, 120));
    expect(system).toContain(context.intention);
    expect(system.indexOf('6.')).toBeLessThan(system.indexOf('9.'));
    expect(instruction).toContain('exactly one gentle, concrete reflection question');
    expect(instruction).toContain('Do not mention absence');
    expect(instruction).toContain('Do not add facts or teaching');
  });

  it('changes shape with the next valid game action', () => {
    const report = engagementPrompt(context, true).at(-1)?.content ?? '';
    const roll = engagementPrompt(context, false).at(-1)?.content ?? '';

    expect(report).toContain('question');
    expect(report).toContain('rolling');
    expect(roll).toContain('Ask no question');
    expect(roll).toContain('roll');
  });

  it('refuses every plan outside the board', () => {
    for (const plan of [-1, 0, 73, 99, 12.5]) {
      expect(() => engagementPrompt({ ...context, plan }, true)).toThrow(PromptError);
    }
  });

  it('returns a model bridge when the companion answers', async () => {
    const guide = new Guide({ model: fixedModel('Notice what remains still. What asks to move?') });

    await expect(guide.engage({ ...context, reportOwed: true })).resolves.toEqual({
      text: 'Notice what remains still. What asks to move?',
      fromModel: true,
    });
  });

  it('falls back to the useful next action without announcing an outage', async () => {
    const broken: LanguageModel = {
      id: 'broken',
      async complete() {
        throw new Error('offline');
      },
    };
    const guide = new Guide({ model: broken, log: () => undefined });
    const options = { ...context, reportOwed: true };

    await expect(guide.engage(options)).resolves.toEqual({
      text: engagementFallbackText(options),
      fromModel: false,
    });
    expect(engagementFallbackText(options)).toBe(messageFor('en', 'nudge.agentReport'));
    expect(engagementFallbackText(options)).not.toContain('unavailable');
  });
});
