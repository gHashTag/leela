/**
 * `Podfile.lock` as the JavaScript lockfile a React Native app never had.
 *
 * The published app declares its dependencies as caret ranges and ships **no
 * `yarn.lock` and no `package-lock.json`** — `Gemfile.lock` and `Podfile.lock`
 * are there, the two JavaScript ones are not. So every install resolves fresh,
 * and three years on it resolves to versions its own tooling cannot read: that
 * is the single root cause behind all sixteen build blockers recorded in
 * `MIGRATION.md`, and the reason the app cannot be rebuilt from its own source.
 *
 * **But the pin is not entirely lost.** Every React Native package that has a
 * native side ships a `.podspec`, and CocoaPods writes the version it saw into
 * `Podfile.lock`. That file *is* committed. So for every package with native
 * code — which is every package that breaks — the lock remembers what the
 * shipped build was made with:
 *
 *     - RNGestureHandler (2.14.0)    while npm now resolves 2.32.0
 *     - RNScreens (3.27.0)           while npm now resolves 3.37.0
 *     - RNCAsyncStorage (1.19.8)     while npm now resolves 1.24.0
 *
 * Fourteen of them had drifted. Pinning each npm version back to what the lock
 * remembers collapses five separate build blockers into one edit, and makes
 * `pod install` stop refusing on changed constraints.
 *
 * **The pod name is not the package name**, and the mapping is not guessable:
 * `react-native-async-storage/async-storage` ships `RNCAsyncStorage`,
 * `react-native-device-info` ships `RNDeviceInfo`, and
 * `react-native-orientation-locker` ships a pod of its own name. So the mapping
 * is read out of each package's own `.podspec` rather than kept as a list here
 * — a hand-kept list is the defect this repository has now closed seven times.
 *
 * This is a *reconstruction*, not a lockfile. It covers packages with native
 * code and says nothing about the pure-JavaScript half of the tree, which has
 * no pin at all and never will until somebody commits one. What it recovers is
 * exactly the half that decides whether the app compiles.
 */

/**
 * Every version `Podfile.lock` records, by pod name.
 *
 * The `PODS:` section lists each pod once with its resolved version, and again
 * under other pods as a dependency *constraint* — `- RNScreens (= 3.27.0)`,
 * indented further. Only the declaration carries the answer, so the match is
 * anchored to the two-space indent the section uses and refuses the deeper one.
 */
export function lockedVersions(podfileLock) {
  const found = new Map();

  for (const [, pod, version] of podfileLock.matchAll(
    /^ {2}- ([A-Za-z0-9_+./-]+) \((\d[^)]*)\)/gm,
  )) {
    // First wins. A pod appears once in `PODS:` and the later `SPEC CHECKSUMS`
    // section has no versions, so this only matters if a file is malformed.
    if (!found.has(pod)) found.set(pod, version.trim());
  }

  return found;
}

/**
 * The pod a package ships, read from the package rather than from a list.
 *
 * `podspecName` is the file's own basename: CocoaPods requires the podspec to
 * be named after the pod it declares. That is why this needs no parsing of Ruby
 * and no vocabulary of its own.
 */
export function podOf(podspecPath) {
  const file = podspecPath.split('/').pop() ?? '';
  return file.endsWith('.podspec') ? file.slice(0, -'.podspec'.length) : null;
}

/**
 * The npm package a podspec belongs to, from its path under `node_modules`.
 *
 * Scoped packages are two segments — `@react-native-async-storage/async-storage`
 * — and a check that took one would map every scoped package to its scope and
 * then pin the wrong thing, silently, since `@react-native-firebase` is not a
 * package anybody installs.
 */
export function packageOf(podspecPath) {
  const parts = podspecPath.split('/');
  const at = parts.lastIndexOf('node_modules');
  if (at === -1 || at + 1 >= parts.length) return null;

  const first = parts[at + 1];
  if (first === undefined) return null;
  if (!first.startsWith('@')) return first;

  const second = parts[at + 2];
  return second === undefined ? null : `${first}/${second}`;
}

/**
 * The version CocoaPods will read, which is the podspec's own.
 *
 * This compared the lock against `package.json` and they agree for nineteen of
 * the twenty packages that had drifted — and disagree for `react-native-spinkit`,
 * whose podspec says `1.0.2` while its `package.json` says `1.4.1`. CocoaPods
 * reads the podspec, so a `pod install` writes 1.0.2 into the lock, and this
 * check then reported a drift against a package that was pinned exactly as the
 * shipped lock asked — and advised pinning npm to a number that is not the
 * package's version.
 *
 * A literal only. A podspec is Ruby and may compute its version from
 * `package.json`, which is the common form; there the two agree by
 * construction and reading the manifest is right.
 *
 * @param source The podspec's text.
 * @returns The version it declares outright, or null to fall back.
 */
export function declaredVersion(source) {
  const found = /^\s*\w+\.version\s*=\s*["']([^"']+)["']/m.exec(source);
  return found?.[1] ?? null;
}

/** No podspec reader given: every caller before this one passed three things. */
const noVersion = (/** @type {string} */ _podspec) => /** @type {string | null} */ (null);

/**
 * What has drifted, and what the lock says it was.
 *
 * `installed` is what is on disk now; `locked` is what the shipped build used.
 * A package the lock does not mention is not reported — it has no native side,
 * so the lock never saw it, and claiming otherwise would be this check
 * inventing a pin.
 */
export function driftFrom({ locked, podspecs, versionOf, declaredOf = noVersion }) {
  const drift = [];
  const unmatched = [];

  for (const path of podspecs) {
    const pod = podOf(path);
    const pkg = packageOf(path);
    if (pod === null || pkg === null) continue;

    const want = locked.get(pod);
    if (want === undefined) {
      // Said out loud rather than skipped. A podspec the lock has never heard
      // of means either a package added since the build, or a pod whose name
      // this reader got wrong — and the two look identical in silence.
      unmatched.push({ package: pkg, pod: pod });
      continue;
    }

    // The podspec first, because that is the file CocoaPods reads. Falling
    // back to the manifest keeps every package whose podspec computes its
    // version from `package.json` — which is most of them — answering as it
    // always did.
    const got = declaredOf(path) ?? versionOf(pkg);
    if (got !== null && got !== want) drift.push({ package: pkg, pod, installed: got, locked: want });
  }

  return {
    drift: drift.sort((a, b) => a.package.localeCompare(b.package)),
    unmatched: unmatched.sort((a, b) => a.package.localeCompare(b.package)),
  };
}
