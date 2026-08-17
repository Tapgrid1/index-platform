import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    // *.db.test.ts needs a live Postgres and runs under `npm run test:db`.
    // Keeping the default suite database-free is what lets it stay fast and
    // runnable with no setup at all.
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'src/**/*.db.test.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
});
