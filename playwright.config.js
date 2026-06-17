// Playwright config - only used by the opt-in E2E suite (npm run test:e2e).
// The default `npm test` (node:test) does not read this file.
'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  use: {
    browserName: 'chromium',
    hasTouch: true,
  },
});
