import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { LANGUAGES } from '@leela/content';
import { TOTAL_PLANS } from '@leela/engine';
import { build, loadLegal, stripFrontmatter } from '../src/build';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = mkdtempSync(join(tmpdir(), 'leela-docs-'));
const result = build(out);

afterAll(() => rmSync(out, { recursive: true, force: true }));

/** Every file under a directory, as paths relative to it. */
function walk(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  );
}

const files = walk(out);

describe('coverage', () => {
  it('writes a page for every plan in every language', () => {
    for (const language of LANGUAGES) {
      for (let plan = 1; plan <= TOTAL_PLANS; plan++) {
        expect(files, `${language}/plans/${plan}`).toContain(`${language}/plans/${plan}.html`);
      }
    }
  });

  it('writes a contents page for every language', () => {
    for (const language of LANGUAGES) {
      expect(files).toContain(`${language}/index.html`);
    }
  });

  it('reports what it wrote, and the count matches the files', () => {
    expect(result.languages).toBe(LANGUAGES.length);
    // Every page plus the stylesheet, which is not counted as a page.
    expect(files.filter((f) => f.endsWith('.html'))).toHaveLength(result.pages);
  });

  it('ships a stylesheet, so no page renders unstyled', () => {
    expect(files).toContain('style.css');
    expect(readFileSync(join(out, 'style.css'), 'utf8').length).toBeGreaterThan(500);
  });
});

describe('legal documents', () => {
  // A missing privacy policy is a store rejection, and Telegram asks for one
  // before a mini app can be listed. Serving English beats serving nothing.

  it('gives every language a privacy policy and terms', () => {
    for (const language of LANGUAGES) {
      expect(files, `${language} policy`).toContain(`${language}/legal/policy.html`);
      expect(files, `${language} eula`).toContain(`${language}/legal/eula.html`);
    }
  });

  it('serves the translation where one exists, and English elsewhere', () => {
    expect(result.legalTranslated).toEqual(expect.arrayContaining(['en', 'ru']));

    const russian = readFileSync(join(out, 'ru/legal/policy.html'), 'utf8');
    expect(russian).toContain('конфиденциальности');

    // German has no translation, so it gets the English text — not an empty page.
    const german = readFileSync(join(out, 'de/legal/policy.html'), 'utf8');
    expect(german.length).toBeGreaterThan(1000);
  });

  it('strips the frontmatter rather than printing it', () => {
    for (const language of ['en', 'ru']) {
      const html = readFileSync(join(out, `${language}/legal/policy.html`), 'utf8');
      expect(html).not.toContain('sidebar_position');
    }
  });
});

describe('stripFrontmatter', () => {
  it('removes a leading block and keeps the body', () => {
    expect(stripFrontmatter('---\na: 1\n---\n\nbody')).toBe('body');
  });

  it('leaves a document with no frontmatter alone', () => {
    expect(stripFrontmatter('# Title\n\nbody')).toBe('# Title\n\nbody');
  });

  it('does not mistake a horizontal rule mid-document for frontmatter', () => {
    expect(stripFrontmatter('# Title\n\n---\n\nbody')).toContain('# Title');
  });
});

describe('loadLegal', () => {
  it('reads the documents that were rescued from the archived site', () => {
    const legal = loadLegal(join(APP, 'legal'));
    expect([...legal.keys()].sort()).toEqual(['eula', 'policy']);
    expect([...legal.get('policy')!.keys()].sort()).toEqual(['en', 'ru']);
  });

  it('returns nothing rather than throwing when there is no such directory', () => {
    expect(loadLegal(join(APP, 'no-such-directory')).size).toBe(0);
  });
});

