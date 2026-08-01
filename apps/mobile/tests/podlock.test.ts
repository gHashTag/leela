import { describe, expect, it } from 'vitest';
import {
  driftFrom,
  lockedVersions,
  packageOf,
  podOf,
} from '../../../scripts/lib/podlock.mjs';

/**
 * `Podfile.lock` read as the JavaScript lockfile a React Native app never had.
 *
 * The published app declares caret ranges and ships no `yarn.lock` and no
 * `package-lock.json`, so every install resolves fresh — the single root cause
 * behind all sixteen build blockers in `MIGRATION.md`. But every package with a
 * native side ships a `.podspec`, CocoaPods writes down the version it saw, and
 * **that file is committed**. For the half of the tree that decides whether the
 * app compiles, the shipped build's versions are recoverable.
 *
 * What is asserted is the reading, not the fourteen packages that had drifted:
 * the numbers will change, the file's shape will not.
 */

/** A `Podfile.lock` in miniature, with both indents that matter. */
const LOCK = `PODS:
  - boost (1.76.0)
  - RNGestureHandler (2.14.0):
    - React-Core
  - RNScreens (3.27.0):
    - React-Core
    - RNGestureHandler (= 2.14.0)
  - RNCAsyncStorage (1.19.8):
    - React-Core

DEPENDENCIES:
  - RNScreens (from \`../node_modules/react-native-screens\`)

SPEC CHECKSUMS:
  RNScreens: e1cdbda3243fbb6d4a265fdb53c34f9eb16cffd9

COCOAPODS: 1.16.2
`;

describe('what the lock records', () => {
  it('takes the version a pod declares', () => {
    const locked = lockedVersions(LOCK);

    expect(locked.get('boost')).toBe('1.76.0');
    expect(locked.get('RNGestureHandler')).toBe('2.14.0');
    expect(locked.get('RNCAsyncStorage')).toBe('1.19.8');
  });

  it('does not take a version from a dependency constraint', () => {
    // `RNScreens` depends on `RNGestureHandler (= 2.14.0)`, indented deeper.
    // A reader that took the constraint would answer with whatever pod happened
    // to mention another first — and be right by luck most of the time, which is
    // the worst way for a check to be wrong.
    expect(lockedVersions('PODS:\n  - A (1.0.0):\n    - B (= 9.9.9)\n  - B (2.0.0)\n').get('B')).toBe(
      '2.0.0',
    );
  });

  it('reads only the section that has versions in it', () => {
    // `SPEC CHECKSUMS` and `DEPENDENCIES` carry the same names with no version,
    // and must contribute nothing rather than an empty string.
    const locked = lockedVersions(LOCK);

    expect([...locked.keys()].sort()).toEqual([
      'RNCAsyncStorage',
      'RNGestureHandler',
      'RNScreens',
      'boost',
    ]);
  });
});

describe('which package ships which pod', () => {
  it('takes the pod from the podspec’s own filename', () => {
    // CocoaPods requires it, which is why this needs no Ruby parsing and no
    // vocabulary of its own.
    expect(podOf('x/node_modules/react-native-screens/RNScreens.podspec')).toBe('RNScreens');
    expect(podOf('x/node_modules/react-native-video/react-native-video.podspec')).toBe(
      'react-native-video',
    );
    expect(podOf('x/node_modules/foo/README.md')).toBe(null);
  });

  it('takes the whole of a scoped package name', () => {
    // The one that would be wrong quietly: `@react-native-firebase` is not a
    // package anybody installs, so a reader that took one segment would pin a
    // name that does not exist and report nothing.
    expect(packageOf('/a/node_modules/@react-native-async-storage/async-storage/RNCAsyncStorage.podspec')).toBe(
      '@react-native-async-storage/async-storage',
    );
    expect(packageOf('/a/node_modules/react-native-video/react-native-video.podspec')).toBe(
      'react-native-video',
    );
  });

  it('finds the last node_modules, for a package nested inside another', () => {
    expect(packageOf('/a/node_modules/x/node_modules/react-native-video/react-native-video.podspec')).toBe(
      'react-native-video',
    );
  });
});

describe('what has drifted from the shipped build', () => {
  const podspecs = [
    '/a/node_modules/react-native-screens/RNScreens.podspec',
    '/a/node_modules/@react-native-async-storage/async-storage/RNCAsyncStorage.podspec',
    '/a/node_modules/react-native-brand-new/RNBrandNew.podspec',
  ];
  const installed: Record<string, string> = {
    'react-native-screens': '3.37.0',
    '@react-native-async-storage/async-storage': '1.19.8',
    'react-native-brand-new': '1.0.0',
  };
  const versionOf = (pkg: string) => installed[pkg] ?? null;

  it('names the package, what is on disk, and what the lock remembers', () => {
    const { drift } = driftFrom({ locked: lockedVersions(LOCK), podspecs, versionOf });

    expect(drift).toEqual([
      {
        package: 'react-native-screens',
        pod: 'RNScreens',
        installed: '3.37.0',
        locked: '3.27.0',
      },
    ]);
  });

  it('says nothing about a package that already agrees', () => {
    const { drift } = driftFrom({ locked: lockedVersions(LOCK), podspecs, versionOf });

    expect(drift.map((one: { package: string }) => one.package)).not.toContain(
      '@react-native-async-storage/async-storage',
    );
  });

  it('says out loud when the lock has never heard of a podspec', () => {
    // Added since the build, or a pod this reader named wrongly — and the two
    // are indistinguishable in silence, which is the failure this repository
    // keeps closing. Reported, never skipped.
    const { unmatched } = driftFrom({ locked: lockedVersions(LOCK), podspecs, versionOf });

    expect(unmatched).toEqual([{ package: 'react-native-brand-new', pod: 'RNBrandNew' }]);
  });

  it('claims no pin for a package the lock never saw', () => {
    // A pure-JavaScript package has no podspec and therefore no recoverable
    // version. Reconstructing one would be this check inventing a lockfile.
    const { drift } = driftFrom({
      locked: lockedVersions(LOCK),
      podspecs: ['/a/node_modules/lodash/nothing.txt'],
      versionOf,
    });

    expect(drift).toEqual([]);
  });
});
