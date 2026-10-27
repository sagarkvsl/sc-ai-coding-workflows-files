import path from 'node:path'
import ts from 'typescript'
import { describe, expect } from 'vitest'
import {
  SRC,
  importsOf,
  parse,
  readSrc,
  requireSources,
  resolveImport,
  topDir,
} from '../support/project'
import { arch } from '../support/tags'
import fs from 'node:fs'

const REQUIRED = [
  'main.tsx',
  'App.tsx',
  'types/task.ts',
  'state/actions.ts',
  'state/taskReducer.ts',
  'state/selectors.ts',
  'state/TaskContext.tsx',
  'hooks/useTasks.ts',
  'hooks/useGlobalShortcuts.ts',
  'utils/date.ts',
  'utils/id.ts',
  'components/Header.tsx',
  'components/TaskForm.tsx',
  'components/FilterBar.tsx',
  'components/Board.tsx',
  'components/TaskColumn.tsx',
  'components/TaskCard.tsx',
  'components/Shortcuts.tsx',
]

// Which folders a folder may import from.
const ALLOWED: Record<string, string[]> = {
  types: ['types'],
  utils: ['types', 'utils'],
  state: ['types', 'utils', 'state'],
  hooks: ['types', 'utils', 'state', 'hooks'],
  components: ['types', 'utils', 'hooks', 'components'],
  '.': ['types', 'utils', 'state', 'hooks', 'components', '.'],
}

function graph() {
  const files = requireSources()
  const known = new Set(files.map((f) => f.rel))
  const edges = new Map<string, string[]>()
  for (const file of files) {
    const targets = importsOf(parse(file))
      .map((imp) => resolveImport(file.rel, imp.specifier, known))
      .filter((t): t is string => t !== null)
    edges.set(file.rel, targets)
  }
  return { files, edges }
}

