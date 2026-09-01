import { beforeAll, describe, expect, it } from 'vitest';
import {
  LANGUAGES,
  LANGUAGE_NAMES,
  directionOf,
  messageFor,
  plansFor,
  rulesFor, EVERY_LANGUAGE_MS,
  loadEveryLanguage } from '@leela/content';
import { TOTAL_PLANS } from '@leela/engine';
import {
  DOCS_URL,
  SITE_NAME,
  chapterPage,
  escape,
  indexPage,
  languagePicker,
  legalPage,
  planPage,
  renderMarkdown,
  rootPage,
  descriptionIsRedundant,
  summarise,
  titleOf,
  translations,
} from '../src/render';

describe('escaping', () => {
  it('escapes what would otherwise close a tag or an attribute', () => {
    expect(escape('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });

  it('escapes the ampersand first, so an escape is not double-escaped', () => {
    expect(escape('&lt;')).toBe('&amp;lt;');
  });

  it('leaves other scripts alone', () => {
    for (const text of ['Рождение', '誕生', 'جنما']) expect(escape(text)).toBe(text);
  });
});

describe('markdown', () => {
  it('makes paragraphs of blank-line-separated blocks', () => {
    expect(renderMarkdown('one\n\ntwo')).toBe('<p>one</p>\n<p>two</p>');
  });

  it('joins wrapped lines rather than breaking mid-sentence', () => {
    expect(renderMarkdown('one\ntwo')).toBe('<p>one two</p>');
  });

  it('makes lists of numbered and bulleted runs', () => {
    expect(renderMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>');
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('demotes headings, so a page has exactly one h1', () => {
    // The page's own title is the `h1`; nothing in a body may claim to be one.
    expect(renderMarkdown('# Title')).toBe('<h2>Title</h2>');
    expect(renderMarkdown('###### Deep')).toBe('<h2>Deep</h2>');
  });

  it('starts a text at h2 whatever depth its author counted from', () => {
    // This asserted `## Sub` becomes an `h3`, which was the old mechanism
    // rather than the rule: a shift of exactly one, and a text that begins at
    // `##` then went `h1 → h3` with nothing between. Thirty-eight pages did.
    // What a reader is owed is the distances the author wrote, and those are
    // kept: the shallowest heading becomes the `h2`, the rest keep their gap.
    expect(renderMarkdown('## Sub')).toBe('<h2>Sub</h2>');
    expect(renderMarkdown('## Sub\n\n### Under it')).toBe('<h2>Sub</h2>\n<h3>Under it</h3>');
    expect(renderMarkdown('# Title\n\n## Sub')).toBe('<h2>Title</h2>\n<h3>Sub</h3>');
  });

  it('escapes before it formats, so markup in the source cannot inject', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).toContain('&lt;script&gt;');
    expect(renderMarkdown('**<b>x</b>**')).toBe('<p><strong>&lt;b&gt;x&lt;/b&gt;</strong></p>');
  });

  it('only links to http and https', () => {
    expect(renderMarkdown('[x](https://a.example)')).toContain('href="https://a.example"');
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('href="javascript');
  });

  it('drops nothing from a real plan', () => {
    for (const plan of plansFor('en')) {
      const html = renderMarkdown(plan.body);
      expect(html.length, `plan ${plan.plan}`).toBeGreaterThan(plan.body.length * 0.5);
    }
  });
});

describe('every page is well formed', () => {
  /** Tags that must balance for a page to render at all. */
  function balanced(html: string, tag: string): boolean {
    const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) ?? []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'g')) ?? []).length;
    return open === close;
  }

  const samples = LANGUAGES.map((language) => ({
    language,
    index: indexPage(language, plansFor(language), rulesFor(language)),
    plan: planPage(language, plansFor(language)[0], TOTAL_PLANS),
  }));

  it.each(samples)('$language balances its tags', ({ index, plan }) => {
    for (const html of [index, plan]) {
      for (const tag of ['html', 'head', 'body', 'main', 'h1', 'p', 'ul', 'ol', 'li', 'a']) {
        expect(balanced(html, tag), `<${tag}>`).toBe(true);
      }
    }
  });

  it.each(samples)('$language declares its own language on the page', ({ language, index, plan }) => {
    for (const html of [index, plan]) {
      expect(html).toContain(`<html lang="${language}"`);
    }
  });

  it('marks right-to-left languages as such', () => {
    expect(directionOf('ar')).toBe('rtl');
    expect(directionOf('ur')).toBe('rtl');
    expect(directionOf('en')).toBe('ltr');
    expect(indexPage('ar', plansFor('ar'), rulesFor('ar'))).toContain('dir="rtl"');
  });

  it('gives every page exactly one h1', () => {
    for (const { index, plan } of samples) {
      for (const html of [index, plan]) {
        expect((html.match(/<h1>/g) ?? []).length).toBe(1);
      }
    }
  });
});

describe('the contents page', () => {
  it('links every plan, in order', () => {
    const html = indexPage('en', plansFor('en'), rulesFor('en'));
    for (let plan = 1; plan <= TOTAL_PLANS; plan++) {
      expect(html, `plan ${plan}`).toContain(`href="plans/${plan}.html"`);
    }
  });

  it('links every rules chapter it was given', () => {
    const rules = rulesFor('ru');
    const html = indexPage('ru', plansFor('ru'), rules);
    for (const chapter of rules) {
      expect(html).toContain(`href="rules/${chapter.slug}.html"`);
    }
  });

  it('links the legal documents, which a store and Telegram both require', () => {
    const html = indexPage('en', plansFor('en'), rulesFor('en'));
    expect(html).toContain('legal/policy.html');
    expect(html).toContain('legal/eula.html');
  });
});

describe('a plan page', () => {
  it('carries the plan text', () => {
    const plan = plansFor('en')[41];
    const html = planPage('en', plan, TOTAL_PLANS);
    expect(html).toContain(escape(plan.title));
    expect(html).toContain(escape(plan.body.slice(0, 60)).replace(/\n/g, ' ').slice(0, 40));
  });

  it('links its neighbours, and stops at the ends', () => {
    const plans = plansFor('en');
    const first = planPage('en', plans[0], TOTAL_PLANS);
    expect(first).not.toContain('rel="prev"');
    expect(first).toContain('href="2.html"');

    const last = planPage('en', plans[TOTAL_PLANS - 1], TOTAL_PLANS);
    expect(last).not.toContain('rel="next"');
    expect(last).toContain(`href="${TOTAL_PLANS - 1}.html"`);
  });

  it('uses relative paths, so the site works from any subdirectory', () => {
    const html = planPage('en', plansFor('en')[0], TOTAL_PLANS);
    expect(html).not.toMatch(/(href|src)="\//);
  });
});

describe('the language picker', () => {
  it('offers every language, by its own name', () => {
    const html = languagePicker('en', '');
    for (const language of LANGUAGES) {
      expect(html, language).toContain(LANGUAGE_NAMES[language]);
    }
  });

  it('names each language in that language, not in English', () => {
    expect(LANGUAGE_NAMES.ru).toBe('Русский');
    expect(LANGUAGE_NAMES.ja).toBe('日本語');
    expect(LANGUAGE_NAMES.ar).toBe('العربية');
  });

  it('does not link the language you are already reading', () => {
    const html = languagePicker('ru', '');
    expect(html).toContain('<span class="current" lang="ru"');
    expect(html).not.toContain('href="ru/');
  });

  it('has a name for every language the dataset carries', () => {
    for (const language of LANGUAGES) {
      expect(LANGUAGE_NAMES[language], language).toBeTruthy();
    }
  });
});

describe('the root page', () => {
  it('says how many languages there are, from the data rather than a number in prose', () => {
    expect(rootPage()).toContain(`${LANGUAGES.length} languages`);
  });

  it('offers every language', () => {
    const html = rootPage();
    for (const language of LANGUAGES) expect(html).toContain(`href="${language}/`);
  });
});

describe('a rules chapter', () => {
  it('renders with its title and body', () => {
    const chapter = rulesFor('ru')[0];
    const html = chapterPage('ru', chapter);
    expect(html).toContain(escape(chapter.title ?? chapter.slug));
    expect(html.length).toBeGreaterThan(chapter.body.length / 2);
  });
});

describe('a description that only repeats the text', () => {
  // The Russian source puts the first paragraph in the frontmatter, so showing
  // both prints the same words twice before the reader gets anywhere.

  it('is recognised and left out', () => {
    const plan = plansFor('ru')[0];
    expect(descriptionIsRedundant(plan)).toBe(true);
    expect(planPage('ru', plan, TOTAL_PLANS)).not.toContain('class="subtitle"');
  });

  it('does not drop a description that genuinely adds something', () => {
    expect(
      descriptionIsRedundant({
        plan: 1,
        title: 'x',
        description: 'A summary in different words.',
        body: 'The text begins quite otherwise.',
        source: 'test',
      }),
    ).toBe(false);
  });

  it('treats a missing description as nothing to show', () => {
    expect(
      descriptionIsRedundant({ plan: 1, title: 'x', description: null, body: 'b', source: 't' }),
    ).toBe(true);
  });

  it('ignores whitespace and case when comparing', () => {
    expect(
      descriptionIsRedundant({
        plan: 1,
        title: 'x',
        description: 'The  Same\nWords',
        body: 'the same words, and then more.',
        source: 't',
      }),
    ).toBe(true);
  });
});

describe('every page can be used without a mouse', () => {
  // The mini app shipped 72 cells that were focusable and inoperable. These
  // are the equivalent checks for the book, asserted on shape rather than on
  // a list of known pages.

  const pages = [
    ['contents', indexPage('en', plansFor('en'), rulesFor('en'))],
    ['a plan', planPage('en', plansFor('en')[0], TOTAL_PLANS)],
    ['a chapter', chapterPage('ru', rulesFor('ru')[0])],
  ] as const;

  it.each(pages)('%s gives every link an accessible name', (_name, html) => {
    const links = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)];
    expect(links.length).toBeGreaterThan(0);

    for (const [whole, inner] of links) {
      const text = inner.replace(/<[^>]+>/g, '').trim();
      const labelled = /aria-label="/.test(whole);
      expect(text.length > 0 || labelled, `empty link: ${whole.slice(0, 60)}`).toBe(true);
    }
  });

  it.each(pages)('%s marks its main content as such', (_name, html) => {
    expect(html).toContain('<main>');
  });

  it.each(pages)('%s has exactly one first-level heading', (_name, html) => {
    expect((html.match(/<h1>/g) ?? []).length).toBe(1);
  });

  it.each(pages)('%s names its language on the document, not just in prose', (_name, html) => {
    expect(html).toMatch(/<html lang="[a-z]{2}"/);
  });

  it('does not rely on colour alone to mark a snake or an arrow', () => {
    // The board is drawn in the app, not the book — but the book links plans
    // by name, so the distinction is carried by words either way.
    const html = indexPage('en', plansFor('en'), rulesFor('en'));
    for (const plan of plansFor('en').slice(0, 5)) {
      expect(html).toContain(escape(plan.title));
    }
  });
});

