module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        alias: {
          src: './src',
        },
      },
    ],
    'react-native-reanimated/plugin',
  ],
}
