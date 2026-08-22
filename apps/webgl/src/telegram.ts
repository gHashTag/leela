/**
 * The page, when somebody else is hosting it.
 *
 * The bot's Web App button opens this board inside Telegram's webview, and a
 * guest there has two duties: announce itself — `ready()`, and `expand()` for
 * the room the host holds back until asked — and not fight the host's
 * furniture, which is the theme. In a plain browser there is no host, nothing
 * here runs, and the page is exactly what it was before this file existed.
 *
 * No SDK. `telegram-web-app.js` is a script tag in `index.html`, the same one
 * the mini app carries, and everything it defines arrives as an untyped object
 * on `window`. The interface below is the four members this file touches and
 * nothing more: typing the rest would be writing down promises about software
 * this repository does not build.
 */

interface TelegramWebApp {
  ready(): void;
  expand(): void;
  /** `'light' | 'dark'` when Telegram wrote it; unknown until checked. */
  readonly colorScheme?: unknown;
  /** `#rrggbb` strings when Telegram wrote them; unknown until checked. */
  readonly themeParams?: unknown;
}

/**
 * The host, if there is one.
 *
 * Validated rather than cast: a page's globals are things other software puts
 * values into, and calling `ready` on whatever happens to be under the name
 * turns somebody else's object into this page's crash. Absent, or the wrong
 * shape, is a plain browser and the answer is null.
 *
 * Present is not proof of Telegram. The script that defines `WebApp` is served
 * from telegram.org and defines it in *any* browser — the mini app documents
 * that trap for `sendData`, where it drew a dead button. Here the greeting is
 * harmless either way: outside Telegram `ready()` and `expand()` reach nobody,
 * and an empty `themeParams` maps to nothing.
 */
export const telegramOf = (): TelegramWebApp | null => {
  const found = (globalThis as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp;
  if (typeof found !== 'object' || found === null) return null;
  const held = found as { ready?: unknown; expand?: unknown };
  return typeof held.ready === 'function' && typeof held.expand === 'function'
    ? (found as TelegramWebApp)
    : null;
};

/**
 * Which of Telegram's colours lands on which of the page's own tokens.
 *
 * The rail is the one the app already rides: `style.css` declares the custom
 * properties, script writes them with `setProperty` — the way `--lotus` takes
 * the seat's colour. One mechanism, so the host's theme and the page's own
 * cannot give two answers to the same question.
 *
 * Pairs travel together. A theme's `text_color` is measured against its
 * `bg_color` the way `theme.ts` measures a label against the field it sits on,
 * so taking a ground without its ink is the exact defect that file catalogues
 * four times over. `secondary_bg_color` therefore lands on both surface
 * layers: the page keeps two and Telegram offers one, and a layer left behind
 * on its own dark value under the host's ink is a broken pair.
 */
const GUEST_VARS: ReadonlyArray<readonly [param: string, token: string]> = [
  ['bg_color', '--bg'],
  ['text_color', '--text'],
  ['hint_color', '--hint'],
  ['secondary_bg_color', '--surface'],
  ['secondary_bg_color', '--surface-2'],
  ['button_color', '--accent'],
  ['button_text_color', '--on-accent'],
  ['section_separator_color', '--rule'],
];

/**
 * What Telegram documents its theme values as, and the only shape let through.
 *
 * `setProperty` is not a gate: a custom property stores any token stream, and
 * garbage parked in `--bg` makes `background: var(--bg)` compute to nothing at
 * the point of use — the page loses its ground with no error anywhere. So a
 * value that is not a colour is dropped here, where dropping it costs one
 * variable, not the element that reads it.
 */
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The host's theme, as writes onto the page's tokens. Pure, so a test can hold
 * the mapping without a document.
 *
 * Only a dark host maps at all. `theme.ts` opens with why the light palette
 * was deleted: it was a second design nobody had ever looked at, and this
 * board hangs in a vacuum a light scheme contradicts. Wiring a light theme's
 * grounds under tones measured for dark ones would rebuild that deleted
 * palette at runtime, one carried colour at a time. A light-themed Telegram
 * gets the page's own dark chrome — exactly what a light-mode browser gets
 * today, and the page's `color-scheme: dark` already says so.
 */
export const themeVars = (
  scheme: unknown,
  params: unknown,
): ReadonlyArray<readonly [token: string, colour: string]> => {
  if (scheme !== 'dark') return [];
  if (typeof params !== 'object' || params === null) return [];
  const held = params as Record<string, unknown>;
  return GUEST_VARS.flatMap(([param, token]) => {
    const colour = held[param];
    return typeof colour === 'string' && HEX.test(colour) ? [[token, colour] as const] : [];
  });
};

/**
 * The whole greeting: readiness, room, and the host's colours onto `style`.
 *
 * Takes the host and the style rather than reading `globalThis` and
 * `document` itself — the same reason `theme.ts`'s scheme chooser takes the
 * match: the caller owns the environment and this stays testable. `null` is a
 * plain browser and does nothing, which is the degradation the mini app
 * already practises.
 */
export const meetTelegram = (
  app: TelegramWebApp | null,
  style: { setProperty(name: string, value: string): void },
): void => {
  if (!app) return;
  app.ready();
  app.expand();
  for (const [token, colour] of themeVars(app.colorScheme, app.themeParams)) {
    style.setProperty(token, colour);
  }
};

/**
 * Where the companion's questions go, when the build knows better than the
 * page.
 *
 * `askUrl()` reads `__leelaAsk` on every call and falls back to a relative
 * path — right when the page and the route share an origin, wrong on Pages,
 * where the route lives on the bot's Railway service and a relative `/api/ask`
 * reaches a static host that has never heard of it. The build carries the
 * origin in `VITE_ASK_ORIGIN`; the entry writes it here before anything can
 * ask.
 *
 * Only a non-empty string is written. An unset variable is a build that did
 * not say, not a build that said *nowhere* — and a page whose host has already
 * named an origin must not have it erased by a build that was silent.
 */
export const nameAskOrigin = (page: { __leelaAsk?: string }, origin: unknown): void => {
  if (typeof origin === 'string' && origin !== '') page.__leelaAsk = origin;
};
