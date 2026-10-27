// Static checks for state design. They look for the classic ways state "looks
// structured" but is not: derived values stored in state, effects that sync
// state with state, unmemoised context values, mutation inside reducers.
import ts from 'typescript'
import { describe, expect } from 'vitest'
import { collect, lineOf, parse, readSrc, requireSources, topDir, visit } from '../support/project'
import { state } from '../support/tags'

const SETTER = /^set[A-Z]/

function effectCalls() {
  return requireSources().flatMap((file) => {
    const sf = parse(file)
    return collect(
      sf,
      (n): n is ts.CallExpression =>
        ts.isCallExpression(n) && ['useEffect', 'useLayoutEffect'].includes(n.expression.getText()),
    ).map((call) => ({ file, sf, call }))
  })
}

describe('R-STATE-STATIC: state design', () => {
  state(5, 'no effect copies state into state (setState or dispatch inside useEffect)', () => {
    const offenders: string[] = []
    for (const { file, sf, call } of effectCalls()) {
      visit(call, (node) => {
        if (!ts.isCallExpression(node)) return
        const callee = node.expression.getText()
        if (SETTER.test(callee) || callee === 'dispatch') offenders.push(`${file.rel}:${lineOf(sf, node.getStart())}`)
      })
    }
    requireSources()
    expect(offenders).toEqual([])
  })

  state(3, 'the only effect lives in hooks/useGlobalShortcuts.ts (everything else is derived or event-driven)', () => {
    requireSources()
    const outside = effectCalls().filter((e) => e.file.rel !== 'hooks/useGlobalShortcuts.ts')
    expect(outside.map((e) => e.file.rel)).toEqual([])
  })

  state(3, 'the shortcuts effect registers once, returns a cleanup and removes the same listener', () => {
    requireSources()
    const effects = effectCalls().filter((e) => e.file.rel === 'hooks/useGlobalShortcuts.ts')
    expect(effects).toHaveLength(1)
    const { call } = effects[0]
    const callback = call.arguments[0]
    expect(callback !== undefined && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))).toBe(true)
    const text = call.getText()
    expect(text).toMatch(/addEventListener\(\s*['"]keydown['"]/)
    expect(text).toMatch(/removeEventListener\(\s*['"]keydown['"]/)
    const deps = call.arguments[1]
    expect(deps !== undefined && ts.isArrayLiteralExpression(deps) && deps.elements.length === 0).toBe(true)
  })

  state(4, 'no useState holds a derived value (filtered, visible, counts, totals, groups, overdue)', () => {
    const derived = /(filtered|visible|count|total|overdue|sorted|grouped|columns|summary)/i
    const offenders: string[] = []
    for (const file of requireSources()) {
      const sf = parse(file)
      collect(sf, ts.isVariableDeclaration).forEach((decl) => {
        const init = decl.initializer
        if (init && ts.isCallExpression(init) && init.expression.getText() === 'useState' && ts.isArrayBindingPattern(decl.name)) {
          const first = decl.name.elements[0]
          if (first && ts.isBindingElement(first) && derived.test(first.name.getText())) {
            offenders.push(`${file.rel}: ${first.name.getText()}`)
          }
        }
      })
    }
    expect(offenders).toEqual([])
  })

  state(4, 'the task list and filters are kept in one useReducer inside TaskProvider', () => {
    const text = readSrc('state/TaskContext.tsx') ?? ''
    expect(text).toMatch(/useReducer\(/)
    expect(text).toMatch(/createContext/)
    expect(text).not.toMatch(/useState\(/)
  })

  state(4, 'context values are plain state/dispatch references, never fresh objects or arrays', () => {
    const offenders: string[] = []
    for (const file of requireSources().filter((f) => f.rel.endsWith('.tsx'))) {
      const sf = parse(file)
      visit(sf, (node) => {
        if (!ts.isJsxAttribute(node) || node.name.getText() !== 'value' || !node.initializer) return
        const parent = node.parent.parent
        if (!ts.isJsxOpeningElement(parent) && !ts.isJsxSelfClosingElement(parent)) return
        if (!/\.Provider$/.test(parent.tagName.getText())) return
        const expr = ts.isJsxExpression(node.initializer) ? node.initializer.expression : undefined
        if (expr && (ts.isObjectLiteralExpression(expr) || ts.isArrayLiteralExpression(expr) || ts.isArrowFunction(expr))) {
          offenders.push(`${file.rel}:${lineOf(sf, node.getStart())}`)
        }
      })
    }
    requireSources()
    expect(offenders).toEqual([])
  })

  state(4, 'the reducer never mutates (no push/splice/sort/... and no property assignment)', () => {
    const text = readSrc('state/taskReducer.ts')
    expect(text).not.toBeNull()
    const sf = parse({ rel: 'state/taskReducer.ts', text: text! })
    const offenders: string[] = []
    visit(sf, (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill'].includes(node.expression.name.text)
      ) {
        offenders.push(`call .${node.expression.name.text}() line ${lineOf(sf, node.getStart())}`)
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
        (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
      ) {
        const root = node.left.getText().split(/[.[]/)[0]
        if (['state', 'action', 'task', 'tasks', 'filters', 'draft'].includes(root))
          offenders.push(`assignment ${node.left.getText()} line ${lineOf(sf, node.getStart())}`)
      }
    })
    expect(offenders).toEqual([])
  })

  state(3, 'reducer and selectors are impure-free: no Date, Math.random or crypto', () => {
    const files = ['state/taskReducer.ts', 'state/selectors.ts']
    const texts = files.map((rel) => readSrc(rel))
    expect(texts.every((t) => t !== null)).toBe(true)
    for (const text of texts) {
      expect(text).not.toMatch(/\bnew Date\b|\bDate\.now\b|Math\.random|\bcrypto\b|\blocalStorage\b/)
    }
  })

  state(3, 'derived data is memoised: useTasks computes visible/columns with useMemo', () => {
    const text = readSrc('hooks/useTasks.ts') ?? ''
    expect(text).toMatch(/useMemo\(/)
    expect(text).toMatch(/selectVisibleTasks|groupByStatus/)
  })

  state(3, 'action creators handed to children are stable (useCallback or a stable dispatch)', () => {
    const sources = requireSources().filter((f) => topDir(f.rel) === 'hooks')
    const text = sources.map((f) => f.text).join('\n')
    expect(text).toMatch(/useCallback\(|useMemo\(/)
  })

  state(3, 'a component keeps at most 4 pieces of local state; larger forms use a hook', () => {
    const offenders: string[] = []
    for (const file of requireSources()) {
      const count = (file.text.match(/\buseState\s*[<(]/g) ?? []).length
      if (count > 4) offenders.push(`${file.rel}: ${count}`)
    }
    expect(offenders).toEqual([])
  })

  state(3, 'no state is copied from props with an effect, and no prop is mirrored into useState each render', () => {
    const offenders: string[] = []
    for (const file of requireSources()) {
      const sf = parse(file)
      collect(sf, ts.isCallExpression).forEach((call) => {
        if (call.expression.getText() !== 'useState' || !call.arguments[0]) return
        const arg = call.arguments[0]
        // useState(props.x) / useState(task.title) read props eagerly on every render
        if (ts.isPropertyAccessExpression(arg) || ts.isIdentifier(arg) && /^(props|task|value|initial)$/.test(arg.text) && file.rel.startsWith('components/')) {
          offenders.push(`${file.rel}:${lineOf(sf, call.getStart())}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })
})
