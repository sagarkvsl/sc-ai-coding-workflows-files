import { describe, expect } from 'vitest'
import { readSrc, readTarget } from '../support/project'
import { arch, req } from '../support/tags'

function packageJson(): {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
} {
  const text = readTarget('package.json')
  if (text === null) throw new Error('package.json is missing')
  return JSON.parse(text)
}

const ALLOWED_DEV = new Set([
  'typescript',
  'vite',
  '@vitejs/plugin-react',
  'vitest',
  'jsdom',
  '@testing-library/react',
  '@testing-library/jest-dom',
  '@testing-library/user-event',
  '@testing-library/dom',
])

describe('R-PROJECT: scripts, dependencies and test setup', () => {
  req(3, 'package.json defines dev, build, test (vitest run) and typecheck scripts', () => {
    const { scripts = {} } = packageJson()
    expect(scripts.dev).toMatch(/vite/)
    expect(scripts.build).toMatch(/vite build/)
    expect(scripts.test).toBe('vitest run')
    expect(scripts.typecheck).toMatch(/tsc/)
  })

  arch(4, 'the only runtime dependencies are react and react-dom', () => {
    const { dependencies = {} } = packageJson()
    expect(Object.keys(dependencies).sort()).toEqual(['react', 'react-dom'])
  })

  arch(3, 'dev dependencies stay inside the allowed list (plus @types/*)', () => {
    const { devDependencies = {} } = packageJson()
    const extras = Object.keys(devDependencies).filter((name) => !ALLOWED_DEV.has(name) && !name.startsWith('@types/'))
    expect(extras).toEqual([])
  })

  arch(2, 'vite.config.ts configures vitest with jsdom and src/setupTests.ts', () => {
    const text = readTarget('vite.config.ts') ?? readTarget('vitest.config.ts') ?? ''
    expect(text).toMatch(/environment:\s*['"]jsdom['"]/)
    expect(text).toMatch(/setupFiles:\s*\[\s*['"]\.\/src\/setupTests\.ts['"]/)
  })

  arch(2, 'src/setupTests.ts registers jest-dom matchers and cleans up after each test', () => {
    const text = readSrc('setupTests.ts') ?? ''
    expect(text).toMatch(/@testing-library\/jest-dom\/vitest/)
    expect(text).toMatch(/cleanup/)
    expect(text).toMatch(/afterEach/)
  })
})
