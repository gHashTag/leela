import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { blank } from '../../../scripts/lib/source.mjs';

/**
 * Words the screen says, written past the catalogue.
 *
 * Four of them lived in `main.ts` for months — `from the text`, `model`,
 * `unanswered`, and the summary `What this rests on` — one line above the
 * `messageFor` that renders everything else. A Russian board printed them in
 * English beside Russian sentences, and the App Store's Russian screenshots
 * carried that English chrome into the shopfront. Nobody had written it down
 * as a rule, so nobody was wrong to add the fifth.
 *
 * The rule now: **a string the reader sees comes from `@leela/content`.** This
 * sweep reads the source blanked (comments are prose, and prose is allowed to
 * contain sentences), and it names what it finds rather than counting, so a
 * failure says which line to move.
 */
describe('every word the screen says', () => {
  /** Source with comments removed, per the repo-wide convention. */
  const sourceOf = (file: string): string =>
    blank(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'));

  /**
   * The label map, which is where this went wrong.
   *
   * A regex for "a sentence" was the first attempt and it did not catch the
   * defect it was written for: `'from the text'` starts with a small letter,
   * and the pattern wanted a capital. So this asks the precise question
   * instead — every value in the map is either a word from the catalogue or
   * deliberately empty — and it fails when a literal is put back, which is
   * how a guard earns being trusted.
   */
  it('reads the source labels from the catalogue, never from a literal', () => {
    const source = sourceOf('main.ts');
    const map = source.slice(
      source.indexOf('const SOURCE_LABEL'),
      source.indexOf('};', source.indexOf('const SOURCE_LABEL')),
    );

    expect(map, 'the map was not found; this guard is watching the wrong place').toContain(
      'canon:',
    );

    const literals = [...map.matchAll(/^\s*(\w+):\s*'([^']*)'/gm)]
      .filter(([, , said]) => said !== '')
      .map(([, key, said]) => `${key}: '${said}'`);

    expect(literals, 'move these into @leela/content and read them with messageFor').toEqual([]);
  });

  it('leaves index.html holding only what the script replaces', () => {
    // The markup has to say something before the script runs, so it says it in
    // English — and `main.ts` overwrites every one of those nodes once the
    // language is known. The ids below are that contract, and the test exists
    // so a fifth English node cannot be added without either being replaced or
    // being argued for here.
    // Blanked as the html it is: the markup carries comments explaining why
    // each English placeholder is there, and a sweep that reads them would
    // accuse the explanation of being the defect.
    const markup = blank(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), 'html');
    const script = sourceOf('main.ts');

    const spoken = [...markup.matchAll(/id="([a-z-]+)"[^>]*>([A-Z][a-z]+(?: [a-z]+)+)</g)].map(
      (found) => ({ id: found[1] as string, said: found[2] as string }),
    );

    const unreplaced = spoken.filter(({ id }) => {
      const camel = id.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
      return !script.includes(`el.${camel}.textContent = messageFor(`);
    });

    expect(unreplaced.map((one) => `${one.id}: ${one.said}`)).toEqual([]);
  });

  it('aligns language only after the chat game passes every adoption guard', () => {
    const source = sourceOf('main.ts');
    const stateGuard = source.indexOf('if (state === undefined)');
    const seatsGuard = source.indexOf('if (session.players.length !== 1)');
    const busyGuard = source.indexOf('if (busy) return;');
    const alignment = source.indexOf('alignWithChat(');
    const adoption = source.indexOf('chatGame = launch');

    expect(Math.min(stateGuard, seatsGuard, busyGuard, alignment, adoption)).toBeGreaterThan(-1);
    expect(alignment).toBeGreaterThan(stateGuard);
    expect(alignment).toBeGreaterThan(seatsGuard);
    expect(alignment).toBeGreaterThan(busyGuard);
    expect(alignment).toBeLessThan(adoption);
  });
});
