module.exports = {
  root: true,
  extends: ['@react-native', 'plugin:prettier/recommended'],
  env: {
    'jest/globals': true
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
