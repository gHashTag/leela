import type { ExpoConfig } from 'expo/config';
import base from './app.json';

/**
 * Two identities for one app: the one that ships, and the one under development.
 *
 * `app.json` holds the published app's own — `xyz.ghashtag.dharma` on iOS,
 * `com.leelagame` on Android — because this app is meant to succeed it, and an
 * update to a store must be the same application to the store, to the keychain,
 * and to every player who has the published one installed.
 *
 * **A debug build must not be that application.** Installing this port on a
 * simulator replaced the published app twice in one day; on a real phone it
 * would have replaced it on somebody's home screen and taken their game with
 * it, because two apps with one identifier are one app to iOS. There is nothing
 * to warn a person: the install simply succeeds and the other one is gone.
 *
 * So a development build appends `.dev` and says so on the home screen. Nothing
 * about the shipped identity changes — `tests/identity.test.ts` still reads
 * `app.json` and still holds it to the published values, because that file is
 * what a release is built from.
 *
 * `APP_VARIANT=development` is set by the scripts that build for a simulator
 * (`npm run ios`, `npm run e2e:build`). A release build sets nothing and gets
 * exactly what `app.json` says, which is the safe default: forgetting the
 * variable cannot make a release the wrong application, only a debug build the
 * right one.
 */
const DEVELOPMENT = process.env.APP_VARIANT === 'development';

/** The suffix that keeps a debug build off the published app's identity. */
export const DEV_SUFFIX = '.dev';

export default (): ExpoConfig => {
  const expo = base.expo as unknown as ExpoConfig;
  if (!DEVELOPMENT) return expo;

  return {
    ...expo,
    name: `${expo.name} (dev)`,
    ios: { ...expo.ios, bundleIdentifier: `${expo.ios?.bundleIdentifier}${DEV_SUFFIX}` },
    android: { ...expo.android, package: `${expo.android?.package}${DEV_SUFFIX}` },
  };
};
