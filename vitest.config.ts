import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '')

export default defineConfig({
  test: {
    // Default to Node; component tests opt into jsdom with a per-file
    // `// @vitest-environment jsdom` pragma.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    // Mirror the tsconfig `@/*` → project root path alias.
    alias: [{ find: /^@\/(.*)$/, replacement: `${root}/$1` }],
  },
})
