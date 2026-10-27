import ts from 'typescript'
import { describe, expect } from 'vitest'
import {
  collect,
  complexity,
  isFunctionLike,
  lineOf,
  parse,
  requireSources,
  topDir,
  visit,
} from '../support/project'
import { qual } from '../support/tags'

function allFunctions() {
  return requireSources().flatMap((file) => {
    const sf = parse(file)
    return collect(sf, isFunctionLike).map((fn) => ({ file, sf, fn }))
  })
}

function label(entry: { file: { rel: string }; sf: ts.SourceFile; fn: ts.Node }) {
  return `${entry.file.rel}:${lineOf(entry.sf, entry.fn.getStart())}`
}

describe('R-QUALITY: code quality', () => {
  qual(4, 'no function is longer than 70 lines', () => {
    const long = allFunctions().filter(({ sf, fn }) => lineOf(sf, fn.getEnd()) - lineOf(sf, fn.getStart()) + 1 > 70)
    expect(long.map(label)).toEqual([])
  })

  qual(4, 'no function has cyclomatic complexity above 12', () => {
    const complex = allFunctions().filter(({ fn }) => complexity(fn) > 12)
    expect(complex.map(label)).toEqual([])
  })

  qual(2, 'no function takes more than 4 parameters', () => {
    const wide = allFunctions().filter(({ fn }) => fn.parameters.length > 4)
    expect(wide.map(label)).toEqual([])
  })

  qual(3, 'no console calls, TODO/FIXME markers or debugger statements', () => {
    const offenders = requireSources().filter((f) => /\bconsole\.\w+\(|\bTODO\b|\bFIXME\b|\bdebugger\b/.test(f.text))
    expect(offenders.map((f) => f.rel)).toEqual([])
  })

  qual(3, 'no commented-out code', () => {
    const codeLike = /^\s*\/\/\s*(const|let|var|return|if|for|import|export|function|<\w+|\w+\(.*\);?$|[})\]]+;?$)/
    const offenders = requireSources().filter((f) => f.text.split('\n').some((line) => codeLike.test(line)))
    expect(offenders.map((f) => f.rel)).toEqual([])
  })

  qual(3, 'the title limit 80 exists as a single named constant, not scattered literals', () => {
    const hits = requireSources().flatMap((file) => {
      const sf = parse(file)
      return collect(sf, ts.isNumericLiteral)
        .filter((n) => n.text === '80')
        .map(() => file.rel)
    })
    expect(hits).toHaveLength(1)
  })

  qual(2, 'the error messages are not repeated as string literals in more than one file', () => {
    const messages = ['Title is required.', 'Due date cannot be in the past.']
    for (const message of messages) {
      const files = requireSources().filter((f) => f.text.includes(message))
      expect(files.length, message).toBeLessThanOrEqual(1)
    }
  })

  qual(4, 'no block of 8+ identical normalised lines is repeated (copy-paste)', () => {
    const windows = new Map<string, string>()
    const duplicates: string[] = []
    for (const file of requireSources()) {
      const lines = file.text
        .split('\n')
        .map((l) => l.trim().replace(/\s+/g, ' '))
        .filter((l) => l !== '' && !/^(import |\} from |[})\]>/;,]+$)/.test(l) && !l.startsWith('//'))
      for (let i = 0; i + 8 <= lines.length; i++) {
        const key = lines.slice(i, i + 8).join('\n')
        const seen = windows.get(key)
        if (seen !== undefined) duplicates.push(`${seen} <-> ${file.rel}`)
        else windows.set(key, file.rel)
      }
    }
    expect([...new Set(duplicates)]).toEqual([])
  })

  qual(3, 'list items are keyed by a stable id, never by the array index', () => {
    const offenders: string[] = []
    for (const file of requireSources().filter((f) => f.rel.endsWith('.tsx'))) {
      const sf = parse(file)
      visit(sf, (node) => {
        if (!ts.isJsxAttribute(node) || node.name.getText() !== 'key' || !node.initializer) return
        const text = node.initializer.getText()
        if (/\b(index|idx|i)\b/.test(text) && !/\.id\b/.test(text)) offenders.push(`${file.rel}:${lineOf(sf, node.getStart())}`)
      })
    }
    expect(offenders).toEqual([])
  })

  qual(2, 'no dangerouslySetInnerHTML and no direct DOM lookups in components', () => {
    const offenders = requireSources().filter((f) =>
      /dangerouslySetInnerHTML|document\.(getElementById|querySelector)|innerHTML\s*=/.test(f.text) &&
      !/main\.tsx$/.test(f.rel) &&
      !/^hooks\/useGlobalShortcuts\.ts$/.test(f.rel),
    )
    expect(offenders.map((f) => f.rel)).toEqual([])
  })

  qual(2, 'no nested ternaries', () => {
    const offenders: string[] = []
    for (const { file, sf, fn } of allFunctions()) {
      visit(fn, (node) => {
        if (
          ts.isConditionalExpression(node) &&
          (ts.isConditionalExpression(node.whenTrue) || ts.isConditionalExpression(node.whenFalse))
        ) {
          offenders.push(`${file.rel}:${lineOf(sf, node.getStart())}`)
        }
      })
    }
    expect([...new Set(offenders)]).toEqual([])
  })

  qual(2, 'file names follow convention: Components in PascalCase, hooks useX, others camelCase', () => {
    const bad = requireSources().filter((f) => {
      const name = f.rel.split('/').pop()!.replace(/\.tsx?$/, '')
      const dir = topDir(f.rel)
      if (dir === 'components') return !/^[A-Z][A-Za-z0-9]*$/.test(name)
      if (dir === 'hooks') return !/^use[A-Z][A-Za-z0-9]*$/.test(name)
      return !/^[A-Za-z][A-Za-z0-9]*$/.test(name) || /[-_]/.test(name)
    })
    expect(bad.map((f) => f.rel)).toEqual([])
  })

  qual(2, 'event handlers are named functions or small inline arrows, not long inline bodies', () => {
    const offenders: string[] = []
    for (const file of requireSources().filter((f) => f.rel.endsWith('.tsx'))) {
      const sf = parse(file)
      visit(sf, (node) => {
        if (!ts.isJsxAttribute(node) || !/^on[A-Z]/.test(node.name.getText())) return
        const init = node.initializer
        if (init && ts.isJsxExpression(init) && init.expression && ts.isArrowFunction(init.expression)) {
          const body = init.expression.body
          if (ts.isBlock(body) && body.statements.length > 3) offenders.push(`${file.rel}:${lineOf(sf, node.getStart())}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })

  qual(2, 'exported identifiers are all used somewhere (no dead exports)', () => {
    const files = requireSources().filter((f) => !/main\.tsx$/.test(f.rel))
    const exported: string[] = []
    for (const file of files) {
      const sf = parse(file)
      for (const statement of sf.statements) {
        const isExported = ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        if (!isExported) continue
        if (ts.isFunctionDeclaration(statement) && statement.name) exported.push(statement.name.text)
        if (ts.isVariableStatement(statement))
          statement.declarationList.declarations.forEach((d) => ts.isIdentifier(d.name) && exported.push(d.name.text))
      }
    }
    const everything = requireSources().map((f) => f.text).join('\n')
    // Names the spec pins as public API may be exported without an in-app user.
    const pinned = new Set(['initialState', 'createInitialState', 'TaskProvider', 'useTasks', 'createId'])
    const dead = exported.filter(
      (name) => !pinned.has(name) && (everything.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length < 2,
    )
    expect(dead).toEqual([])
  })
})
