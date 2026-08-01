import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FALLBACK_LANGUAGE, messageFor, translatedLanguages } from '@leela/content';
import { BOT_COMMANDS, menuFor } from '../src/commands';

/**
 * The three places this bot's commands are written down, held to each other.
 *
 * Telegram shows a menu behind the `/` button and this bot registered nothing:
 * sixteen commands, and a player had to already know `/help` existed in order
 * to be told about the other fifteen. `/help` was not in the menu either,
 * because there was no menu.
 *
 * Publishing one adds a *fourth* list of the same names, and this repository has
 * had six restated lists go wrong — Dockerfile manifests, README test counts,
 * this bot's own command list, its help text, `StoredSeat`, and CI's
 * `for pkg in …`. Every one of them was found the same way: somebody read two
 * of the copies and they disagreed.
 *
 * So the lists are not kept in step by hand. `bot.command('x')` is what the bot
 * actually answers, and both the help text and the menu are held to it here.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const BOT = readFileSync(join(HERE, '..', 'src', 'bot.ts'), 'utf8');

/** What the bot answers, read from the handlers rather than from a list. */
const answered = [...BOT.matchAll(/bot\.command\('([a-z]+)'/g)].map(([, name]) => name);

/** What the help text offers, read from the sentence a player is shown. */
const offered = (language: string): string[] => {
  const help = messageFor(language, 'help');
  return [...help.matchAll(/\/([a-z]+)/g)].map(([, name]) => name);
};

describe('every command the bot answers', () => {
  it('is in the menu', () => {
    const inMenu = new Set(BOT_COMMANDS.map((one) => one.command));
    const missing = answered.filter((name) => !inMenu.has(name));

    expect(answered.length, 'no handlers found — the reader is wrong').toBeGreaterThan(0);
    expect(missing, 'answered but not offered in the menu').toEqual([]);
  });

  it('is in the help text, except the help text itself', () => {
    // A help text that lists itself is noise. The menu carries `/help` because
    // a menu that omits the way to read the help is the trap this closes.
    const listed = new Set(offered(FALLBACK_LANGUAGE));
    const missing = answered.filter((name) => name !== 'help' && !listed.has(name));

    expect(missing, 'answered but not in the help text').toEqual([]);
    expect(listed.has('help'), 'the help text lists itself').toBe(false);
    expect(BOT_COMMANDS.some((one) => one.command === 'help')).toBe(true);
  });
});

describe('nothing is offered that the bot does not answer', () => {
  it('holds the menu to the handlers', () => {
    const real = new Set(answered);
    const ghosts = BOT_COMMANDS.filter((one) => !real.has(one.command));

    // The direction that costs a player the most: a menu entry that does
    // nothing is worse than a command nobody can find, because they tried it.
    expect(ghosts.map((one) => one.command), 'in the menu, answered by nothing').toEqual([]);
  });

  it('holds the help text to them too, in every language it is written in', () => {
    const real = new Set(answered);

    for (const language of translatedLanguages()) {
      const ghosts = offered(language).filter((name) => !real.has(name));
      expect(ghosts, `${language}: offered, answered by nothing`).toEqual([]);
    }
  });
});

describe('the menu as Telegram will take it', () => {
  it('is written in every language whose catalogue is complete', () => {
    // Not all twenty-two: `messageFor` falls back to English for a language
    // with no catalogue, and a menu registered as Russian holding English
    // sentences is worse than no Russian menu — Telegram would stop falling
    // back to the default for those clients.
    for (const language of translatedLanguages()) {
      const menu = menuFor(language);
      expect(menu, language).toHaveLength(BOT_COMMANDS.length);
      for (const entry of menu) {
        expect(entry.description.trim().length, `${language}/${entry.command}`).toBeGreaterThan(0);
      }
    }
  });

  it('says something different in each of them', () => {
    // The guard against a translation that silently is not one: if Russian and
    // English agree word for word, the catalogue has a hole and `messageFor`
    // fell back without saying so.
    const english = menuFor('en').map((one) => one.description);
    const russian = menuFor('ru').map((one) => one.description);

    expect(russian).not.toEqual(english);
    for (const [index, entry] of russian.entries()) {
      expect(entry, `menu ${index} is not translated`).not.toBe(english[index]);
    }
  });

  it('keeps every description inside what Telegram accepts', () => {
    // 256 characters, and it refuses the *whole call* rather than the one
    // entry — so one sentence that grows in translation takes the menu down.
    for (const language of translatedLanguages()) {
      for (const entry of menuFor(language)) {
        expect(entry.description.length, `${language}/${entry.command}`).toBeLessThanOrEqual(256);
      }
    }
  });

  it('names commands the way Telegram requires', () => {
    // Lowercase Latin, digits and underscores, 1–32 characters, and no slash.
    for (const one of BOT_COMMANDS) {
      expect(one.command, one.command).toMatch(/^[a-z0-9_]{1,32}$/);
    }
  });

  it('registers each command once', () => {
    const names = BOT_COMMANDS.map((one) => one.command);
    expect(new Set(names).size, 'a command listed twice').toBe(names.length);
  });
});
