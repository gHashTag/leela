import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Shared with the audit scripts, which are plain JavaScript.
import { blank } from '../../../scripts/lib/source.mjs';
import { FALLBACK_LANGUAGE, messageFor, translatedLanguages } from '@leela/content';
import { BOT_COMMANDS, PAID_COMMANDS, help, menuFor } from '../src/commands';

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
const BOT = blank(readFileSync(join(HERE, '..', 'src', 'bot.ts'), 'utf8'));

/** What the bot answers, read from the handlers rather than from a list. */
const answered = [...BOT.matchAll(/bot\.command\('([a-z]+)'/g)].map(([, name]) => name);

/** What the help text offers, read from the sentence a player is shown. */
const offered = (language: string): string[] => {
  const help = messageFor(language, 'help');
  return [...help.matchAll(/\/([a-z]+)/g)].map(([, name]) => name);
};

/**
 * Commands an operator has and a player must never be shown.
 *
 * `/refund` moves money. It is registered only where `LEELA_STARS_OPERATORS`
 * names somebody, it answers only them, and to everybody else it falls through
 * to the ordinary *I do not know that one* — so a menu entry or a help line for
 * it would invite every player to try a command that will not answer them.
 * Named here rather than exported from `commands.ts` for the same reason: a
 * list of it beside the menu is where somebody eventually puts it in the menu.
 */
const OPERATOR_ONLY = new Set(['refund']);

/** Commands that exist only where a deployment has priced the Stars rail. */
const PAID = new Set(PAID_COMMANDS.map((one) => one.command));

describe('every command the bot answers', () => {
  it('is in the menu, or is one of the two kinds that must not be', () => {
    const inMenu = new Set(BOT_COMMANDS.map((one) => one.command));
    const missing = answered.filter(
      (name) => !inMenu.has(name) && !PAID.has(name) && !OPERATOR_ONLY.has(name),
    );

    expect(answered.length, 'no handlers found — the reader is wrong').toBeGreaterThan(0);
    // A command classified as neither still fails here, which is the point: a
    // registration nobody has said anything about is the thing being caught.
    expect(missing, 'answered but not offered in the menu').toEqual([]);
  });

  it('is in the help text, except the help text itself', () => {
    // A help text that lists itself is noise. The menu carries `/help` because
    // a menu that omits the way to read the help is the trap this closes.
    const listed = new Set(offered(FALLBACK_LANGUAGE));
    const missing = answered.filter(
      (name) => name !== 'help' && !listed.has(name) && !PAID.has(name) && !OPERATOR_ONLY.has(name),
    );

    expect(missing, 'answered but not in the help text').toEqual([]);
    expect(listed.has('help'), 'the help text lists itself').toBe(false);
    expect(BOT_COMMANDS.some((one) => one.command === 'help')).toBe(true);
  });
});

describe('a command that exists only where a price does', () => {
  /**
   * The Stars rail is dark unless a deployment names a price, and *dark* has to
   * mean the surface is not offered either: a menu entry or a help line for
   * `/pro` in a deployment that registers no `/pro` is exactly the failure the
   * rest of this file exists to prevent, pointed the other way.
   */
  it('is absent from the menu and the help a dark deployment publishes', () => {
    const standing = new Set(BOT_COMMANDS.map((one) => one.command));

    for (const one of PAID_COMMANDS) {
      expect(standing.has(one.command), `${one.command} is in the standing menu`).toBe(false);
      expect(menuFor(FALLBACK_LANGUAGE).map((entry) => entry.command)).not.toContain(one.command);

      for (const language of translatedLanguages()) {
        expect(offered(language), `${language} help names ${one.command}`).not.toContain(
          one.command,
        );
        // The help a bot with no price prints, byte for byte the catalogue's.
        expect(help(language).replies[0]?.text).toBe(messageFor(language, 'help'));
      }
    }
  });

  it('is in both the moment a deployment switches it on', () => {
    for (const language of translatedLanguages()) {
      const menu = menuFor(language, PAID_COMMANDS);
      const said = help(language, PAID_COMMANDS).replies[0]?.text ?? '';

      expect(menu).toHaveLength(BOT_COMMANDS.length + PAID_COMMANDS.length);

      for (const one of PAID_COMMANDS) {
        const entry = menu.find((each) => each.command === one.command);
        expect(entry?.description.trim().length, `${language}/${one.command}`).toBeGreaterThan(0);
        expect(entry?.description.length).toBeLessThanOrEqual(256);
        // And the help says it too, or a player has a menu entry and no
        // explanation of what it is for.
        expect(said, `${language} help offers /${one.command}`).toContain(`/${one.command}`);
      }
    }
  });

  it('says something different in each language, like every other entry', () => {
    // The same guard the standing menu gets: a description identical in Russian
    // and English is a catalogue hole that `messageFor` filled silently.
    const english = menuFor('en', PAID_COMMANDS).map((one) => one.description);
    const russian = menuFor('ru', PAID_COMMANDS).map((one) => one.description);

    expect(russian).not.toEqual(english);
    for (const [index, entry] of russian.entries()) {
      expect(entry, `menu ${index} is not translated`).not.toBe(english[index]);
    }
  });
});

describe('a command only an operator has', () => {
  it('is offered nowhere at all, in any language', () => {
    const named = new Set([...BOT_COMMANDS, ...PAID_COMMANDS].map((one) => one.command));

    for (const command of OPERATOR_ONLY) {
      expect(named.has(command), `${command} is offered in a menu`).toBe(false);

      for (const language of translatedLanguages()) {
        expect(offered(language), `${language} help names ${command}`).not.toContain(command);
        expect(
          help(language, PAID_COMMANDS).replies[0]?.text ?? '',
          `${language} priced help names ${command}`,
        ).not.toContain(`/${command}`);
      }
    }
  });

  it('is a command this bot really registers, or the rule guards nothing', () => {
    // The guard on the guard. If `/refund` were renamed, this list would go on
    // excusing a name nothing answers while the real command went unclassified
    // — which is how an exemption outlives the thing it exempted.
    for (const command of OPERATOR_ONLY) {
      expect(answered, `${command} is excused and answered by nothing`).toContain(command);
    }
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
