import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The hidden test-suite. TASKBOARD_TARGET points at the project being judged
// (default: the reference solution). `@target` resolves to that project's src/.
const target = path.resolve(process.env.TASKBOARD_TARGET ?? 'reference')

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@target': path.join(target, 'src') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/support/setup.ts'],
    include: ['tests/**/*.spec.{ts,tsx}'],
    css: false,
    testTimeout: 60000,
  },
})
