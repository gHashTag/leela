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

export function deviceKeeper(): Keeper {
  return {
    async read() {
      try {
        return await AsyncStorage.getItem(REPORTS_KEY);
      } catch {
        // A store that cannot be read is a store with nothing in it. The path
        // starts empty and this run's writing will try to land on top of it.
        return null;
      }
    },

    async write(value: string) {
      try {
        await AsyncStorage.setItem(REPORTS_KEY, value);
        return true;
      } catch {
        return false;
      }
    },
  };
}
