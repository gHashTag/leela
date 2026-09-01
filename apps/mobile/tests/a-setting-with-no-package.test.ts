import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A setting the manifest declares and the build does not carry.
 *
 * `app.json` said `"userInterfaceStyle": "automatic"` — follow the phone's
 * light/dark setting — and `package.json` declared no `expo-system-ui`. Expo
 * needs that package for the property to reach an Android build, and
 * `expo prebuild` prints a WARNING rather than an error. So the app published
 * as `com.leelagame` shipped a manifest promising a behaviour its own build
 * does not have, and nothing said a word: this repository has twenty-one audits
 * and not one of them reads an app manifest.
 *
 * It was found by a dependency reader, `knip`, whose Expo plugin knows which
 * config keys imply which packages. This file asks the same question with no
 * tool in it, because a rule that lives only in a devDependency's plugin is a
 * rule that leaves when the devDependency does.
 *
 * ---
 *
 * WHAT IS ASSERTED IS THE SHAPE, not the key that was wrong.
 *
 * `app.json` is walked whole — every path under `expo`, containers and leaves,
 * however deep — and each one is looked up in `NEEDS` below. A key added
 * tomorrow is checked tomorrow, without anybody remembering to come back here.
 * The direction matters: iterating the *config* and consulting the map catches
 * a new setting; iterating the map would only ever re-check the settings
 * somebody already thought of.
 *
 * The map itself is checked too, further down, because a list of exceptions
 * that nothing verifies is the defect this repository has now met four times.
 *
 * ---
 *
 * WHERE THE MAP COMES FROM.
 *
 * Each entry was read out of `knip`'s Expo plugin — `getDependencies` in
 * `node_modules/knip/dist/plugins/expo/helpers.js`, which encodes Expo's own
 * documented requirements — and then written here as a predicate over the
 * value, so this file needs neither knip nor a network to run. The two readers
 * share no code and agree on the same rules, which is the only reason a map
 * this small is trustworthy at all.
 *
 * Deliberately NOT included: keys whose package requirement could not be read
 * out of something in this tree. `splash`, `scheme` and `assetBundlePatterns`
 * have all moved between the SDK and a plugin across Expo versions, and a rule
 * asserted from memory is exactly the kind that names an innocent and gets
 * switched off. An absent rule is a gap this comment records; a wrong rule is
 * a check somebody deletes.
 */

/** `app.json`, which is what a release is built from — not `app.config.ts`. */
const CONFIG = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'app.json'), 'utf8'),
) as { expo: Record<string, unknown> };

/** This workspace's manifest, read for what it actually declares. */
const MANIFEST = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'),
) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

/**
 * A config key, and the packages a given value of it requires.
 *
 * `needs` returns the packages rather than a boolean because the requirement is
 * a property of the *value*, not of the key: `updates` needs `expo-updates`
 * unless it says `enabled: false`, and `plugins` needs whatever it names. A
 * boolean cannot express either.
 *
 * `witness` is how the predicate is held to doing something. `set` must require
 * exactly `requires`; `inert`, where such a value exists, must require nothing.
 * A predicate that always returns `[]` is a rule that never fires, and it would
 * pass every other test in this file.
 *
 * `absent` is the written reason an entry is kept while `app.json` does not set
 * its key. Every entry needs one or the other — a key in the config, or a
 * sentence.
 */
type Rule = {
  /** The path under `expo`, dotted: `userInterfaceStyle`, `ios.backgroundColor`. */
  key: string;
  needs: (value: unknown) => string[];
  witness: { set: unknown; requires: string[]; inert: unknown | null };
  absent?: string;
};

/** Set to anything at all, this key needs that package. Absence is the only way out. */
const whenSet = (pkg: string) => (value: unknown) => (value ? [pkg] : []);