describe('R-ARCH: architecture and modularity', () => {
  arch(4, 'all required files exist at the pinned paths', () => {
    const missing = REQUIRED.filter((rel) => readSrc(rel) === null)
    expect(missing).toEqual([])
  })

  arch(2, 'there are at least 8 component files and 3 hooks/state/utils modules each', () => {
    const files = requireSources()
    const count = (dir: string) => files.filter((f) => topDir(f.rel) === dir).length
    expect(count('components')).toBeGreaterThanOrEqual(9)
    expect(count('state')).toBeGreaterThanOrEqual(3)
    expect(count('utils')).toBeGreaterThanOrEqual(3)
    expect(count('hooks')).toBeGreaterThanOrEqual(3)
  })

  arch(4, 'imports respect the layers (types < utils < state < hooks < components)', () => {
    const { edges } = graph()
    const violations: string[] = []
    for (const [from, targets] of edges) {
      const allowed = ALLOWED[topDir(from)] ?? ALLOWED['.']
      for (const to of targets) {
        if (!allowed.includes(topDir(to))) violations.push(`${from} -> ${to}`)
      }
    }
    expect(violations).toEqual([])
  })

  arch(3, 'there are no circular imports', () => {
    const { edges } = graph()
    const state = new Map<string, 'visiting' | 'done'>()
    const cycles: string[] = []
    const dfs = (node: string, trail: string[]) => {
      if (state.get(node) === 'done') return
      if (state.get(node) === 'visiting') {
        cycles.push([...trail.slice(trail.indexOf(node)), node].join(' -> '))
        return
      }
      state.set(node, 'visiting')
      for (const next of edges.get(node) ?? []) dfs(next, [...trail, node])
      state.set(node, 'done')
    }
    for (const node of edges.keys()) dfs(node, [])
    expect(cycles).toEqual([])
  })

  arch(3, 'no source file is longer than 150 lines', () => {
    const tooLong = requireSources()
      .map((f) => ({ rel: f.rel, lines: f.text.trimEnd().split('\n').length }))
      .filter((f) => f.lines > 150)
    expect(tooLong).toEqual([])
  })

  arch(4, 'logic modules are plain .ts with no React and no JSX', () => {
    const pure = requireSources().filter(
      (f) => ['types', 'utils'].includes(topDir(f.rel)) || /^state\/(actions|taskReducer|selectors)\.ts$/.test(f.rel),
    )
    expect(pure.length).toBeGreaterThanOrEqual(6)
    const offenders = pure.filter((f) => {
      const reactImport = importsOf(parse(f)).some((i) => /^react(-dom)?(\/|$)/.test(i.specifier))
      return f.rel.endsWith('.tsx') || reactImport
    })
    expect(offenders.map((f) => f.rel)).toEqual([])
  })

  arch(3, 'components never import the reducer or the context directly (they go through hooks)', () => {
    const offenders = requireSources()
      .filter((f) => topDir(f.rel) === 'components')
      .filter((f) => importsOf(parse(f)).some((i) => /(^|\/)state\//.test(i.specifier)))
    expect(offenders.map((f) => f.rel)).toEqual([])
  })

  arch(3, 'components do not call useContext themselves', () => {
    const offenders = requireSources()
      .filter((f) => topDir(f.rel) === 'components')
      .filter((f) => /\buseContext\s*\(/.test(f.text))
    expect(offenders.map((f) => f.rel)).toEqual([])
  })

  arch(3, 'the useTasks hook builds its data with the selectors module', () => {
    const text = readSrc('hooks/useTasks.ts')
    expect(text).not.toBeNull()
    expect(text).toMatch(/from ['"]\.\.\/state\/selectors['"]/)
  })

  arch(2, 'only named exports are used (no default exports)', () => {
    const offenders = requireSources().filter((f) => /export\s+default\b/.test(f.text))
    expect(offenders.map((f) => f.rel)).toEqual([])
  })

  arch(3, 'each component file exports one component, named like the file', () => {
    const components = requireSources().filter((f) => topDir(f.rel) === 'components')
    expect(components.length).toBeGreaterThanOrEqual(9)
    const problems: string[] = []
    for (const file of components) {
      const sf = parse(file)
      const exportedFns = sf.statements.filter(
        (s): s is ts.FunctionDeclaration =>
          ts.isFunctionDeclaration(s) &&
          !!s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
          /^[A-Z]/.test(s.name?.text ?? ''),
      )
      const expected = path.basename(file.rel, '.tsx')
      if (exportedFns.length !== 1 || exportedFns[0].name?.text !== expected) {
        problems.push(`${file.rel}: exports ${exportedFns.map((f) => f.name?.text).join(', ') || 'no component'}`)
      }
    }
    expect(problems).toEqual([])
  })

  arch(2, 'hooks live in files named use*.ts and export a function of that name', () => {
    const hooks = requireSources().filter((f) => topDir(f.rel) === 'hooks')
    expect(hooks.length).toBeGreaterThanOrEqual(1)
    const problems = hooks.filter((f) => {
      const name = path.basename(f.rel).replace(/\.tsx?$/, '')
      return !/^use[A-Z]/.test(name) || !new RegExp(`export function ${name}\\b`).test(f.text)
    })
    expect(problems.map((f) => f.rel)).toEqual([])
  })

  arch(2, 'main.tsx is a thin entry point that wraps <App /> in <TaskProvider>', () => {
    const text = readSrc('main.tsx')
    expect(text).not.toBeNull()
    expect(text!.trimEnd().split('\n').length).toBeLessThanOrEqual(30)
    expect(text).toMatch(/<TaskProvider[\s>]/)
    expect(text).toMatch(/<App\s*\/>/)
    expect(text).toMatch(/createRoot/)
  })

  arch(2, 'App.tsx only composes components (no state, no effects)', () => {
    const text = readSrc('App.tsx') ?? ''
    expect(text.length).toBeGreaterThan(0)
    expect(text).not.toMatch(/\buse(State|Reducer|Effect|Memo|Callback|Context)\s*\(/)
  })

  arch(2, 'src/ root holds only App.tsx, main.tsx, setup and type declarations', () => {
    const rootFiles = fs
      .readdirSync(SRC, { withFileTypes: true })
      .filter((e) => e.isFile() && !e.name.endsWith('.css'))
      .map((e) => e.name)
      .filter((n) => !/\.(test|spec)\.[tj]sx?$/.test(n))
    const allowed = new Set(['App.tsx', 'main.tsx', 'setupTests.ts', 'vite-env.d.ts'])
    expect(rootFiles.filter((n) => !allowed.has(n))).toEqual([])
  })

  arch(2, 'no module imports more than 10 other modules', () => {
    const { edges, files } = graph()
    const heavy = files.filter((f) => importsOf(parse(f)).length > 10).map((f) => f.rel)
    expect(heavy).toEqual([])
    expect(edges.size).toBeGreaterThan(8)
  })
})