describe('the built site', () => {
  it('links only relatively, so it works under any path', () => {
    for (const file of files.filter((f) => f.endsWith('.html'))) {
      const html = readFileSync(join(out, file), 'utf8');
      const absolute = html.match(/(?:href|src)="\/[^"]*"/g) ?? [];
      expect(absolute, file).toEqual([]);
    }
  });

  it('leaves no page a reader cannot get to', () => {
    /**
     * The mirror of the test below, and a different property: that one says
     * every link lands somewhere, this one says everywhere can be landed on.
     * A page published and linked from nothing is the same defect seen from the
     * other side — 1,784 files are written here, and a chapter that three
     * languages carry and nineteen do not is exactly the kind of thing to fall
     * out of an index built from one language's shape.
     *
     * Written naively it reports twenty-two orphans and they are all false: the
     * root page links to `en/`, not to `en/index.html`, which is how a
     * directory link is written and how every server resolves it. A check that
     * cries wolf twenty-two times on a sound site is a check nobody keeps.
     */
    const linked = new Set<string>();

    for (const file of files.filter((f) => f.endsWith('.html'))) {
      const html = readFileSync(join(out, file), 'utf8');

      for (const match of html.matchAll(/href="([^"#:]+)"/g)) {
        let href = match[1];
        if (href.startsWith('http')) continue;
        if (href === '' || href.endsWith('/')) href += 'index.html';

        const target = normalize(join(dirname(file), href));
        linked.add(target);
        // `../de` and `../de/index.html` are one place written two ways.
        linked.add(join(target, 'index.html'));
      }
    }

    const orphans = files.filter(
      (file) => file.endsWith('.html') && file !== 'index.html' && !linked.has(file),
    );

    expect(orphans).toEqual([]);
  });

  it('resolves every internal link to a file that exists', () => {
    /**
     * Every one of them. This used to skip `../../`, which is how every link
     * in the language switcher is written — so the check that resolves links
     * was passing by not looking at the 44,000 it was there for. And they were
     * wrong: `languagePicker` takes a path, was never given one, and pointed
     * every page at the language's contents, so a reader on plan 41 who
     * switched to Russian landed on a list of 72 titles and had to find it
     * again. Written the obvious way instead, they 404 in 211 places, because
     * the books are not the same shape.
     */
    const present = new Set(files);
    let checked = 0;

    for (const file of files.filter((f) => f.endsWith('.html'))) {
      const html = readFileSync(join(out, file), 'utf8');
      const dir = dirname(file);

      for (const match of html.matchAll(/href="([^"#:]+)"/g)) {
        const href = match[1];
        // Only links out of the site are somebody else's to check.
        if (href.startsWith('http')) continue;
        checked += 1;

        const resolved = join(dir === '.' ? '' : dir, href).replace(/^\.\//, '');
        const target = resolved.endsWith('/') ? `${resolved}index.html` : resolved;
        expect(present.has(target) || present.has(`${target}index.html`), `${file} → ${href}`).toBe(
          true,
        );
      }
    }

    // The count is the point: an exclusion that quietly dropped nine tenths of
    // the links read exactly like a check that passed.
    expect(checked).toBeGreaterThan(40_000);
  });

  it('offers the same page in every language that has it', () => {
    // The switcher's whole reason for existing: a book has 22 languages
    // because somebody wants to read *this* plan in theirs.
    const html = readFileSync(join(out, 'en/plans/41.html'), 'utf8');

    for (const language of ['ru', 'ar', 'zh']) {
      expect(html, language).toContain(`href="../../${language}/plans/41.html"`);
    }
  });

  it('offers the contents where that language has no such page', () => {
    // The books are not the same shape: `ar`, `ms` and `uk` carry chapters the
    // other nineteen lack, and lack `chakras`, which they have. A switcher
    // that assumed otherwise is 211 dead links.
    const html = readFileSync(join(out, 'en/rules/chakras.html'), 'utf8');

    expect(html).toContain('href="../../ru/rules/chakras.html"');
    expect(html).toContain('href="../../ms/"');
    expect(html).not.toContain('href="../../ms/rules/chakras.html"');
  });

  it('writes real content, not empty shells', () => {
    for (const file of files.filter((f) => f.endsWith('.html'))) {
      expect(readFileSync(join(out, file), 'utf8').length, file).toBeGreaterThan(400);
    }
  });

  it('has a root page that does not assume a language', () => {
    expect(existsSync(join(out, 'index.html'))).toBe(true);
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    expect(html).toContain('href="en/');
    expect(html).toContain('href="ru/');
  });
});

describe('the number this book says about itself', () => {
  /**
   * A hand-kept number, which is the kind of sentence `audit-claims` was
   * written for: *the two passes before this one were each about a confident
   * sentence that had never been checked… a hand-kept number is the same kind
   * of sentence, waiting.* That audit runs every suite and holds the README's
   * test counts to it, and the page count was left out of it — so three
   * sentences in the two documents state it and nothing compares them to a
   * build.
   *
   * They had already come apart: two say 1,784 and one said 1,785, and the
   * build writes 1,784.
   *
   * Held here rather than in `audit-claims`, because this is the only place a
   * build already happens — the audit is node and this book is written by bun.
   */
  const DOCUMENTS = ['README.md', 'MIGRATION.md'] as const;
  const REPO = join(APP, '..', '..');

  /** Every "N pages" this repository says, with the file it says it in. */
  const claims = DOCUMENTS.flatMap((name) => {
    const text = readFileSync(join(REPO, name), 'utf8');
    return [...text.matchAll(/\b([0-9][0-9,]{2,6})\s+pages\b/g)].map((found) => ({
      name,
      said: Number((found[1] ?? '').replace(/,/g, '')),
    }));
  });

  it('is said at all, or this check is checking nothing', () => {
    // The guard against a regular expression that has stopped matching: a
    // sentence reworded is a sentence this no longer holds, and silence would
    // read exactly like agreement.
    expect(claims.length).toBeGreaterThan(1);
  });

  it('is the number the build writes, wherever it is said', () => {
    for (const claim of claims) {
      expect(claim.said, `${claim.name} says ${claim.said}`).toBe(result.pages);
    }
  });

  it('is the number of pages there are, not of files', () => {
    // `result.pages` is the build's own count and the stylesheet is not a page.
    // Both halves, because a count that agreed with itself and with nothing
    // else is what a hand-kept number already was.
    expect(files.filter((file) => file.endsWith('.html'))).toHaveLength(result.pages);
    expect(files).toContain('style.css');
  });
});
