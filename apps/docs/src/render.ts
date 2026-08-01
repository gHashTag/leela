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
        const [, hashes = '', text = ''] = heading;
        const level = Math.min(hashes.length + 1, 6);
        return `<h${level}>${inline(text)}</h${level}>`;
      }

      // A run of numbered or bulleted lines is a list.
      const lines = trimmed.split('\n');
      if (lines.every((line) => /^\s*(\d+[.)]|[-*])\s+/.test(line))) {
        const ordered = /^\s*\d/.test(lines[0] ?? '');
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
  /**
   * The section of the book this page belongs to — its directory, its links,
   * its place in the picker.
   */
  language: Language;
  /**
   * The language the words on it are actually written in, where that differs.
   *
   * It differs on 40 of the 44 legal pages. Only English and Russian were ever
   * written, and every other language is served the English rather than a
   * missing privacy policy — which is a store rejection and, for a Telegram
   * mini app, a blocker. Serving it is right; *filing* it as Arabic is not.
   */
  writtenIn?: Language;
  /** Path back to the site root, so pages work from any depth. */
  root: string;
  /**
   * This page's path inside its language directory — `plans/41.html`, or `''`
   * for the contents. What `pathFor` returns for this page's own language.
   */
  path: string;
  /** What this page is about, in a sentence. See `summarise`. */
  description: string;
  body: string;
  /** Shown under the title. */
  subtitle?: string;
  /** Where this page lives in another language. See `languagePicker`. */
  pathFor?: (language: Language) => string | null;
}

