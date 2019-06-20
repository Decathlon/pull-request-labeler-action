module.exports = {
  coverageDirectory: './coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/lib/',
    '/esm/',
  ],
  coverageReporters: [
    'lcov',
  ],
  reporters: ["default", "jest-junit"],
  globals: {
    __DEV__: true,
    'ts-jest': {
      babelConfig: true,
    },
  },
  roots: [
    './src',
    './tests',
  ],
  setupFiles: [],
  setupFilesAfterEnv: null,
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  verbose: false,
  preset: 'ts-jest',
  testMatch: null,
}