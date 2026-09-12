/** Public, packaged editorial assets. No journal, environment secret or remote URL reader. */
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOTAL_PLANS } from '@leela/engine';

export interface EditorialDay {
  day: number;
  title: string;
  plan: number | null;
  /** Explicit public-text dependencies, never a request for model tool access. */
  relatedPlans: number[];
  content: string;
}

export interface EditorialKit {
  soul: string;
  days: EditorialDay[];
  skills: Array<{ name: string; content: string }>;
}

const DEFAULT_ROOT = fileURLToPath(new URL('../editorial/', import.meta.url));

export function loadEditorialKit(root = DEFAULT_ROOT): EditorialKit {
  const directory = realpathSync(root);
  let bytes = 0;
  function text(path: string, max = 48_000): string {
    const actual = realpathSync(path);
    const inside = relative(directory, actual);
    if (isAbsolute(inside) || inside === '..' || inside.startsWith('../')) throw new Error('kit path outside root');
    const stat = statSync(actual);
    bytes += stat.size;
    if (!stat.isFile() || stat.size > max || bytes > 200_000) throw new Error('kit size limit');
    const value = readFileSync(actual, 'utf8').replace(/\r\n/g, '\n').trim();
    if (!value || value.includes('\u0000')) throw new Error('empty or invalid kit file');
    return value;
  }
  const soul = text(join(directory, 'SOUL.md'));
  const plan = text(join(directory, 'CONTENT_PLAN.md'), 100_000);
  const headings = [...plan.matchAll(/^## День\s+([1-9]\d?)(?=\s|$)[^\n]*$/gm)];
  if (headings.length !== 30) throw new Error('kit needs exactly 30 day sections');
  const days = headings.map((heading, index): EditorialDay => {
    const day = Number(heading[1]);
    if (day !== index + 1) throw new Error('kit days must be unique and ordered 1..30');
    const content = plan.slice(heading.index, headings[index + 1]?.index ?? plan.length).trim();
    const references = [...content.matchAll(/^plan:\s*(none|[1-9]\d*)\s*$/gm)];
    const lines = content.match(/^plan:.*$/gm);
    if (references.length !== 1 || lines?.length !== 1 || content.length > 8000) {
      throw new Error('kit day needs exactly one valid plan reference');
    }
    const reference = references[0]?.[1];
    if (reference === undefined) throw new Error('missing plan reference');
    const square = reference === 'none' ? null : Number(reference);
    if (square !== null && (!Number.isInteger(square) || square > TOTAL_PLANS)) {
      throw new Error('kit plan reference outside canon');
    }
    const relatedLines = content.match(/^[ \t]*related_plans\b[^\n]*$/gim) ?? [];
    if (relatedLines.length > 1) throw new Error('duplicate related plan declaration');
    const relatedPlans: number[] = [];
    if (relatedLines.length === 1) {
      const related = /^related_plans:[ \t]*([1-9]\d*(?:[ \t]*,[ \t]*[1-9]\d*)?)[ \t]*$/.exec(relatedLines[0] ?? '');
      if (square === null || !related?.[1]) throw new Error('kit needs a primary plan and at most two related plans');
      relatedPlans.push(...related[1].split(',').map((value) => Number(value.trim())));
      if (new Set(relatedPlans).size !== relatedPlans.length ||
        relatedPlans.some((value) => !Number.isInteger(value) || value > TOTAL_PLANS || value === square)) {
        throw new Error('related plans must be unique public canon references');
      }
    }
    const headingTitle = heading[0].replace(/^##\s*/, '');
    const theme = /^\*\*Тема:\*\*\s*(.+?)(?=\s+\*\*Цель:|\n|$)/m.exec(content)?.[1]?.trim();
    const title = theme && headingTitle === `День ${day}` ? `${headingTitle} — ${theme}` : headingTitle;
    if (title.length > 150) throw new Error('kit day title too long');
    return { day, title, plan: square, relatedPlans, content };
  });
  const skillRoot = join(directory, 'skills');
  const names = readdirSync(skillRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((e) => e.name).sort();
  if (names.length === 0 || names.length > 12) throw new Error('kit needs 1..12 skills');
  const skills = names.map((name) => ({ name, content: text(join(skillRoot, name, 'SKILL.md'), 24_000) }));
  return { soul, days, skills };
}
