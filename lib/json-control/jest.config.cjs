/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/browser/**/*.test.cjs'],
  // Force Jest to exit after all tests finish — prevents setInterval handles
  // (e.g. the log-viewer polling installed on every demo page) from keeping
  // the Node.js event loop alive indefinitely.
  forceExit: true,
  // MetaReporter records durations + git provenance to test-results.db.
  // Disable with: JCTEST_DB=0 pnpm test:browser
  reporters: ['default', '<rootDir>/db/reporter.cjs'],
  // ESM support: disable Babel transformation so Jest does not try to parse
  // ESM import/export syntax with its CJS pipeline.  .js files are already
  // treated as ESM because package.json carries "type":"module".
  // Run with: NODE_OPTIONS='--experimental-vm-modules'
  transform: {},
}