/** One page, complete. */
export function page({
  title,
  language,
  writtenIn = language,
  root,
  path,
  description,
  body,
  subtitle,
  pathFor = () => '',
}: PageOptions): string {
  /**
   * The address of the text, which is this page's own on every page in the
   * book except the twenty untranslated legal ones. Those are the same English
   * document at twenty URLs, and saying so is the whole job of this tag.
   */
  const canonical = `${DOCS_URL}${writtenIn}/${path}`;

  return `<!doctype html>
<html lang="${writtenIn}" dir="${directionOf(writtenIn)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(titleOf(title))}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${canonical}">
${translations(writtenIn, path, pathFor)}
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escape(titleOf(title))}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${canonical}">
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
${languagePicker(language, root, pathFor)}
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
 * Where the book lives, derived from the game's address rather than repeated.
 *
 * Needed absolute for `canonical` and `hreflang`, which are the two things on a
 * page that cannot be relative — they name a page from outside the site.
 */
export const DOCS_URL = `${PLAY_URL}docs/`;

/** The name that goes after every title, and only after. */
export const SITE_NAME = 'Leela';

/**
 * The title as the tab and the search result show it.
 *
 * The suffix used to be appended unconditionally, so the contents page — whose
 * title *is* the site's name — read `Leela — Leela` in all 22 languages.
 */
export function titleOf(title: string): string {
  return title === SITE_NAME ? SITE_NAME : `${title} — ${SITE_NAME}`;
}

/**
 * The same page in every language that has it.
 *
 * The book knew this already and told only the reader: `pathFor` is the
 * function the footer picker is built from, and the head got nothing at all —
 * no `hreflang`, on a book whose entire reason for existing 22 times over is
 * that somebody wants to read *this* page in theirs.
 *
 * **A translation is declared only where the page is really there.** The picker
 * sends a reader looking for a chapter their language lacks to its contents
 * instead of to a 404, which is a kindness to a person and a lie to a crawler:
 * the German contents is not a translation of the Arabic `online` chapter. So
 * `pathFor` returns `null` for absent and `''` for the contents, two facts that
 * used to render identically and could not be told apart from here.
 *
 * `x-default` is the root page — the one page that is in no language and asks
 * which you want.
 */
export function translations(
  writtenIn: Language,
  path: string,
  pathFor: (language: Language) => string | null,
): string {
  const links = LANGUAGES.map((other) => (other === writtenIn ? path : pathFor(other)))
    .map((where, index) => ({ other: LANGUAGES[index] as Language, where }))
    .filter(({ where }) => where !== null)
    .map(
      ({ other, where }) =>
        `<link rel="alternate" hreflang="${other}" href="${DOCS_URL}${other}/${where}">`,
    );

  return [...links, `<link rel="alternate" hreflang="x-default" href="${DOCS_URL}">`].join('\n');
}

/**
 * A page's text, cut to something a search result or a link preview can show.
 *
 * The bot posts these links into Telegram, which builds its preview from the
 * Open Graph tags and nothing else — so a page with no description is a link
 * with a bare title under it.
 *
 * Markdown is stripped first: the plan bodies carry `**` and `#`, and a preview
 * showing punctuation the reader never typed looks broken rather than terse.
 *
 * Headings go entirely rather than losing their hashes. A heading is a label on
 * the text and not the text, and the page shows it as the `<h1>` already — kept,
 * the privacy policy's description opened *Privacy Policy This is the privacy
 * policy for…*, spending a quarter of the preview saying the title again.
 */
export function summarise(text: string, limit = 155): string {
  const prose = (source: string) =>
    source
      .replace(/^\s*(\d+[.)]|[-*])\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)\s]*\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

  // A document that is nothing but headings still needs a description, and its
  // headings are then the only text it has.
  const flat = prose(text.replace(/^\s*#{1,6}\s+.*$/gm, '')) || prose(text.replace(/#/g, ''));

  if (flat.length <= limit) return flat;

  // Chinese, Japanese and Thai put no spaces between words, so there is often
  // no boundary to find; a hard cut is the honest answer there rather than
  // walking back to the start of the line looking for one.
  const cut = flat.slice(0, limit);
  const space = cut.lastIndexOf(' ');

  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * Every language, linking to the same place in each.
 *
 * The `path` argument was written on the first day and never passed. Every
 * page's picker therefore pointed at the language's contents, so a reader on
 * plan 41 who switched to Russian landed on a list of 72 titles and had to find
 * it again — in a book whose whole reason for having 22 languages is that
 * somebody wants to read *this* plan in theirs.
 *
 * @param current  The language being read, shown as text rather than a link.
 *                 Pass null on a page that is not in any language — the root,
 *                 where every entry has to be reachable.
 * @param pathFor  Where this page lives in another language, relative to that
 *                 language's directory. Return `null` when that language does
 *                 not have this page — `ar`, `ms` and `uk` carry rules chapters
 *                 the others lack, and the others carry `chakras`, which they
 *                 do not — and the reader lands on its contents instead of on a
 *                 404. `''` means the contents itself, which every language has.
 *
 *                 The two used to be the same value, because from here they
 *                 render the same link. They are not the same fact, and
 *                 `translations` needs to tell them apart: sending a person to
 *                 the contents is help, telling a crawler that the contents is
 *                 a translation of a chapter is false.
 */
export function languagePicker(
  current: Language | null,
  root: string,
  pathFor: (language: Language) => string | null = () => '',
): string {
  const links = LANGUAGES.map((language) => {
    const name = escape(LANGUAGE_NAMES[language]);
    return language === current
      ? `<span class="current" lang="${language}">${name}</span>`
      : `<a lang="${language}" href="${root}${language}/${pathFor(language) ?? ''}">${name}</a>`;
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
    title: SITE_NAME,
    language,
    root: '../',
    // Every language has a contents page, so every language is a translation
    // of this one.
    path: '',
    pathFor: () => '',
    description: `The game of self-knowledge in ${LANGUAGE_NAMES[language]}: ${plans.length} plans and the rules, read as a book.`,
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
    path: `plans/${plan.plan}.html`,
    // Every language has all 72 plans — `audit-dataset` is what makes that
    // safe to say — so the same plan is always there to switch to.
    pathFor: () => `plans/${plan.plan}.html`,
    // The author's own summary where there is one, and the opening of the text
    // where there is not. `descriptionIsRedundant` governs whether it is
    // *shown*; repeating the opening is exactly what a preview is for.
    description: summarise(plan.description || plan.body),
    body: [
      descriptionIsRedundant(plan) ? '' : `<p class="subtitle">${escape(plan.description!)}</p>`,
      renderMarkdown(plan.body),
      `<nav class="pager">${previous}<a href="../">Contents</a>${next}</nav>`,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

/**
 * One rules chapter.
 *
 * @param hasChapter  Whether another language carries this chapter. The books
 *                    are not the same shape: `ar`, `ms` and `uk` carry `online`
 *                    and `foreword` from the published app's own list, and the
 *                    other nineteen carry `chakras`, which those three do not.
 *                    A switcher that assumed otherwise would send readers to a
 *                    page that is not there.
 */
export function chapterPage(
  language: Language,
  chapter: RuleChapter,
  hasChapter: (language: Language, slug: string) => boolean = () => false,
): string {
  return page({
    title: chapter.title ?? chapter.slug,
    language,
    root: '../../',
    path: `rules/${chapter.slug}.html`,
    pathFor: (other) => (hasChapter(other, chapter.slug) ? `rules/${chapter.slug}.html` : null),
    description: summarise(chapter.body),
    body: `${renderMarkdown(chapter.body)}\n<nav class="pager"><span></span><a href="../">Contents</a><span></span></nav>`,
  });
}

export interface LegalPageOptions {
  /** The section of the book the document is filed under. */
  language: Language;
  /** `policy` or `eula` — its file name, and how it is filed. */
  name: string;
  title: string;
  body: string;
  /**
   * The language the text is in.
   *
   * Not the section it is filed under, whenever it has no translation. Only
   * English and Russian were ever written and the other twenty languages are
   * served the English — deliberately, because a missing privacy policy is a
   * store rejection and, for a Telegram mini app, a blocker. But the page used
   * to *declare* the section's language: `/ar/legal/policy.html` announced
   * itself as Arabic and laid English out right to left. Forty pages said the
   * wrong thing; four of them looked it, and the rest only sounded it, to a
   * screen reader reaching for the wrong phonemes.
   */
  writtenIn: Language;
  /** Every language this document was really translated into. */
  translatedInto: Language[];
}

/**
 * A legal document, which is not game content and has its own source.
 *
 * The twenty untranslated copies are the same English page at twenty URLs, and
 * that is what `canonical` is for — `page` points it at the language the text
 * is in, which on every other page in the book is the page itself.
 */
export function legalPage({
  language,
  name,
  title,
  body,
  writtenIn,
  translatedInto,
}: LegalPageOptions): string {
  return page({
    title,
    language,
    writtenIn,
    root: '../../',
    path: `legal/${name}.html`,
    pathFor: (other) => (translatedInto.includes(other) ? `legal/${name}.html` : null),
    description: summarise(body),
    body: `${renderMarkdown(body)}\n<nav class="pager"><span></span><a href="../">Contents</a><span></span></nav>`,
  });
}

/** The root page, which only picks a language. */
export function rootPage(): string {
  const description = `The game of self-knowledge as a book: 72 plans and the rules, in ${LANGUAGES.length} languages.`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${SITE_NAME}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${DOCS_URL}">
${translations('en', '', () => '')}
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:type" content="website">
<meta property="og:title" content="${SITE_NAME}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${DOCS_URL}">
<link rel="stylesheet" href="style.css">
</head>
<body>
<main class="root">
<h1>Leela</h1>
<p class="subtitle">The game of self-knowledge — 72 plans, in ${LANGUAGES.length} languages</p>
${languagePicker(null, '')}
<p><a class="play" href="${PLAY_URL}">Play</a></p>
</main>
</body>
</html>
`;
}
