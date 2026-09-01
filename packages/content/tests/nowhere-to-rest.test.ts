/**
 * A text that arrives as one paragraph where every other language has three.
 *
 * Plans 12 and 24 in Arabic, Malay and Ukrainian, and four chapters besides:
 * the words are all there — seventy to a hundred per cent of the characters the
 * other languages use — and not one blank line among them. A reader of those
 * three meets a wall where everybody else is given somewhere to rest.
 *
 * The three come from `leela/src/locales`, whose plan text is one JSON string.
 * `paragraphed` restores the breaks where that donor wrote single newlines —
 * that repair is `paragraphs.test.ts`, and it is why the other sixty-nine plans
 * in those languages read properly. For these it wrote none at all, so there is
 * nothing to restore.
 *
 * **Reported rather than repaired.** Deciding where a paragraph ends in
 * somebody else's translation is deciding what their text says, which is the
 * line `lib/corrections.mjs` draws and does not cross: the bar there is
 * *checkably wrong — arithmetic, not judgement*.
 *
 * So this asserts the shape of the reporting rather than the list: whatever
 * ships as one paragraph while most languages give it several is named in the
 * manifest. A new language that arrives this way is seen on the day it arrives,
 * and a repair upstream shows up as a name that is no longer there.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANGUAGES, plansFor, rulesFor, EVERY_LANGUAGE_MS,
  loadEveryLanguage } from '../src/index';

const manifest = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'data', 'manifest.json'), 'utf8'),
) as { warnings: string[] };

const blocks = (text: string) => text.split(/\n{2,}/).filter((part) => part.trim().length > 0).length;
const middle = (numbers: number[]) => [...numbers].sort((a, b) => a - b)[Math.floor(numbers.length / 2)] ?? 0;

/** Every text a reader can open, gathered by what it is rather than by language. */
function everyText(): Map<string, Map<string, string>> {
  const texts = new Map<string, Map<string, string>>();

  const put = (key: string, language: string, body: string) => {
    if (!texts.has(key)) texts.set(key, new Map());
    texts.get(key)?.set(language, body);
  };

  for (const language of LANGUAGES) {
    for (const plan of plansFor(language)) put(`plan ${plan.plan}`, language, String(plan.body ?? ''));
    for (const chapter of rulesFor(language)) {
      put(`chapter ${chapter.slug}`, language, String(chapter.body ?? ''));
    }
  }

  return texts;
}

/** What ships as one paragraph where most languages give the same text several. */
function walls(): string[] {
  const found: string[] = [];

  for (const [key, byLanguage] of everyText()) {
    const counts = [...byLanguage.values()].map(blocks);
    if (middle(counts) < 3) continue;

    // Only where the words are there. A translation that is half the length of
    // every other is a different finding, and the audits have it.
    const usual = middle([...byLanguage.values()].map((body) => body.length));
    for (const [language, body] of byLanguage) {
      if (blocks(body) === 1 && body.length > usual * 0.6) found.push(`${language} ${key}`);
    }
  }

  return found.sort();
}

describe('a text with nowhere for the eye to rest', () => {
  it('is never shipped without the build saying so', () => {
    // The shape. Not "these sixteen" — a seventeenth is the thing this exists
    // to catch, and it would pass a list.
    const unsaid = walls().filter(
      (wall) => !manifest.warnings.some((warning) => warning.startsWith(`${wall}:`)),
    );

    expect(unsaid).toEqual([]);
  });

  it('is not reported where there is nothing to report', () => {
    // The other half, and the reason the first assertion is not satisfied by a
    // build that warns about everything: a name in the manifest that is no
    // longer a wall is a repair nobody noticed, and it should go.
    const said = manifest.warnings
      .filter((warning) => warning.endsWith(': one paragraph, where most languages have several'))
      .map((warning) => warning.split(':')[0] ?? '');

    expect(said.filter((name) => !walls().includes(name))).toEqual([]);
  });

  it('still finds some, so the check is about something', () => {
    // Zero would mean either that the donor was repaired — in which case this
    // file and the build's report should go — or that the comparison stopped
    // matching, which looks exactly the same from here.
    expect(walls().length).toBeGreaterThan(5);
  });

  it('leaves the languages that were repaired alone', () => {
    // `paragraphed` gave these three their other plans back. If this check ever
    // names most of a language's plans, that repair has come undone rather than
    // the donor having got worse.
    for (const language of ['ar', 'ms', 'uk']) {
      const whole = plansFor(language).filter((plan) => blocks(String(plan.body ?? '')) > 1);

      expect({ language, paragraphed: whole.length > 60 }).toEqual({ language, paragraphed: true });
    }
  });
});

/**
 * Every language's text, in memory, before anything asks for it.
 *
 * Twenty-one of the twenty-two are loaded on demand now — the board's entry
 * carried 6.6 MB of plan text to a reader of one language, and only English is
 * static because it is the fallback. A suite that reads other languages has to
 * say so, and this is that saying: without it these tests would quietly
 * measure English twenty-two times and pass.
 */
beforeAll(loadEveryLanguage, EVERY_LANGUAGE_MS);

