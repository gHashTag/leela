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
import { REPORTS_KEY, type Keeper } from './journal';

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
