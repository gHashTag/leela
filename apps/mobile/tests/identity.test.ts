import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The published app's identity, which is two strings and not one.
 *
 * `MIGRATION.md` said *keep the `applicationId` and the bundle id* as though
 * they were the same value. They are not, and this app was built with one of
 * them on both platforms for two passes:
 *
 * - **iOS** is `xyz.ghashtag.dharma`, read from
 *   `leela/ios/leela.xcodeproj/project.pbxproj`, and the app on a home screen
 *   is called *Leela Chakra* — `CFBundleDisplayName` in `ios/leela/Info.plist`.
 * - **Android** is `com.leelagame`, read from `android/app/build.gradle`.
 *
 * The difference is not cosmetic. An iOS build under the wrong identifier is a
 * different application to the store, to the keychain, and to every player who
 * has the published one installed: it cannot update them, and it cannot see
 * anything they wrote.
 *
 * Asserted rather than commented, because the value that matters here is one a
 * person types once and never looks at again.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  readFileSync(resolve(HERE, '..', 'app.json'), 'utf8'),
) as {
  expo: {
    name: string;
    ios: { bundleIdentifier: string };
    android: { package: string };
  };
};

describe('the app is the app that is published', () => {
  it('carries the iOS bundle identifier of the published build', () => {
    expect(config.expo.ios.bundleIdentifier).toBe('xyz.ghashtag.dharma');
  });

  it('carries the Android application id of the published build', () => {
    expect(config.expo.android.package).toBe('com.leelagame');
  });

  it('keeps them apart, which is the whole of this file', () => {
    // The defect written down as a test: one value used for both.
    expect(config.expo.ios.bundleIdentifier).not.toBe(config.expo.android.package);
  });

  it('is called what the home screen calls it', () => {
    expect(config.expo.name).toBe('Leela Chakra');
  });
});
