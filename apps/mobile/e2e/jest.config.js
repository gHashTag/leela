/**
 * The runner Detox needs, kept apart from the one everything else uses.
 *
 * This repository runs vitest. Detox's runner is jest and does not have a
 * vitest adapter, so the two live side by side: `npx vitest run` is the suite,
 * `npx detox test` is the walk through the app. Nothing here is picked up by
 * `bun run verify` — `e2e/` is outside vitest's `tests/` — which is what keeps
 * a suite that needs a simulator out of a command a contributor runs on Linux.
 */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.e2e.js'],
  testTimeout: 180_000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
  // Types stripped and nothing else. The walk imports the control names from
  // `src/handles.ts` rather than repeating them, so the screen and the suite
  // cannot drift — and that import is the only TypeScript here. No Expo preset
  // and no React: nothing in `e2e/` renders a component, and pulling the app's
  // whole toolchain in would be a second build to keep working.
  //
  // Written inline because `<rootDir>` is not expanded inside a transform's
  // options: babel receives the literal string and reports the config missing.
  transform: {
    '^.+\.(ts|tsx|js)$': [
      'babel-jest',
      {
        babelrc: false,
        configFile: false,
        presets: [['@babel/preset-typescript', { allExtensions: true }]],
        // Types stripped leaves ESM, and this runner is CommonJS. Without this
        // the failure is `Unexpected token 'export'` pointing at the app's own
        // source, which reads like a syntax error in a file that has none.
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      },
    ],
  },
};