describe('data the content does not currently produce', () => {
  // `RuleChapter.title` is typed `string | null` and every chapter in all 22
  // languages has one, so these branches never run against real data. They are
  // exercised directly instead: the type permits the case, and a page showing
  // nothing where a heading belongs would be worse than one showing a slug.

  it('falls back to the slug when a chapter has no title', () => {
    const untitled = { slug: 'numerology', title: null, body: 'text', source: 'test' };
    const html = chapterPage('en', untitled);

    expect(html).toContain('<h1>numerology</h1>');
    expect(html).not.toContain('<h1></h1>');
  });

  it('lists an untitled chapter by its slug in the contents', () => {
    const untitled = { slug: 'notes', title: null, body: 'text', source: 'test' };
    const html = indexPage('en', plansFor('en'), [untitled]);

    expect(html).toContain('>notes</a>');
  });

  it('leaves out the rules section entirely when there are no chapters', () => {
    // A heading with an empty list under it reads as a missing page rather than
    // as a language that has no rules translated.
    const html = indexPage('en', plansFor('en'), []);

    expect(html).not.toContain(messageFor('en', 'app.rules'));
    expect(html).toContain(messageFor('en', 'app.plans'));
  });

  it('still links the legal documents when there are no rules', () => {
    // Those are required regardless of what has been translated.
    const html = indexPage('en', plansFor('en'), []);
    expect(html).toContain('legal/policy.html');
  });
});

