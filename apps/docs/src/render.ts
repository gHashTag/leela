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
  messageFor,
  type Language,
  type Plan,
  type RuleChapter,
  headingOf,
  piecesOf,
} from '@leela/content';

/** Escape for HTML text and attribute values. */
export function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Markdown, as far as the plan texts actually use it.
 *
 * **A list separated by blank lines is one list.** The plan texts write their
 * enumerations that way — plan 6's four kleshas, plan 58's states of
 * consciousness, plan 64's material contents — one numbered line, a blank line,
 * the next. Each block was rendered on its own, so the page carried four lists
 * of one item each and no `start`, and a browser numbers those **1. 1. 1. 1.**
 * Eighty-four of the hundred and seven pages with a list in them said that,
 * including a rules chapter with eleven items every one of which was item one.
 *
 * Nothing was missing: every word was on the page. Only the numbering, which is
 * the whole of what an enumeration says. CommonMark calls blank-line separated
 * items one loose list, and the game shows them as the text writes them — so
 * both the standard and the other surface were already agreed, and this was the
 * only reader that was not.
 */
export function renderMarkdown(source: string): string {
  // The format cuts the text and this draws it. A heading is a line rather
  // than a paragraph — seventeen Russian blocks write one with its prose on the
  // next line down, and this page carried four hash marks and no headings at
  // all until `piecesOf` said where to cut. The other two surfaces ask the same
  // question of the same function.
  const blocks = piecesOf(source).map((piece) =>
    piece.heading ? `${'#'.repeat(piece.heading.level)} ${piece.text}` : piece.text,
  );

  return joinLists(
    blocks
    .map((block) => {
      const trimmed = block.trim();

      // The format's answer, not a second copy of it. Two other surfaces read
      // the same texts and each had decided this for itself; both showed the
      // hashes to a reader. See `headingOf`.
      const heading = headingOf(trimmed);
      if (heading) {
        // One deeper than the source says, so the page's own title stays the
        // first heading on it. That part is this surface's, and stays here.
        const level = Math.min(heading.level + 1, 6);
        return `<h${level}>${inline(heading.text)}</h${level}>`;
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
    }),
  ).join('\n');
}

/**
 * Runs of lists of the same kind, folded into one.
 *
 * On the rendered blocks rather than on the source, because *is this a list*
 * has already been decided once above and deciding it twice is how the two
 * answers come to differ.
 */
function joinLists(blocks: string[]): string[] {
  const folded: string[] = [];

  for (const block of blocks) {
    const previous = folded.at(-1);
    const tag = block.startsWith('<ol>') ? 'ol' : block.startsWith('<ul>') ? 'ul' : null;

    if (tag && previous?.startsWith(`<${tag}>`) && previous.endsWith(`</${tag}>`)) {
      folded[folded.length - 1] =
        `${previous.slice(0, -`</${tag}>`.length)}${block.slice(`<${tag}>`.length)}`;
      continue;
    }

    folded.push(block);
  }

  return folded;
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
  /**
   * Where this page exists **as a translation** in another language.
   *
   * This is the answer `hreflang` needs, and it is a claim about the text: an
   * alternate that is not a translation tells a crawler something false.
   */
  pathFor?: (language: Language) => string | null;
  /**
   * Where a reader who switches language lands. Defaults to `pathFor`.
   *
   * The two were one callback, and `languagePicker` had already written down
   * that they are not one fact — *sending a person to the contents is help,
   * telling a crawler that the contents is a translation of a chapter is
   * false*. For a chapter a language does not carry they agree, because there
   * is nothing to send anyone to. For the legal pages they do not: every
   * language is served `legal/policy.html`, in English where nobody translated
   * it, and 840 picker links sent a reader on the privacy policy back to the
   * front of the book in the language they chose — a page that was there,
   * refused because it was not a translation.
   */
  servedAt?: (language: Language) => string | null;
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
  servedAt,
}: PageOptions): string {
  /**
   * The address of the text, which is this page's own on every page in the
   * book except the twenty untranslated legal ones. Those are the same English
   * document at twenty URLs, and saying so is the whole job of this tag.
   */
  const canonical = `${DOCS_URL}${writtenIn}/${path}`;

  /**
   * Ask a caller's callback, and say which page was being built if it will not
   * answer.
   *
   * A generator writes 1,784 files. Stopping is right — a page whose picker
   * cannot be answered must not go out with the picker wrong — but stopping
   * with only the callback's own words leaves whoever runs the build knowing
   * that something could not say where a page lives, and not which page, in
   * which language, or which of the two questions it was.
   *
   * Found by `audit-promises`, whose second question is the one every defect of
   * this family failed: something breaks the dependency, and nobody checks what
   * the person on the other end is told.
   */
  const asking = <T>(what: string, ask: () => T): T => {
    try {
      return ask();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`${language}/${path}: ${what} would not say where this page is — ${reason}`);
    }
  };

  const translated = (other: Language) => asking('pathFor', () => pathFor(other));
  const served = (other: Language) => asking('servedAt', () => (servedAt ?? pathFor)(other));

  return `<!doctype html>
<html lang="${writtenIn}" dir="${directionOf(writtenIn)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(titleOf(title))}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${canonical}">
${translations(writtenIn, path, translated)}
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escape(titleOf(title))}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${canonical}">
<link rel="stylesheet" href="${root}style.css">
</head>
<body>
<header class="site">
  <a class="home" href="${root}${language}/">${SITE_NAME}</a>
  <a class="play" href="${PLAY_URL}">${escape(messageFor(writtenIn, 'app.play'))}</a>
</header>
<main>
<h1>${escape(title)}</h1>
${subtitle ? `<p class="subtitle">${escape(subtitle)}</p>` : ''}
${body}
</main>
<footer>
${languagePicker(language, root, served, writtenIn)}
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
  /** The language the page is written in, for the picker's own name. */
  named: Language = current ?? 'en',
): string {
  const links = LANGUAGES.map((language) => {
    const name = escape(LANGUAGE_NAMES[language]);
    return language === current
      ? `<span class="current" lang="${language}">${name}</span>`
      : `<a lang="${language}" href="${root}${language}/${pathFor(language) ?? ''}">${name}</a>`;
  }).join('\n');

  return `<nav class="languages" aria-label="${escape(messageFor(named, 'app.language'))}">${links}</nav>`;
}

/** The contents page for one language. */
export function indexPage(
  language: Language,
  plans: Plan[],
  rules: RuleChapter[],
  /**
   * The English book, so a chapter this one has not got can still be reached.
   *
   * Optional because every other caller is a test about one language. Left out,
   * the contents page is what it always was.
   */
  english: RuleChapter[] = [],
): string {
  const ruleLinks = rules
    .map((chapter) => `<li><a href="rules/${chapter.slug}.html">${escape(chapter.title ?? chapter.slug)}</a></li>`)
    .join('\n');

  /**
   * Chapters the reader's own book does not have, named and linked to English.
   *
   * Three books arrived through a different donor with a different table of
   * contents: Arabic, Malay and Ukrainian have no chapter on the chakras, and
   * two of them have no `meaning` either. On this site those chapters simply
   * were not there — a shorter list, with nothing to say a chapter was missing
   * from it, in the one place a reader goes to see what the book contains.
   *
   * The build's decision not to *file* English under `/ar/` stands and is
   * right: a page in the wrong language is one `audit-dataset` refuses and a
   * reader cannot see coming. This is the other half of it — the link goes to
   * `/en/`, where the English text already lives and is correctly filed, and
   * carries the sentence written for exactly this: *in English — this chapter
   * is missing from your book.* `bookFor` marks it the same way for the bot and
   * the mini app; only the site was silent.
   */
  const have = new Set(rules.map((chapter) => chapter.slug));
  const borrowedLinks = english
    .filter((chapter) => !have.has(chapter.slug))
    .map(
      (chapter) =>
        `<li><a href="../en/rules/${chapter.slug}.html">${escape(chapter.title ?? chapter.slug)}</a>` +
        ` <span class="quiet">${escape(messageFor(language, 'app.borrowed'))}</span></li>`,
    )
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
    // The catalogue's, not a sentence written here. This was English with the
    // language's own name spliced into it — *The game of self-knowledge in
    // Русский* — so every contents page's search result and Telegram preview
    // was in English, in all twenty-two languages. A short description in the
    // reader's language beats a long one in somebody else's.
    description: messageFor(language, 'app.book', { count: plans.length }),
    subtitle: messageFor(language, 'app.book', { count: plans.length }),
    body: [
      rules.length
        ? `<h2>${escape(messageFor(language, 'app.rules'))}</h2>\n<ul class="chapters">\n${ruleLinks}${
            borrowedLinks ? `\n${borrowedLinks}` : ''
          }\n</ul>`
        : '',
      `<h2>${escape(messageFor(language, 'app.plans'))}</h2>\n<ol class="plans">\n${planLinks}\n</ol>`,
      `<h2>${escape(messageFor(language, 'app.legal'))}</h2>\n<ul class="chapters">\n<li><a href="legal/policy.html">${escape(messageFor(language, 'app.policy'))}</a></li>\n<li><a href="legal/eula.html">${escape(messageFor(language, 'app.terms'))}</a></li>\n</ul>`,
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

/**
 * Which way an arrow points, in a book that is read both ways.
 *
 * `←` for *back* is a fact about left-to-right reading, not about books. The
 * pager is a flex row, so in an Arabic or Urdu page the browser already puts
 * the previous link on the right and the next on the left — and the two arrows
 * carried on pointing the way they do in English, each one away from the page
 * it leads to. A hundred and forty-four pages, two languages, every plan.
 *
 * The mirror image, and nothing else: the glyph swaps, the order does not.
 * `→ 11` in a right-to-left page puts the arrow at the right edge of the link,
 * pointing right — the same shape an English reader sees pointing left. The
 * digits are a left-to-right run and the arrow is a neutral beside them, which
 * takes the paragraph's direction, so it lands on the outside where it belongs.
 *
 * The same family as the legal pages filed under `lang="ar"` over English text,
 * and as the board mirrored into nonsense before `asLeftToRight` was written:
 * knowing a language reads the other way is not the same as laying it out that
 * way.
 */
const BACK = { ltr: '←', rtl: '→' } as const;
const ON = { ltr: '→', rtl: '←' } as const;

/** One plan, with links to its neighbours so the book can be walked. */
export function planPage(language: Language, plan: Plan, total: number): string {
  const reading = directionOf(language);
  const previous =
    plan.plan > 1
      ? `<a rel="prev" href="${plan.plan - 1}.html">${BACK[reading]} ${plan.plan - 1}</a>`
      : '<span></span>';
  const next =
    plan.plan < total
      ? `<a rel="next" href="${plan.plan + 1}.html">${plan.plan + 1} ${ON[reading]}</a>`
      : '<span></span>';

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
      `<nav class="pager">${previous}<a href="../">${escape(messageFor(language, 'app.contents'))}</a>${next}</nav>`,
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
    body: `${renderMarkdown(chapter.body)}\n<nav class="pager"><span></span><a href="../">${escape(messageFor(language, 'app.contents'))}</a><span></span></nav>`,
  });
}

export interface LegalPageOptions {
  /**
   * The languages this document is *filed under*, translated or not.
   *
   * Not the same list as `translatedInto`, and that is the point: a reader
   * switching language from the privacy policy should arrive at the privacy
   * policy, which every language is served, while `hreflang` may only claim
   * the two that were actually written.
   */
  servedTo: ReadonlyArray<Language>;
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
  servedTo,
}: LegalPageOptions): string {
  return page({
    title,
    language,
    writtenIn,
    root: '../../',
    path: `legal/${name}.html`,
    // A translation, for `hreflang`: only English and Russian were written.
    pathFor: (other) => (translatedInto.includes(other) ? `legal/${name}.html` : null),
    // And where the reader lands, which is wherever the page is served — the
    // build files one under every language it writes a body for, English where
    // nobody translated it. Sending them to the contents instead lost the page
    // they were reading, 840 times across the book.
    servedAt: (other) => (servedTo.includes(other) ? `legal/${name}.html` : null),
    description: summarise(body),
    // `writtenIn`, not the section: a page whose body is the English document
    // declares `lang="en"`, and Russian chrome inside an English document would
    // be the two halves of one page disagreeing.
    body: `${renderMarkdown(body)}\n<nav class="pager"><span></span><a href="../">${escape(messageFor(writtenIn, 'app.contents'))}</a><span></span></nav>`,
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
