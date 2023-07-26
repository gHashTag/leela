// https://medium.com/hackernoon/absolute-imports-with-create-react-app-4c6cfb66c35d
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    'jest/globals': true,
  },
  // We must use typescript parser to correctly parse all modern stuff
  // As we do not have explicit .babelrc config for babel parser
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.eslint.json',
  },
  extends: [
    'airbnb',
    'plugin:jsx-a11y/strict',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:effector/recommended',
    'plugin:effector/react',
  ],
  plugins: [
    'jest',
    'react',
    'react-hooks',
    'import',
    'jsx-a11y',
    'prettier',
    '@typescript-eslint',
    '@trivago/prettier-plugin-sort-imports',
  ],
  overrides: [
    {
      files: ['src/store/slices/*.js', 'src/store/slices/*.ts'],
      rules: {
        'no-param-reassign': [
          'warn',
          {
            props: true,
            ignorePropertyModificationsFor: ['state'],
          },
        ],
      },
    },
    {
      files: [
        'src/{app,processes,pages,widgets,features,entities,shared}/**/*.{ts,tsx}',
      ],
      rules: {
        'import/no-default-export': 'error',
      },
    },
    {
      files: ['**/*.test.js', '**/*.test.ts', '**/*.test.tsx'],
      plugins: ['jest', 'testing-library'],
      extends: ['plugin:jest/all', 'plugin:testing-library/react'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/ban-types': [
          'error',
          { types: { Function: false }, extendDefaults: true },
        ],
        'testing-library/prefer-screen-queries': 'off',
        'testing-library/no-wait-for-multiple-assertions': 'off',
        'jest/prefer-lowercase-title': 'off',
        'jest/no-untyped-mock-factory': 'off',
        'jest/no-hooks': 'off',
        'jest/max-expects': 'off',
        'effector/no-watch': 'off',
        'effector/no-getState': 'off',
        'jest/prefer-expect-assertions': [
          'warn',
          { onlyFunctionsWithAsyncKeyword: true },
        ],
        'jest/consistent-test-it': [
          'warn',
          {
            fn: 'test',
            withinDescribe: 'test',
          },
        ],
        'jest/prefer-strict-equal': 'warn',
      },
    },
    {
      files: ['src/**/__stories__/*.stories.{ts,tsx}'],
      extends: ['plugin:storybook/recommended'],
      rules: {
        'import/no-default-export': 'off',
      },
    },
    {
      files: ['src/**/__stories__/*.mdx'],
      parser: 'eslint-mdx',
      extends: ['plugin:storybook/recommended', 'plugin:mdx/recommended'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
        'react/jsx-filename-extension': 'off',
      },
    },
  ],
  settings: {
    'import/resolver': {
      alias: {
        map: [['src', './src']],
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    },
    'mdx/code-blocks': true,
  },
  rules: {
    'global-require': 'warn',
    'no-param-reassign': [
      'error',
      {
        props: true,
      },
    ],
    'react-hooks/rules-of-hooks': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'react/prop-types': 'error',
    'react/jsx-props-no-spreading': 'off',
    'react/forbid-prop-types': 'warn',
    'react/state-in-constructor': ['error', 'never'],
    'react/require-default-props': [
      'error',
      {
        forbidDefaultForRequired: true,
        classes: 'ignore',
        functions: 'defaultArguments',
      },
    ],
    'react/function-component-definition': [
      'warn',
      {
        namedComponents: 'function-declaration',
      },
    ],
    'react/jsx-filename-extension': [
      'warn',
      {
        extensions: ['.js', '.tsx', '.jsx'],
      },
    ],
    'import/prefer-default-export': 'off',
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        jsx: 'never',
        ts: 'never',
        tsx: 'never',
      },
    ],
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'sibling'],
        pathGroups: [
          {
            pattern: 'react',
            group: 'builtin',
            position: 'before',
          },
        ],
        pathGroupsExcludedImportTypes: ['react'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    '@typescript-eslint/no-shadow': 'error',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    'prettier/prettier': 'error',
    camelcase: 'off',
    'no-use-before-define': 'off',
    'no-underscore-dangle': 'off',
    'no-shadow': 'off',
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'styled-components',
            message: 'Please import from styled-components/macro.',
          },
          {
            name: 'lodash',
            message:
              'Please import from lodash/{function}, do not import everything.',
          },
        ],
        patterns: ['!styled-components/macro'],
      },
    ],
  },
}