/**
 * What a page says about itself.
 *
 * The `<head>` of all 1,784 pages held four tags: a charset, a viewport, a
 * title and a stylesheet. No description, no canonical, and — in a book that
 * exists 22 times over — no `hreflang`. The book knew where every page lived in
 * every language and told only the reader: `pathFor` is what the footer picker
 * is built from, and nothing upstairs was given it.
 */

describe('the title', () => {
  it('names the site once', () => {
    // The suffix was appended unconditionally, so the contents page — whose
    // title *is* the site's name — read `Leela — Leela`, in all 22 languages.
    expect(titleOf(SITE_NAME)).toBe(SITE_NAME);
    expect(titleOf('41. Human plane')).toBe(`41. Human plane — ${SITE_NAME}`);
  });

  it('never says it twice, on any page the book actually builds', () => {
    const pages = [
      indexPage('en', plansFor('en'), rulesFor('en')),
      planPage('en', plansFor('en')[0]!, TOTAL_PLANS),
      chapterPage('ru', rulesFor('ru')[0]!),
      rootPage(),
    ];

    for (const html of pages) {
      const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
      expect(title, 'a title').not.toBe('');
      expect(title.split(SITE_NAME).length - 1, title).toBeLessThanOrEqual(1);
    }
  });
});

describe('a page declares the language its words are in', () => {
  /**
   * Not the language of the folder it sits in. Only English and Russian legal
   * documents were ever written and the other twenty languages are served the
   * English — which is right, a missing privacy policy is a store rejection.
   * Filing it as Arabic is not: `/ar/legal/policy.html` said `lang="ar"
   * dir="rtl"` over English text, so it laid out right to left and a screen
   * reader reached for Arabic phonemes. Forty pages, four of them visibly.
   */
  const english = 'Privacy Policy\n\nWe collect nothing at all.';

  const served = (language: 'ar' | 'de') =>
    legalPage({
      language,
      name: 'policy',
      title: 'Privacy policy',
      body: english,
      writtenIn: 'en',
      translatedInto: ['en', 'ru'],
      servedTo: LANGUAGES,
    });

  it('says English over English, whichever section it is filed under', () => {
    for (const language of ['ar', 'de'] as const) {
      expect(served(language), language).toContain('<html lang="en" dir="ltr">');
    }
  });

  it('does not lay a left-to-right document out right to left', () => {
    expect(served('ar')).not.toContain('dir="rtl"');
  });

  it('is still filed where the reader looks for it', () => {
    // The fix is what the page *claims*, not where it lives. A reader of
    // Arabic still reaches it from the Arabic contents.
    expect(served('ar')).toContain('href="../../ar/"');
  });

  it('says the section language when the document really is in it', () => {
    const translated = legalPage({
      language: 'ru',
      name: 'policy',
      title: 'Privacy policy',
      body: 'Политика конфиденциальности',
      writtenIn: 'ru',
      translatedInto: ['en', 'ru'],
      servedTo: LANGUAGES,
    });

    expect(translated).toContain('<html lang="ru"');
  });

  it('leaves every page whose text is its own section alone', () => {
    for (const language of LANGUAGES) {
      const html = planPage(language, plansFor(language)[0]!, TOTAL_PLANS);
      expect(html, language).toContain(`<html lang="${language}" dir="${directionOf(language)}">`);
    }
  });
});

