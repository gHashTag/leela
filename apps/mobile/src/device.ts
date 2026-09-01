/**
 * The store a device actually has.
 *
 * The one file in this app that knows what a phone is. Everything else takes a
 * `Keeper` and is happy with a `Map`, which is what makes the path testable
 * without a simulator — and what makes this file small enough to read in one
 * sitting.
 *
 * `AsyncStorage` because the published app used it: `OfflinePlayers.ts` in
 * `leela` keeps its six players there through `mobx-persist-store`. Same
 * dependency, same place on the device, so a phone that has played the old app
 * and the new one is not keeping two unrelated things in two unrelated ways.
 *
 * What it does *not* do is decide anything about failure. `write` answers false
 * where the library throws, and what to say about that is the screen's business
 * — the mistake this repository has now made and fixed on four surfaces is a
 * writer that swallows a refusal and lets its caller report success.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import { REPORTS_KEY, type Keeper } from './journal';

/**
 * What language the phone is set to, as a locale tag, or nothing.
 *
 * The app asked for none. `App.tsx` said `resolveLanguage(undefined)` — a
 * literal, hard-coded — so a game published in twenty-two languages showed
 * **English to everybody**, on a device that has known its own language since
 * it was switched on.
 *
 * Every other surface asks. The bot reads `ctx.from?.language_code`, the mini
 * app reads Telegram's user language and then `navigator.language`, and the app
 * this one replaces read `RNLocalize.getLocales()[0].languageCode` and served
 * ten languages from it (`src/i18n.ts` in `leela`). Only the phone declared an
 * answer instead of asking a question — and it declared the fallback, which is
 * the one answer that looks correct from an English desk.
 *
 * Three sources, in the order they are trustworthy. `Intl` is the language the
 * platform would format a date in, which is the question being asked, and
 * Hermes carries the platform's own locale data on both. The two native
 * settings are what `react-native-localize` reads underneath, kept for a build
 * whose Hermes was compiled without them: `AppleLocale` is `ru_RU`,
 * `localeIdentifier` is `ru_RU` too, and `resolveLanguage` takes either.
 *
 * Nothing rather than a guess when none of them answers. A locale invented here
 * would be indistinguishable from a phone that really is in English.
 */
export function deviceLocale(): string | undefined {
  try {
    const formatted = Intl.DateTimeFormat().resolvedOptions().locale;
    if (typeof formatted === 'string' && formatted !== '') return formatted;
  } catch {
    // A runtime built without Intl. The natives below are the same answer.
  }

  try {
    const apple = NativeModules.SettingsManager?.settings;
    const ios = apple?.AppleLocale ?? apple?.AppleLanguages?.[0];
    if (typeof ios === 'string' && ios !== '') return ios;

    const android = NativeModules.I18nManager?.localeIdentifier;
    if (typeof android === 'string' && android !== '') return android;
  } catch {
    // Neither module is present off a device — under vitest, for one.
  }

  return undefined;
}

/**
 * A keeper for one key.
 *
 * The path was the only thing this app kept, so the key was written into the
 * two methods. The game is kept now too — the phone used to lose the board on
 * every launch while holding on to what the player wrote about it — and two
 * things kept in one slot would overwrite each other silently.
 *
 * The key is a parameter rather than a second `deviceKeeper`, so this stays the
 * one file that knows what a phone is. `identity`-style: `no-rules.test.ts`
 * asserts that nothing else imports anything native.
 */
export function deviceKeeper(key: string = REPORTS_KEY): Keeper {
  return {
    async read() {
      try {
        return await AsyncStorage.getItem(key);
      } catch {
        // A store that cannot be read is a store with nothing in it. The path
        // starts empty and this run's writing will try to land on top of it.
        return null;
      }
    },

    async write(value: string) {
      try {
        await AsyncStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
  };
}
