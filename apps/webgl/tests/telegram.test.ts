import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { blank } from '../../../scripts/lib/source.mjs';

import { meetTelegram, nameAskOrigin, telegramOf, themeVars } from '../src/telegram';

/**
 * Everything this file guards arrives from software this repository does not
 * build: Telegram's script puts an object on `window`, its theme values are
 * whatever the host wrote, and the build's environment is a string somebody
 * typed into a workflow. So the shape of the defect is always the same — a
 * foreign value trusted onto the page — and every assertion here feeds a
 * foreign value that must not get through.
 */

/** Telegram's own dark defaults, the realistic case. */
const DARK = {
  bg_color: '#212121',
  text_color: '#ffffff',
  hint_color: '#aaaaaa',
  button_color: '#8774e1',
  button_text_color: '#ffffff',
  secondary_bg_color: '#181818',
  section_separator_color: '#222222',
};

/** Every themeParams key the mapping reads. */
const MAPPED = Object.keys(DARK);

const fakeStyle = (): { held: Array<[string, string]>; setProperty(n: string, v: string): void } => ({
  held: [],
  setProperty(name, value) {
    this.held.push([name, value]);
  },
});

// --- the theme mapping ------------------------------------------------------

describe('themeVars', () => {
  it('maps a dark host onto the page tokens, pairs travelling together', () => {
    expect(themeVars('dark', DARK)).toEqual([
      ['--bg', '#212121'],
      ['--text', '#ffffff'],
      ['--hint', '#aaaaaa'],
      // One Telegram ground, both page layers: a layer left on its own dark
      // value under the host's ink is a broken pair.
      ['--surface', '#181818'],
      ['--surface-2', '#181818'],
      ['--accent', '#8774e1'],
      ['--on-accent', '#ffffff'],
      ['--rule', '#222222'],
    ]);
  });

  /**
   * A token written here and declared by nobody is a write to a variable
   * nothing reads — `--muted` in the mini app was exactly that, for as long as
   * it had been used. The stylesheet is the single consumer, so every name the
   * mapping produces must be one it declares.
   */
  it('writes only tokens the stylesheet declares', () => {
    const sheet = blank(readFileSync(new URL('../src/style.css', import.meta.url), 'utf8'), 'css');
    for (const [token] of themeVars('dark', DARK)) {
      expect(sheet, `${token} is not declared in style.css`).toContain(`${token}:`);
    }
  });

  /**
   * The page has one palette and it is dark — `theme.ts` opens with why the
   * light one was deleted. A light host applying its grounds under tones
   * measured for dark ones would rebuild that deleted palette at runtime.
   */
  it('maps nothing for a host that is not dark', () => {
    for (const scheme of ['light', 'LIGHT', 'Dark', undefined, null, 1, {}]) {
      expect(themeVars(scheme, DARK)).toEqual([]);
    }
  });

  it('maps nothing from params that are not an object', () => {
    for (const params of [undefined, null, 'dark', 42, true]) {
      expect(themeVars('dark', params)).toEqual([]);
    }
  });

  /**
   * `setProperty` stores any token stream, and garbage parked in `--bg` makes
   * `background: var(--bg)` compute to nothing at the point of use. Checked
   * key by key across every key the mapping reads: a guard that only faces one
   * phrasing of bad certifies nothing about the others.
   */
  it('refuses, per key, every value that is not a #rrggbb colour', () => {
    const garbage = [
      'red',
      '#fff',
      '#12345',
      '#1234567',
      '#12345g',
      'rgb(0 0 0)',
      'url(evil)',
      ' #212121',
      '#212121;--x:y',
      42,
      null,
      undefined,
      {},
      ['#212121'],
    ];
    for (const key of MAPPED) {
      for (const bad of garbage) {
        const held = themeVars('dark', { ...DARK, [key]: bad });
        // The poisoned key produced nothing; the honest keys still landed.
        expect(held.length).toBe(themeVars('dark', DARK).length - (key === 'secondary_bg_color' ? 2 : 1));
        for (const [, colour] of held) expect(colour).not.toBe(bad);
      }
    }
  });

  it('accepts upper-case hex, which is a colour however Telegram cases it', () => {
    expect(themeVars('dark', { bg_color: '#ABCDEF' })).toEqual([['--bg', '#ABCDEF']]);
  });
});