describe('a page points at itself', () => {
  it('gives one absolute canonical address', () => {
    const html = planPage('ru', plansFor('ru')[40]!, TOTAL_PLANS);
    expect(html).toContain(`<link rel="canonical" href="${DOCS_URL}ru/plans/41.html">`);
  });

  it('points twenty copies of one document at the one they are copies of', () => {
    // Twenty URLs serving the identical English policy is exactly what a
    // canonical is for; without it they compete with each other and with the
    // original.
    const html = legalPage({
      language: 'de',
      name: 'eula',
      title: 'Terms of use',
      body: 'Terms.',
      writtenIn: 'en',
      translatedInto: ['en', 'ru'],
      servedTo: LANGUAGES,
    });

    expect(html).toContain(`<link rel="canonical" href="${DOCS_URL}en/legal/eula.html">`);
    expect(html).not.toContain(`${DOCS_URL}de/legal/eula.html`);
  });

  it('agrees with what it tells a link preview', () => {
    const html = chapterPage('ru', rulesFor('ru')[0]!);
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
    const og = html.match(/property="og:url" content="([^"]+)"/)?.[1];

    expect(canonical).toBeTruthy();
    expect(og).toBe(canonical);
  });
});

describe('a page declares its translations', () => {
  /**
   * Only where they exist. The picker sends a reader looking for a chapter
   * their language lacks to that language's contents rather than to a 404 —
   * help for a person, and a lie to a crawler, because the German contents is
   * not a translation of the Arabic `online` chapter.
   *
   * `pathFor` therefore answers `null` for absent and `''` for the contents.
   * Those two used to be the same value: from the picker they render the same
   * link, and telling them apart is what makes the head derivable at all.
   */
  const declared = (html: string) =>
    [...html.matchAll(/hreflang="([a-z-]+)"/g)].map(([, code]) => code);

  it('names every language a plan exists in, which is all of them', () => {
    const codes = declared(planPage('en', plansFor('en')[0]!, TOTAL_PLANS));
    expect(new Set(codes)).toEqual(new Set([...LANGUAGES, 'x-default']));
  });

  it('names only the languages that carry a chapter', () => {
    const chapter = { slug: 'online', title: 'Online', body: 'text', source: 'test' };
    const only = new Set(['ar', 'ms', 'uk']);
    const html = chapterPage('ar', chapter, (language) => only.has(language));

    expect(new Set(declared(html))).toEqual(new Set([...only, 'x-default']));
  });

  it('offers the reader the contents anyway, where it declares nothing', () => {
    // The two audiences are told different things on purpose, and this is the
    // guard that fixing the crawler did not strand the person.
    const chapter = { slug: 'online', title: 'Online', body: 'text', source: 'test' };
    const html = chapterPage('ar', chapter, (language) => language === 'ar');

    expect(html).not.toContain('hreflang="de"');
    expect(html, 'the picker still reaches German').toContain('href="../../de/"');
  });

  it('sends a reader in no language of the book to the page that asks', () => {
    for (const html of [planPage('ja', plansFor('ja')[0]!, TOTAL_PLANS), rootPage()]) {
      expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${DOCS_URL}">`);
    }
  });

  it('is built from the same function the picker is', () => {
    // Two lists of where a page lives would be two things to keep in step, and
    // the one nobody reads is the one that rots.
    const pathFor = (language: string) => (language === 'de' ? null : 'plans/1.html');
    const head = translations('en', 'plans/1.html', pathFor as never);
    const foot = languagePicker('en', '../../', pathFor as never);

    expect(head).not.toContain('hreflang="de"');
    expect(foot, 'German is still reachable, at its contents').toContain('href="../../de/"');
    for (const language of ['ru', 'ja'] as const) {
      expect(head).toContain(`href="${DOCS_URL}${language}/plans/1.html"`);
      expect(foot).toContain(`href="../../${language}/plans/1.html"`);
    }
  });
});

