/**
 * The two callbacks a page is built with, handed something that fails.
 *
 * `audit-promises` states the rule: *an injected dependency is a promise the
 * type does not hold anyone to, so something has to break it deliberately. A
 * test that only ever hands in a working implementation proves the happy path
 * twice.* Four consecutive passes of this migration found one defect each by
 * going looking, and every one was the same kind — a model that never returned,
 * a download that never returned, a room that would not save, an account that
 * would not record.
 *
 * `PageOptions.pathFor` and `PageOptions.servedAt` were never tried. Not
 * because anybody decided they were safe: the audit listed five of the ten
 * workspaces, and `apps/docs` was not one of the five. It was reported the day
 * the list was computed instead of written down.
 *
 * What they assert is the choice a generator has to make. A page whose picker
 * cannot be answered is not a page to emit with the picker left wrong — 1,784
 * of them would go out, each linking a reader somewhere that is not where they
 * were. Stopping is the smaller harm, and it is what happens; this says so, so
 * that a later `try` around the call is a decision somebody takes rather than a
 * kindness somebody adds.
 */

import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '@leela/content';
import { page } from '../src/render';

const options = (over: Record<string, unknown> = {}) => ({
  title: 'The human plane',
  language: 'en' as const,
  root: '../../',
  path: 'plans/41.html',
  description: 'a plan',
  body: '<p>a plan</p>',
  ...over,
});



describe('a page whose callbacks will not answer', () => {
  it('says which page it was building, and which question it was asking', () => {
    // The `hreflang` claim and the reader's picker both rest on `pathFor`. A
    // build that stops with only the callback's own words leaves whoever runs
    // it knowing that something could not say where a page lives, and not which
    // page, in which language, or which of the two questions it was.
    let reason = '';
    try {
      page(
        options({
          pathFor: () => {
            throw new Error('the catalogue is not loaded');
          },
        }),
      );
    } catch (error) {
      reason = (error as Error).message;
    }

    expect(reason).toContain('en/plans/41.html');
    expect(reason).toContain('pathFor');
    expect(reason).toContain('the catalogue is not loaded');
  });

  it('says the same about the other one, and names it apart', () => {
    let reason = '';
    try {
      page(
        options({
          pathFor: () => 'plans/41.html',
          servedAt: () => {
            throw new Error('the catalogue is not loaded');
          },
        }),
      );
    } catch (error) {
      reason = (error as Error).message;
    }

    expect(reason).toContain('servedAt');
    expect(reason).not.toContain('pathFor would not');
  });

  it('stops on the first one, rather than emitting the rest', () => {
    // A generator writes 1,784 files. Failing on the page that cannot be built
    // leaves a build to fix; carrying on leaves a book to find the holes in.
    const pages: string[] = [];
    const build = () => {
      for (const [at, language] of LANGUAGES.entries()) {
        pages.push(
          page(
            options({
              language,
              pathFor:
                at === 3
                  ? () => {
                      throw new Error('the catalogue is not loaded');
                    }
                  : () => 'plans/41.html',
            }),
          ),
        );
      }
    };

    expect(build).toThrow();
    expect(pages).toHaveLength(3);
  });

  it('is emitted when the callback answers "nowhere", which is an answer', () => {
    // The difference the whole pair exists for: `null` means this language does
    // not have this page, and the reader is sent to its contents. That is not a
    // failure and must not be treated as one.
    const html = page(options({ pathFor: () => null, servedAt: () => null }));

    expect(html).toContain('<nav class="languages"');
    expect(html).toContain('href="../../ru/"');
    // And nothing claims a translation that is not there.
    expect(html).not.toContain('hreflang="ru"');
  });

  it('is emitted when only the reader has somewhere to go', () => {
    // The legal pages: served in every language, translated into two.
    const html = page(options({ pathFor: () => null, servedAt: () => 'legal/policy.html' }));

    expect(html).toContain('href="../../ru/legal/policy.html"');
    expect(html).not.toContain('hreflang="ru"');
  });

  it('falls back to the honest answer when only one of the two is given', () => {
    // `servedAt` defaults to `pathFor`, which is right for every page but the
    // legal ones — and a caller that supplies neither gets the contents, which
    // is where this started.
    const html = page(options({ pathFor: () => 'plans/41.html' }));

    expect(html).toContain('href="../../ru/plans/41.html"');
    expect(html).toContain('hreflang="ru"');
  });
});
