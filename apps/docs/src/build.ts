/**
 * Writing the book out.
 *
 * Every page comes from `@leela/content` — the same dataset the bot and the
 * mini app read — so the book cannot drift from the game. The only text that
 * lives here is legal: a privacy policy and terms, which are not game content
 * and were rescued from the archived Docusaurus site.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGUAGES, plansFor, rulesFor, type Language } from '@leela/content';
import { TOTAL_PLANS } from '@leela/engine';
import { chapterPage, indexPage, legalPage, planPage, rootPage } from './render';
import { STYLE } from './style';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');

export interface BuildResult {
  pages: number;
  languages: number;
  /** Languages that got a translated legal document rather than the English. */
  legalTranslated: Language[];
}

/** Strip frontmatter from a rescued markdown file. */
export function stripFrontmatter(source: string): string {
  const match = source.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  return (match?.[1] ?? source).trim();
}

/**
 * Legal documents, by name and language.
 *
 * Only English and Russian were ever written. Every other language is served
 * the English rather than nothing: a missing privacy policy is a store
 * rejection and, for a Telegram mini app, a missing requirement.
 */
export function loadLegal(dir: string): Map<string, Map<string, string>> {
  const documents = new Map<string, Map<string, string>>();
  if (!existsSync(dir)) return documents;

  for (const file of readdirSync(dir)) {
    const match = file.match(/^([a-z]+)\.([a-z]{2})\.md$/);
    if (!match) continue;

    const [, name, language] = match;
    if (name === undefined || language === undefined) continue;

    const byLanguage = documents.get(name) ?? new Map<string, string>();
    byLanguage.set(language, stripFrontmatter(readFileSync(join(dir, file), 'utf8')));
    documents.set(name, byLanguage);
  }

  return documents;
}

const LEGAL_TITLES: Record<string, string> = {
  policy: 'Privacy policy',
  eula: 'Terms of use',
};

export function build(outDir: string): BuildResult {
  const legal = loadLegal(join(APP, 'legal'));
  const legalTranslated: Language[] = [];
  let pages = 0;

  const write = (path: string, contents: string) => {
    const full = join(outDir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
    pages++;
  };

  write('index.html', rootPage());
  writeFileSync(join(outDir, 'style.css'), STYLE);

  // Which languages carry which chapters, so a switcher can offer the same
  // chapter where it exists and the contents where it does not.
  const chapters = new Map<string, Set<string>>(
    LANGUAGES.map((language) => [
      language,
      new Set(rulesFor(language).map((chapter) => chapter.slug)),
    ]),
  );
  const hasChapter = (language: Language, slug: string) =>
    chapters.get(language)?.has(slug) ?? false;

  for (const language of LANGUAGES) {
    const plans = plansFor(language);
    // `rulesFor`, not `bookFor`: a book is *shown* in English to a reader whose
    // language has none, and that is help. Writing English into
    // `/de/rules/notes.html` is a published page in the wrong language, which
    // `audit-dataset.mjs` refuses and a reader has no way to see coming. The
    // difference is between falling back and filing wrongly.
    const rules = rulesFor(language);

    write(`${language}/index.html`, indexPage(language, plans, rules));

    for (const plan of plans) {
      write(`${language}/plans/${plan.plan}.html`, planPage(language, plan, TOTAL_PLANS));
    }

    for (const chapter of rules) {
      write(`${language}/rules/${chapter.slug}.html`, chapterPage(language, chapter, hasChapter));
    }

    let translated = false;
    for (const [name, byLanguage] of legal) {
      const body = byLanguage.get(language) ?? byLanguage.get('en');
      if (!body) continue;
      if (byLanguage.has(language)) translated = true;

      write(
        `${language}/legal/${name}.html`,
        legalPage({
          language,
          name,
          title: LEGAL_TITLES[name] ?? name,
          body,
          // The language of the *text*, which is English wherever the document
          // was never translated. The page is still filed under `language` and
          // still linked from that contents — it is served, as it must be. It
          // just no longer claims to be written in a language it is not.
          writtenIn: byLanguage.has(language) ? language : 'en',
          translatedInto: LANGUAGES.filter((other) => byLanguage.has(other)),
        }),
      );
    }
    if (translated) legalTranslated.push(language);
  }

  return { pages, languages: LANGUAGES.length, legalTranslated };
}

// Run directly: `bun run src/build.ts [outDir]`
if (import.meta.main) {
  const outDir = process.argv[2] ?? join(APP, 'dist');
  const result = build(outDir);
  console.log(
    `Built ${result.pages} pages across ${result.languages} languages into ${outDir}`,
  );
  console.log(
    `Legal documents translated for: ${result.legalTranslated.join(', ')} — the rest are served the English.`,
  );
}
