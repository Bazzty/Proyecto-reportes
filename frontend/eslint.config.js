const expoConfig = require('eslint-config-expo/flat');

const jestGlobals = Object.fromEntries(
  ['jest', 'describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll'].map((n) => [n, 'readonly'])
);

module.exports = [
  ...expoConfig,
  { ignores: ['node_modules/**', '.expo/**', 'dist/**'] },
  { files: ['**/__tests__/**', 'jest.setup.js'], languageOptions: { globals: jestGlobals } },
];