describe('a page describes itself in a sentence', () => {
  it('carries one on every kind of page the book builds', () => {
    const pages = [
      ['contents', indexPage('en', plansFor('en'), rulesFor('en'))],
      ['a plan', planPage('en', plansFor('en')[0]!, TOTAL_PLANS)],
      ['a chapter', chapterPage('ru', rulesFor('ru')[0]!)],
      ['the root', rootPage()],
    ] as const;

    for (const [name, html] of pages) {
      const description = html.match(/name="description" content="([^"]*)"/)?.[1];
      expect(description, name).toBeTruthy();
      expect((description ?? '').length, name).toBeGreaterThan(20);
    }
  });

  it('draws it from the page, so no two plans share one', () => {
    // The shape, not the presence: a description repeated across pages
    // describes none of them, and is satisfied by any constant string.
    const descriptions = plansFor('en').map(
      (plan) => planPage('en', plan, TOTAL_PLANS).match(/name="description" content="([^"]*)"/)?.[1],
    );

    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it('tells a link preview the same sentence', () => {
    // The bot posts these into Telegram, which builds its preview out of the
    // Open Graph tags and nothing else.
    const html = planPage('en', plansFor('en')[7]!, TOTAL_PLANS);
    const meta = html.match(/name="description" content="([^"]*)"/)?.[1];
    const og = html.match(/property="og:description" content="([^"]*)"/)?.[1];

    expect(meta).toBe(og);
  });

  it('cannot break out of the attribute it sits in', () => {
    const html = planPage('en', { ...plansFor('en')[0]!, body: 'a " onload="x' }, TOTAL_PLANS);
    expect(html).toContain('&quot; onload=&quot;');
    expect(html).not.toMatch(/content="[^"]*" onload=/);
  });
});

