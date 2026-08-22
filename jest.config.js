// @ts-ignore
const { defaults: tsjPreset } = require('ts-jest/presets')

module.exports = {
  ...tsjPreset,
  preset: 'react-native',
  transform: {
    ...tsjPreset.transform,
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        babelConfig: {
          presets: ['module:metro-react-native-babel-preset'],
          plugins: [
            [
              'module-resolver',
              {
                root: ['./'],
                extensions: ['.js', '.jsx', '.ts', '.tsx'],
                alias: {
                  src: './src'
                }
              }
            ],
            'react-native-reanimated/plugin'
          ]
        }
      }
    ],
    // scripts/*.mjs hold the cron's decision logic; the tests import them.
    '^.+\\.m?jsx?$': [
      'babel-jest',
      {
        presets: ['module:metro-react-native-babel-preset'],
        plugins: [
          [
            'module-resolver',
            {
              root: ['./'],
              extensions: ['.js', '.jsx', '.ts', '.tsx'],
              alias: {
                src: './src'
              }
            }
          ],
          'react-native-reanimated/plugin'
        ]
      }
    ]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|react-native-size-matters|@react-native/polyfills|react-native-spinkit|@sentry/react-native|react-native-rate|react-native-localize|@react-native-firebase/auth|@react-native-firebase/app|@react-native-firebase/firestore|@react-native-firebase/database|@react-native-firebase/storage|@react-native-async-storage/async-storage|@react-native-firebase/messaging|@react-navigation|@react-native/assets|rn-fetch-blob))'
  ],
  moduleNameMapper: {
    '@env': '<rootDir>/__mocks__/@env.js'
  },
  cacheDirectory: '.jest/cache',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
}