const NEEDS: Rule[] = [
  {
    // The one that was wrong. It is deleted from `app.json` rather than given
    // its package, and the reason is in `knip.config.mjs` at length: this app
    // has one palette, `#faf7f2`, with no dark half, and `<StatusBar
    // style="auto" />` draws white glyphs over it the moment the scheme is
    // dark. Honouring the declaration would have blanked the top of the screen.
    key: 'userInterfaceStyle',
    needs: whenSet('expo-system-ui'),
    witness: { set: 'automatic', requires: ['expo-system-ui'], inert: null },
    absent: 'removed 2026-08-06; the app has no dark palette to switch to',
  },
  {
    key: 'android.userInterfaceStyle',
    needs: whenSet('expo-system-ui'),
    witness: { set: 'dark', requires: ['expo-system-ui'], inert: null },
    absent: 'the per-platform spelling of the key above, never set here',
  },
  {
    key: 'backgroundColor',
    needs: whenSet('expo-system-ui'),
    witness: { set: '#ffffff', requires: ['expo-system-ui'], inert: null },
    absent: 'the root view keeps PALETTE.page from src/App.tsx, not a native colour',
  },
  {
    key: 'ios.backgroundColor',
    needs: whenSet('expo-system-ui'),
    witness: { set: '#ffffff', requires: ['expo-system-ui'], inert: null },
    absent: 'as above, per platform',
  },
  {
    key: 'androidNavigationBar',
    needs: whenSet('expo-navigation-bar'),
    witness: { set: { visible: 'sticky-immersive' }, requires: ['expo-navigation-bar'], inert: null },
    absent: 'the game draws a board, not a full-screen surface; the bar is left alone',
  },
  {
    key: 'notification',
    needs: whenSet('expo-notifications'),
    witness: { set: { icon: './assets/n.png' }, requires: ['expo-notifications'], inert: null },
    absent: 'this app never notifies; a game of self-knowledge does not interrupt',
  },
  {
    // The rule with a value in it, and the reason `needs` cannot be a boolean.
    // Expo's default is enabled, so an *absent* `updates` key asks for
    // over-the-air updates from a client that is not installed. Saying
    // `enabled: false` is the manifest describing the app that is built.
    key: 'updates',
    needs: (value) =>
      (value as { enabled?: boolean } | undefined)?.enabled === false ? [] : ['expo-updates'],
    witness: { set: {}, requires: ['expo-updates'], inert: { enabled: false } },
  },
  {
    // Every config plugin is a package, named as a string or as the head of a
    // pair. Nothing here uses one yet, and the day something does it will be a
    // dependency or this fails.
    key: 'plugins',
    needs: (value) =>
      Array.isArray(value)
        ? value.map((one) => (Array.isArray(one) ? one[0] : one)).filter((one): one is string => typeof one === 'string')
        : [],
    witness: {
      set: ['expo-router', ['expo-build-properties', {}]],
      requires: ['expo-router', 'expo-build-properties'],
      inert: [],
    },
    absent: 'no config plugin is used; app.config.ts changes the identity in JS instead',
  },
];

/**
 * Every path under `expo`, containers included.
 *
 * Containers matter: `updates` is an object and the rule is about the object,
 * not about `updates.enabled`. Arrays are recorded and not walked into — a
 * plugin list is one value to its rule, and its entries are not config keys.
 */