describe('summarising a page', () => {
  it('says nothing the reader did not write', () => {
    expect(summarise('**Bold** and *thin* and `code` and [a link](https://x.example)')).toBe(
      'Bold and thin and code and a link',
    );
  });

  it('leaves out a heading, which the page already shows as its title', () => {
    // Kept, the privacy policy opened `Privacy Policy This is the privacy
    // policy for…` and spent a quarter of the preview repeating the title.
    expect(summarise('# Privacy Policy\n\nWe collect nothing.')).toBe('We collect nothing.');
  });

  it('still describes a document that is nothing but headings', () => {
    expect(summarise('# Terms')).toBe('Terms');
  });

  it('cuts at a word, not through one', () => {
    const summary = summarise('one two three four five six seven eight', 20);
    expect(summary).toBe('one two three four…');
  });

  it('cuts a script that has no spaces to cut at', () => {
    // Chinese, Japanese and Thai write without word boundaries; walking back
    // to find one would return the empty string.
    const summary = summarise('第一' + 'план'.repeat(0) + '無無無無無無無無無無無無無無無無無無無無', 10);
    expect(summary.length).toBe(11);
    expect(summary.endsWith('…')).toBe(true);
  });

  it('never exceeds the limit it was given, in any real page of the book', () => {
    for (const language of LANGUAGES) {
      for (const plan of plansFor(language)) {
        const summary = summarise(plan.description || plan.body);
        expect(summary.length, `${language}/${plan.plan}`).toBeLessThanOrEqual(156);
        expect(summary.trim().length, `${language}/${plan.plan}`).toBeGreaterThan(0);
      }
    }
  });

  it('leaves a short text exactly as it is, with no ellipsis', () => {
    expect(summarise('Short enough.')).toBe('Short enough.');
  });
});

describe('an arrow points the way the reader walks', () => {
  /**
   * `←` for *back* is a fact about left-to-right reading, not about books. The
   * pager is a flex row, so an Arabic or Urdu page already puts the previous
   * link on the right and the next on the left — and both arrows carried on
   * pointing the way they do in English, each one away from the page it leads
   * to. A hundred and forty-four pages, two languages, every plan.
   *
   * Asserted over every language rather than over Arabic: the rule is that the
   * glyph follows the direction, and a check naming the two right-to-left tags
   * would pass a third being added and forgotten.
   */
  const backwards = { ltr: '←', rtl: '→' } as const;
  const onwards = { ltr: '→', rtl: '←' } as const;

  it.each(LANGUAGES.map((language) => [language] as const))('%s', (language) => {
    const plans = plansFor(language);
    const middle = plans.find((plan) => plan.plan === 40);
    expect(middle, 'every language has all 72').toBeDefined();

    const html = planPage(language, middle!, plans.length);
    const reading = directionOf(language);

    const prev = /<a rel="prev"[^>]*>([^<]*)<\/a>/.exec(html)?.[1] ?? '';
    const next = /<a rel="next"[^>]*>([^<]*)<\/a>/.exec(html)?.[1] ?? '';

    expect(prev, 'back').toContain(backwards[reading]);
    expect(prev, 'and not the other one').not.toContain(onwards[reading]);
    expect(next, 'on').toContain(onwards[reading]);
    expect(next, 'and not the other one').not.toContain(backwards[reading]);
  });

  it('sends each arrow to the page it names, whichever way it points', () => {
    // The glyph must not become the thing that decides where a link goes. This
    // is the assertion that would fail if the swap had been done by swapping
    // the two links instead of the two characters.
    for (const language of ['en', 'ar'] as const) {
      const plans = plansFor(language);
      const html = planPage(language, plans[39]!, plans.length);

      expect(html, language).toContain('<a rel="prev" href="39.html">');
      expect(html, language).toContain('<a rel="next" href="41.html">');
    }
  });

  it('gives the first plan no way back and the last no way on, both ways round', () => {
    for (const language of ['en', 'ar'] as const) {
      const plans = plansFor(language);
      const first = planPage(language, plans[0]!, plans.length);
      const last = planPage(language, plans[plans.length - 1]!, plans.length);

      expect(first, language).not.toContain('rel="prev"');
      expect(last, language).not.toContain('rel="next"');
      // Still a pager, so the contents link keeps its place on the page.
      expect(first).toContain('class="pager"');
      expect(last).toContain('class="pager"');
    }
  });
});

