import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Playwright owns tests/e2e (it uses @playwright/test, not Vitest).
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