function pathsIn(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [];

  const found: string[] = [];
  for (const [name, inner] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${name}` : name;
    found.push(path);
    found.push(...pathsIn(inner, path));
  }
  return found;
}

/** The value at a dotted path, or undefined. */
function at(config: Record<string, unknown>, path: string): unknown {
  let here: unknown = config;
  for (const step of path.split('.')) {
    if (here === null || typeof here !== 'object') return undefined;
    here = (here as Record<string, unknown>)[step];
  }
  return here;
}

/**
 * A package this workspace declares to a *build*.
 *
 * `dependencies` only, and not `devDependencies`: autolinking and
 * `expo prebuild` read the production list, so a native package parked in the
 * dev list is one the app does not have. That is the same defect this file is
 * about, one field over.
 */
const declared = (pkg: string) => Object.hasOwn(MANIFEST.dependencies ?? {}, pkg);

describe('a setting with no package', () => {
  it('has a package for every setting app.json makes', () => {
    const rules = new Map(NEEDS.map((rule) => [rule.key, rule]));
    const missing: string[] = [];

    for (const path of pathsIn(CONFIG.expo)) {
      const rule = rules.get(path);
      if (!rule) continue;

      for (const pkg of rule.needs(at(CONFIG.expo, path))) {
        if (!declared(pkg)) {
          missing.push(`${path} is set in app.json and ${pkg} is not a dependency`);
        }
      }
    }

    // Both halves named, because the answer is one of two different acts:
    // install the package, or stop declaring the setting.
    expect(missing).toEqual([]);
  });

  it('walks into the platform sections, which is where a setting hides', () => {
    // Over a fixture rather than over `app.json`, so this names nobody and
    // cannot go red because somebody moved a key. The walk was written once
    // without recursion and would have been blind to every `ios.*` rule in the
    // map above while reporting success over the four it could still see.
    const paths = pathsIn({ ios: { backgroundColor: '#fff' }, updates: { enabled: false }, plugins: ['a'] });

    expect(new Set(paths)).toEqual(
      new Set(['ios', 'ios.backgroundColor', 'updates', 'updates.enabled', 'plugins']),
    );
  });
});

describe('the map itself', () => {
  it('names each key once', () => {
    // Two entries for one key is a rule somebody wrote twice and will fix once.
    expect(NEEDS.map((rule) => rule.key).sort()).toEqual([...new Set(NEEDS.map((rule) => rule.key))].sort());
  });

  it('names a key app.json sets, or says why it is kept', () => {
    // The rot check. An entry for a key nothing sets is a rule that has never
    // fired and cannot be seen to work — either it is waiting for a setting
    // somebody might add, and says so, or it is left over from one somebody
    // removed and should go with it.
    const unexplained: string[] = [];
    const paths = new Set(pathsIn(CONFIG.expo));

    for (const rule of NEEDS) {
      if (paths.has(rule.key)) continue;
      if (rule.absent && rule.absent.trim().length > 0) continue;
      unexplained.push(`${rule.key}: not set in app.json and no reason given`);
    }

    expect(unexplained).toEqual([]);
  });

  it('requires what its witness says it requires', () => {
    // The half a written reason cannot cover. `absent` explains why a rule is
    // dormant; it says nothing about whether the rule works. A predicate that
    // returned `[]` for every value would satisfy every assertion above and
    // silently excuse the whole map.
    const wrong: string[] = [];

    for (const rule of NEEDS) {
      const got = rule.needs(rule.witness.set);
      if (JSON.stringify([...got].sort()) !== JSON.stringify([...rule.witness.requires].sort())) {
        wrong.push(`${rule.key}: set witness requires ${got.join(', ') || 'nothing'}`);
      }
      if (rule.witness.requires.length === 0) {
        wrong.push(`${rule.key}: a witness that requires nothing proves nothing`);
      }
      if (rule.witness.inert !== null) {
        const inert = rule.needs(rule.witness.inert);
        if (inert.length > 0) {
          wrong.push(`${rule.key}: inert witness still requires ${inert.join(', ')}`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });

  it('names packages Expo ships, not names somebody typed', () => {
    // A misspelled package is a rule that can never fire: the key is set, the
    // typo is not a dependency, and the test goes red for a reason that reads
    // like the app being wrong. Held to Expo's own list of the versions this
    // SDK bundles, which is the one place in this tree that knows what an Expo
    // package is called.
    //
    // `plugins` is exempt: the packages it needs come from a value, and a
    // config plugin is very often not an Expo package at all.
    const bundled = JSON.parse(
      readFileSync(
        resolve(__dirname, '..', 'node_modules', 'expo', 'bundledNativeModules.json'),
        'utf8',
      ),
    ) as Record<string, string>;

    const unknown = NEEDS.filter((rule) => rule.key !== 'plugins')
      .flatMap((rule) => rule.witness.requires.map((pkg) => ({ key: rule.key, pkg })))
      .filter(({ pkg }) => !Object.hasOwn(bundled, pkg))
      .map(({ key, pkg }) => `${key}: ${pkg} is not a package this Expo SDK knows`);

    expect(unknown).toEqual([]);
  });
});
