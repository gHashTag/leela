/**
 * The book, as HTML.
 *
 * Pure functions from content to strings, so every page can be asserted
 * without a filesystem. The generator in `build.ts` does the writing.
 *
 * There is no Docusaurus here on purpose. It would want its own copy of the
 * 72 plans in each language — which is exactly the duplication that let 744
 * titles rot unnoticed across 15 languages before anyone looked.
 */

import {
  LANGUAGES,
  LANGUAGE_NAMES,
  directionOf,
  type Language,
  type Plan,
  type RuleChapter,
} from '@leela/content';

/** Escape for HTML text and attribute values. */
export function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Markdown, as far as the plan texts actually use it. */
export function renderMarkdown(source: string): string {
  const blocks = source.split(/\n{2,}/).filter((block) => block.trim().length > 0);

  return blocks
    .map((block) => {
      const trimmed = block.trim();

      const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        const level = Math.min(heading[1].length + 1, 6);
        return `<h${level}>${inline(heading[2])}</h${level}>`;
      }

      // A run of numbered or bulleted lines is a list.
      const lines = trimmed.split('\n');
      if (lines.every((line) => /^\s*(\d+[.)]|[-*])\s+/.test(line))) {
        const ordered = /^\s*\d/.test(lines[0]);
        const items = lines
          .map((line) => `<li>${inline(line.replace(/^\s*(\d+[.)]|[-*])\s+/, ''))}</li>`)
          .join('');
        return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
      }

      return `<p>${inline(trimmed.replace(/\n/g, ' '))}</p>`;
    })
    .join('\n');
}

/** Emphasis and links, escaped first so nothing in the source can inject. */
function inline(text: string): string {
  return escape(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

export interface PageOptions {
  title: string;
  language: Language;
  /** Path back to the site root, so pages work from any depth. */
  root: string;
  body: string;
  /** Shown under the title. */
  subtitle?: string;
}

/** One page, complete. */
export function page({ title, language, root, body, subtitle }: PageOptions): string {
  return `<!doctype html>
<html lang="${language}" dir="${directionOf(language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} — Leela</title>
<link rel="stylesheet" href="${root}style.css">
</head>
<body>
<header class="site">
  <a class="home" href="${root}${language}/">Leela</a>
  <a class="play" href="${PLAY_URL}">Play</a>
</header>
<main>
<h1>${escape(title)}</h1>
${subtitle ? `<p class="subtitle">${escape(subtitle)}</p>` : ''}
${body}
</main>
<footer>
${languagePicker(language, root)}
</footer>
</body>
</html>
`;
}

/**
 * Where the game itself lives.
 *
 * Absolute, because the book is served from a subdirectory of it and a
 * relative link out of the root page would leave the site entirely.
 */
export const PLAY_URL = 'https://t27.ai/leela/';

/**
 * Every language, linking to the same place in each.
 *
 * @param current  The language being read, shown as text rather than a link.
 *                 Pass null on a page that is not in any language — the root,
 *                 where every entry has to be reachable.
 */
export function languagePicker(current: Language | null, root: string, path = ''): string {
  const links = LANGUAGES.map((language) => {
    const name = escape(LANGUAGE_NAMES[language]);
    return language === current
      ? `<span class="current" lang="${language}">${name}</span>`
      : `<a lang="${language}" href="${root}${language}/${path}">${name}</a>`;
  }).join('\n');

  return `<nav class="languages" aria-label="Language">${links}</nav>`;
}

/** The contents page for one language. */
export function indexPage(language: Language, plans: Plan[], rules: RuleChapter[]): string {
  const ruleLinks = rules
    .map((chapter) => `<li><a href="rules/${chapter.slug}.html">${escape(chapter.title ?? chapter.slug)}</a></li>`)
    .join('\n');

  const planLinks = plans
    .map((plan) => `<li><a href="plans/${plan.plan}.html"><span class="n">${plan.plan}</span>${escape(plan.title)}</a></li>`)
    .join('\n');

  return page({
    title: 'Leela',
    language,
    root: '../',
    subtitle: 'The game of self-knowledge — 72 plans',
    body: [
      rules.length ? `<h2>The rules</h2>\n<ul class="chapters">\n${ruleLinks}\n</ul>` : '',
      `<h2>The 72 plans</h2>\n<ol class="plans">\n${planLinks}\n</ol>`,
      '<h2>Legal</h2>\n<ul class="chapters">\n<li><a href="legal/policy.html">Privacy policy</a></li>\n<li><a href="legal/eula.html">Terms of use</a></li>\n</ul>',
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

/**
 * True when the description just repeats the opening of the text.
 *
 * The Russian source puts the first paragraph in the frontmatter, so printing
 * both shows the same words twice before the reader gets anywhere.
 */
export function descriptionIsRedundant(plan: Plan): boolean {
  if (!plan.description) return true;

  const normalise = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();
  const description = normalise(plan.description);
  const opening = normalise(plan.body).slice(0, description.length);

  return opening === description;
}

/** One plan, with links to its neighbours so the book can be walked. */
export function planPage(language: Language, plan: Plan, total: number): string {
  const previous = plan.plan > 1 ? `<a rel="prev" href="${plan.plan - 1}.html">← ${plan.plan - 1}</a>` : '<span></span>';
  const next = plan.plan < total ? `<a rel="next" href="${plan.plan + 1}.html">${plan.plan + 1} →</a>` : '<span></span>';

  return page({
    title: `${plan.plan}. ${plan.title}`,
    language,
    root: '../../',
    body: [
      descriptionIsRedundant(plan) ? '' : `<p class="subtitle">${escape(plan.description!)}</p>`,
      renderMarkdown(plan.body),
      `<nav class="pager">${previous}<a href="../">Contents</a>${next}</nav>`,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

/** One rules chapter. */
export function chapterPage(language: Language, chapter: RuleChapter): string {
  return page({
    title: chapter.title ?? chapter.slug,
    language,
    root: '../../',
    body: `${renderMarkdown(chapter.body)}\n<nav class="pager"><span></span><a href="../">Contents</a><span></span></nav>`,
  });
}

/** A legal document, which is not game content and has its own source. */
export function legalPage(language: Language, title: string, body: string): string {
  return page({
    title,
    language,
    root: '../../',
    body: `${renderMarkdown(body)}\n<nav class="pager"><span></span><a href="../">Contents</a><span></span></nav>`,
  });
}

/** The root page, which only picks a language. */
export function rootPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Leela</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<main class="root">
<h1>Leela</h1>
<p class="subtitle">The game of self-knowledge — 72 plans, in ${LANGUAGES.length} languages</p>
${languagePicker(null, '', '')}
<p><a class="play" href="${PLAY_URL}">Play</a></p>
</main>
</body>
</html>
`;
}
