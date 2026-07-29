import { describe, expect, it } from 'vitest';
import { LANGUAGES, plansFor, rulesFor } from '@leela/content';
import { TOTAL_PLANS } from '@leela/engine';
import {
  LANGUAGE_NAMES,
  chapterPage,
  directionOf,
  escape,
  indexPage,
  languagePicker,
  planPage,
  renderMarkdown,
  rootPage,
  descriptionIsRedundant,
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
    expect(renderMarkdown('# Title')).toBe('<h2>Title</h2>');
    expect(renderMarkdown('## Sub')).toBe('<h3>Sub</h3>');
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
