import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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

  it('resolves every internal link to a file that exists', () => {
    const present = new Set(files);

    for (const file of files.filter((f) => f.endsWith('.html'))) {
      const html = readFileSync(join(out, file), 'utf8');
      const dir = dirname(file);

      for (const match of html.matchAll(/href="([^"#:]+)"/g)) {
        const href = match[1];
        // Links out of the site (to the game) are checked by the app that serves it.
        if (href.startsWith('http') || href.includes('../../')) continue;

        const resolved = join(dir === '.' ? '' : dir, href).replace(/^\.\//, '');
        const target = resolved.endsWith('/') ? `${resolved}index.html` : resolved;
        expect(present.has(target) || present.has(`${target}index.html`), `${file} → ${href}`).toBe(
          true,
        );
      }
    }
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
