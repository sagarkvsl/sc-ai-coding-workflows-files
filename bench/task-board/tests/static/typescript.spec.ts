import { execFileSync } from 'node:child_process'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect } from 'vitest'
import {
  TARGET,
  collect,
  parse,
  readSrc,
  readTarget,
  requireSources,
  topDir,
  visit,
} from '../support/project'
import { typed } from '../support/tags'

function nodesOf<T extends ts.Node>(guard: (n: ts.Node) => node is T) {
  return requireSources().flatMap((file) => {
    const sf = parse(file)
    return collect(sf, guard).map((node) => ({ file: file.rel, node, sf }))
  })
}

function loadTsconfig(): Record<string, unknown> {
  const text = readTarget('tsconfig.json')
  if (text === null) throw new Error('tsconfig.json is missing')
  const parsed = ts.parseConfigFileTextToJson('tsconfig.json', text)
  if (parsed.error) throw new Error('tsconfig.json is not valid JSON')
  return (parsed.config.compilerOptions ?? {}) as Record<string, unknown>
}

describe('R-TS: TypeScript quality', () => {
  typed(3, 'tsconfig turns on strict, noUnusedLocals and noUnusedParameters', () => {
    const options = loadTsconfig()
    expect(options.strict).toBe(true)
    expect(options.noUnusedLocals).toBe(true)
    expect(options.noUnusedParameters).toBe(true)
  })

  typed(5, 'tsc --noEmit reports zero errors (source and tests)', () => {
    const tsc = path.join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc')
    let output = ''
    try {
      execFileSync('node', [tsc, '-p', path.join(TARGET, 'tsconfig.json'), '--noEmit', '--pretty', 'false'], {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 120000,
      })
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string }
      output = `${failure.stdout ?? ''}${failure.stderr ?? ''}`
    }
    // TS2882 (a bare CSS import has no declaration) depends on the TypeScript version and the spec
    // does not say how CSS imports are typed, so it is not held against the model.
    const errors = output.split('\n').filter((line) => line.trim() !== '' && !/error TS2882: .*\.css'/.test(line))
    expect(errors.slice(0, 8).join('\n')).toBe('')
  })

  typed(4, 'the keyword "any" is never used (no annotations, no "as any")', () => {
    const hits = nodesOf((n): n is ts.Node => n.kind === ts.SyntaxKind.AnyKeyword)
    expect(hits.map((h) => h.file)).toEqual([])
  })

  typed(3, 'no @ts-ignore, @ts-expect-error or @ts-nocheck comments', () => {
    const offenders = requireSources().filter((f) => /@ts-(ignore|expect-error|nocheck)/.test(f.text))
    expect(offenders.map((f) => f.rel)).toEqual([])
  })

  typed(3, 'no non-null assertions (the "!" operator)', () => {
    const hits = nodesOf(ts.isNonNullExpression)
    expect(hits.map((h) => h.file)).toEqual([])
  })

  typed(3, 'type assertions ("as T") are rare: at most two in the whole source', () => {
    const casts = nodesOf(ts.isAsExpression).filter((h) => h.node.type.getText() !== 'const')
    expect(casts.length).toBeLessThanOrEqual(2)
  })

  typed(2, 'no TypeScript enums and no loose Function/object/{} types', () => {
    const enums = nodesOf(ts.isEnumDeclaration)
    const loose = nodesOf(
      (n): n is ts.TypeReferenceNode => ts.isTypeReferenceNode(n) && ['Function', 'Object'].includes(n.typeName.getText()),
    )
    const bare = nodesOf((n): n is ts.Node => n.kind === ts.SyntaxKind.ObjectKeyword)
    expect(enums.length + loose.length + bare.length).toBe(0)
  })

  typed(3, 'Status and Priority are unions derived from as-const tuples', () => {
    const text = readSrc('types/task.ts') ?? ''
    expect(text).toMatch(/STATUSES\s*=\s*\[[^\]]+\]\s*as const/)
    expect(text).toMatch(/PRIORITIES\s*=\s*\[[^\]]+\]\s*as const/)
    expect(text).toMatch(/type Status\s*=\s*\(?typeof STATUSES\)?\[number\]/)
    expect(text).toMatch(/type Priority\s*=\s*\(?typeof PRIORITIES\)?\[number\]/)
  })

  typed(3, 'the Task type uses Status/Priority and keeps dueDate as string | null', () => {
    const text = readSrc('types/task.ts') ?? ''
    expect(text).toMatch(/status:\s*Status/)
    expect(text).toMatch(/priority:\s*Priority/)
    expect(text).toMatch(/dueDate:\s*string \| null/)
    expect(text).toMatch(/createdAt:\s*string/)
  })

  typed(4, 'TaskAction is a discriminated union and the reducer ends in an exhaustive "never" check', () => {
    const actions = readSrc('state/actions.ts') ?? ''
    const reducer = readSrc('state/taskReducer.ts') ?? ''
    expect(actions).toMatch(/export type TaskAction\s*=/)
    expect((actions.match(/type:\s*'/g) ?? []).length).toBeGreaterThanOrEqual(7)
    expect(reducer).toMatch(/:\s*never\b/)
    expect(reducer).toMatch(/default:/)
  })

  typed(3, 'exported functions in types/state/utils/hooks declare their return type', () => {
    const files = requireSources().filter((f) => ['state', 'utils', 'hooks'].includes(topDir(f.rel)) && f.rel.endsWith('.ts'))
    expect(files.length).toBeGreaterThanOrEqual(5)
    const missing: string[] = []
    for (const file of files) {
      const sf = parse(file)
      for (const statement of sf.statements) {
        if (
          ts.isFunctionDeclaration(statement) &&
          statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
          !statement.type
        ) {
          missing.push(`${file.rel}: ${statement.name?.text}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  typed(3, 'components type their props with a named interface or type, not inline or React.FC', () => {
    const components = requireSources().filter((f) => topDir(f.rel) === 'components')
    expect(components.length).toBeGreaterThanOrEqual(8)
    const problems: string[] = []
    for (const file of components) {
      if (/React\.FC|FunctionComponent|\bFC</.test(file.text)) problems.push(`${file.rel}: uses FC`)
      const sf = parse(file)
      for (const statement of sf.statements) {
        if (!ts.isFunctionDeclaration(statement) || !statement.name || !/^[A-Z]/.test(statement.name.text)) continue
        const param = statement.parameters[0]
        if (param && !(param.type && ts.isTypeReferenceNode(param.type))) {
          problems.push(`${file.rel}: ${statement.name.text} props are not a named type`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  typed(2, 'type-only imports use "import type"', () => {
    const problems: string[] = []
    for (const file of requireSources()) {
      const sf = parse(file)
      for (const decl of sf.statements.filter(ts.isImportDeclaration)) {
        const clause = decl.importClause
        const named = clause?.namedBindings
        if (!clause || clause.isTypeOnly || !named || !ts.isNamedImports(named)) continue
        const names = named.elements.map((e) => e.name.text)
        const allTypes = names.every((name) => {
          let usedAsValue = false
          visit(sf, (n) => {
            if (ts.isIdentifier(n) && n.text === name && !ts.isImportSpecifier(n.parent)) {
              const inType = ts.isTypeReferenceNode(n.parent) || ts.isExpressionWithTypeArguments(n.parent) || ts.isQualifiedName(n.parent)
              if (!inType) usedAsValue = true
            }
          })
          return !usedAsValue
        })
        if (allTypes && names.length > 0) problems.push(`${file.rel}: import of ${names.join(', ')}`)
      }
    }
    expect(problems).toEqual([])
  })

  typed(2, 'generic helpers are used instead of casts for field updates (no "as keyof")', () => {
    const offenders = requireSources().filter((f) => /as keyof\b/.test(f.text))
    expect(offenders.map((f) => f.rel)).toEqual([])
  })

  typed(2, 'no function parameter or variable is typed as a bare string where a union exists', () => {
    // status/priority props must use the union types, never `string`
    const offenders = requireSources().filter((f) => /\b(status|priority)\??:\s*string\b/.test(f.text))
    expect(offenders.map((f) => f.rel)).toEqual([])
  })
})
