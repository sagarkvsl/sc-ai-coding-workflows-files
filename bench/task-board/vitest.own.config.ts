import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Runs the *model's own* tests (src/**/*.test.*) inside a work copy of a project.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
