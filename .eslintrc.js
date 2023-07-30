module.exports = {
  root: true,
  extends: ['@react-native', 'plugin:prettier/recommended'],
  env: {
    'jest/globals': true
  },
  rules: {
    semi: ['error', 'never']
  }
}