describe('a chapter the reader\'s own book has not got', () => {
  /**
   * Three books came through a different donor with a different table of
   * contents: Arabic, Malay and Ukrainian have no chapter on the chakras, and
   * two of them have no `meaning` either. On this site those chapters were
   * simply absent — a shorter list, in the one place a reader goes to see what
   * the book contains, with nothing to say a chapter was missing from it.
   *
   * The bot and the mini app already borrow the English chapter and mark it;
   * `bookFor` is where that decision is written. The site deliberately does not
   * *file* English under `/ar/` — a page in the wrong language is one
   * `audit-dataset` refuses — so it names the chapter and links to `/en/`.
   */
  const english = rulesFor('en');

  it.each(LANGUAGES.map((language) => [language] as const))(
    'every chapter of the book is reachable from %s',
    (language) => {
      const html = indexPage(language, plansFor(language), rulesFor(language), english);
      const own = new Set(rulesFor(language).map((chapter) => chapter.slug));

      for (const chapter of english) {
        const href = own.has(chapter.slug)
          ? `href="rules/${chapter.slug}.html"`
          : `href="../en/rules/${chapter.slug}.html"`;
        expect(html, `${language}/${chapter.slug}`).toContain(href);
      }
    },
  );

  it('marks the borrowed one and only the borrowed one', () => {
    // Arabic has no chakras chapter and does have its own `notes`. The note is
    // owed on the first and would be a lie on the second.
    const html = indexPage('ar', plansFor('ar'), rulesFor('ar'), english);
    const note = messageFor('ar', 'app.borrowed');

    expect(html).toContain(`href="../en/rules/chakras.html"`);
    expect((html.match(new RegExp(note.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length)
      .toBe(english.filter((chapter) => !rulesFor('ar').some((own) => own.slug === chapter.slug)).length);
  });

  it('says nothing extra to a language whose book is whole', () => {
    const html = indexPage('de', plansFor('de'), rulesFor('de'), english);

    expect(html).not.toContain('../en/rules/');
    expect(html).not.toContain(messageFor('de', 'app.borrowed'));
  });

  it('keeps the reader\'s own chapters first, and does not displace them', () => {
    // A borrowed chapter appended, not merged in at the English position: the
    // book a reader has is the book they are reading.
    const html = indexPage('ar', plansFor('ar'), rulesFor('ar'), english);
    const ownLast = html.lastIndexOf('href="rules/');
    const borrowedFirst = html.indexOf('href="../en/rules/');

    expect(ownLast).toBeGreaterThan(-1);
    expect(borrowedFirst).toBeGreaterThan(ownLast);
  });

  it('still files no English text under another language', () => {
    // The decision this is the other half of. The link leaves the folder; the
    // English chapter is never written into it.
    const html = indexPage('ar', plansFor('ar'), rulesFor('ar'), english);
    const chakras = english.find((chapter) => chapter.slug === 'chakras');

    expect(chakras?.body?.slice(0, 60) ?? '', 'the English text itself').not.toBe('');
    expect(html).not.toContain(chakras!.body.slice(0, 60));
  });
});

/**
 * The Russian text, in memory, before a Russian page is rendered.
 *
 * The plans are loaded on demand now; the book's own generator awaits every
 * language before it writes a page, and a suite that renders one has to do the
 * same or it renders English and asserts English about it.
 */
beforeAll(loadEveryLanguage, EVERY_LANGUAGE_MS);

