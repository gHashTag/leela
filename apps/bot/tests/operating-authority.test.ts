import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../../../', import.meta.url);
const policyFiles = ['AGENTS.md', 'CLAUDE.md', '.specify/memory/constitution.md'] as const;

const required = [
  'Direct pushes to `main` are forbidden.',
  'A requested repository change implies',
  'open a PR to `main`',
  'wait for every configured check',
  'Force-pushing shared or protected branches is forbidden.',
  'A request about an existing live surface authorizes deployment',
  'platform control bots such as `@BotFather`',
  'Creating infrastructure, changing',
  'prices, charging money, or messaging users or public channels is not implied.',
  'When the owner supplies a newly rotated secret',
] as const;

function policyProblems(documents: Readonly<Record<string, string>>): string[] {
  const problems: string[] = [];
  for (const [name, text] of Object.entries(documents)) {
    for (const sentence of required) {
      if (!text.includes(sentence)) problems.push(`${name}: missing ${sentence}`);
    }
    if (
      /Push to `unified` only|No deploying, publishing|Never touch the keystore|A secret pasted into chat is compromised/.test(
        text,
      )
    ) {
      problems.push(`${name}: still carries the retracted absolute prohibition`);
    }
  }
  return problems;
}

describe('the authority every coding agent reads', () => {
  it('agrees on autonomous PR integration and scoped live operations', () => {
    const documents = Object.fromEntries(
      policyFiles.map((name) => [name, readFileSync(new URL(name, ROOT), 'utf8')]),
    );
    expect(policyProblems(documents)).toEqual([]);
  });

  it('rejects the stale rule that blocked an owner-authorized repair', () => {
    expect(
      policyProblems({
        'stale.md':
          '- Push to `unified` only. Never `main`. A secret pasted into chat is compromised.',
      }),
    ).not.toEqual([]);
  });
});
