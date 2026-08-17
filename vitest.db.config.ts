import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Database-backed suite. Requires a live Postgres with the schema and
 * prisma/sql/constraints.sql applied — see .github/workflows/ci.yml for the
 * exact sequence.
 *
 * Kept separate from the default config so that `npm test` needs no services
 * and stays a second-long feedback loop.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.db.test.ts'],
    // These share one database; parallel files would race on the same rows.
    fileParallelism: false,
    testTimeout: 20_000,
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
});
