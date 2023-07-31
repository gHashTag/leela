// @ts-ignore
module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|leela)/)',
    'node_modules/(?!(@sentry/react-native)/)',
    'node_modules/(?!(jest-)?react-native|@react-native-community|@react-navigation|@react-native)'
  ]
}