// --- the greeting -----------------------------------------------------------

describe('meetTelegram', () => {
  it('does nothing at all in a plain browser', () => {
    const style = fakeStyle();
    // Node has no `Telegram`, which is exactly the plain-browser case.
    expect(telegramOf()).toBeNull();
    expect(() => meetTelegram(telegramOf(), style)).not.toThrow();
    expect(style.held).toEqual([]);
  });

  it('greets a dark host and hands its colours to the page', () => {
    const called: string[] = [];
    const style = fakeStyle();
    meetTelegram(
      {
        ready: () => called.push('ready'),
        expand: () => called.push('expand'),
        colorScheme: 'dark',
        themeParams: DARK,
      },
      style,
    );
    expect(called).toEqual(['ready', 'expand']);
    expect(style.held).toEqual([...themeVars('dark', DARK)]);
  });

  it('greets a light host and leaves the page its own palette', () => {
    const called: string[] = [];
    const style = fakeStyle();
    meetTelegram(
      {
        ready: () => called.push('ready'),
        expand: () => called.push('expand'),
        colorScheme: 'light',
        themeParams: { ...DARK, bg_color: '#ffffff' },
      },
      style,
    );
    // The handshake is host protocol either way; only the colours stay home.
    expect(called).toEqual(['ready', 'expand']);
    expect(style.held).toEqual([]);
  });
});

describe('telegramOf', () => {
  /**
   * A page's globals are things other software puts values into. Every shape
   * short of the real one answers null rather than becoming a crash inside
   * `ready()`.
   */
  it('answers null for every shape that is not a host', () => {
    const page = globalThis as { Telegram?: unknown };
    const wrong = [
      undefined,
      null,
      'WebApp',
      {},
      { WebApp: null },
      { WebApp: 'ready' },
      { WebApp: {} },
      { WebApp: { ready: () => {} } },
      { WebApp: { ready: 1, expand: () => {} } },
      { WebApp: { ready: () => {}, expand: 'expand' } },
    ];
    try {
      for (const shape of wrong) {
        page.Telegram = shape;
        expect(telegramOf()).toBeNull();
      }
      const app = { ready: () => {}, expand: () => {}, colorScheme: 'dark', themeParams: DARK };
      page.Telegram = { WebApp: app };
      expect(telegramOf()).toBe(app);
    } finally {
      delete page.Telegram;
    }
  });
});

// --- the ask origin ---------------------------------------------------------

describe('nameAskOrigin', () => {
  it('writes a non-empty origin onto the page', () => {
    const page: { __leelaAsk?: string } = {};
    nameAskOrigin(page, 'https://leela-production-e9a0.up.railway.app');
    expect(page.__leelaAsk).toBe('https://leela-production-e9a0.up.railway.app');
  });

  /**
   * Untouched means *absent*, not set to something empty: `askUrl()` falls
   * back to the relative path only when nothing is there, and an empty string
   * written here would still be a value another reader has to reason about.
   */
  it('leaves the page untouched when the build did not say', () => {
    for (const unsaid of [undefined, '', null, 42, {}, ['x']]) {
      const page: { __leelaAsk?: string } = {};
      nameAskOrigin(page, unsaid);
      expect('__leelaAsk' in page).toBe(false);
    }
  });

  it('does not erase an origin a host already named', () => {
    const page: { __leelaAsk?: string } = { __leelaAsk: 'https://host.example' };
    nameAskOrigin(page, undefined);
    expect(page.__leelaAsk).toBe('https://host.example');
  });
});
