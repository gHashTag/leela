module.exports = {
  root: true,
  /*
   * `@react-native-community`, not `@react-native`.
   *
   * The second name is the one React Native 0.73 and later publish; this app is
   * 0.70.4, for which it was never published at all. So the config extended a
   * package that could not be installed, and `npm run lint` died on its first
   * line - every time, for everyone. Nothing in this app has been linted.
   *
   * That is how `react-hooks/rules-of-hooks` - which is inside this config, and
   * which exists precisely to catch a hook placed after an early return - was
   * silent while exactly that shipped to a phone.
   */
  extends: ['@react-native-community', 'plugin:prettier/recommended'],
  env: {
    'jest/globals': true
  },
  globals: {
    __filename: 'readonly'
  },
  rules: {
    semi: ['error', 'never'],
    'react-native/no-unused-styles': 2,
    'react-native/split-platform-components': 2,
    'react-native/no-inline-styles': 2,
    'react-native/no-color-literals': 2,
    'react-native/no-raw-text': 2,
    'react-native/no-single-element-style-arrays': 2
  }
}
