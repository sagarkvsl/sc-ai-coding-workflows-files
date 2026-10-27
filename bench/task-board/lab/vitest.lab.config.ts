import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Used by lab.mjs. TASKBOARD_TARGET is the project being judged, LAB_INCLUDE is a JSON list of
// spec globs (relative to the bench folder) and LAB_SETUP the setup file to load.
const target = path.resolve(process.env.TASKBOARD_TARGET ?? 'lab/baseline')
const include: string[] = JSON.parse(process.env.LAB_INCLUDE ?? '[]')

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@target': path.join(target, 'src'), '@tools': path.join(target, 'tools') } },
  test: {
    environment: 'jsdom',
    setupFiles: [process.env.LAB_SETUP ?? './tests/support/setup.ts'],
    include,
    css: false,
    testTimeout: 60000,
  },
})
