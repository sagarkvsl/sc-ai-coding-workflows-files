// Static quality checks on the tests the MODEL wrote (src/**/*.test.ts[x]).
// Dynamic checks (do they pass? do they catch injected bugs?) run in score.mjs.
import ts from 'typescript'
import { describe, expect } from 'vitest'
import { collect, lineOf, ownTestFiles, parse, testHelperFiles, visit } from '../support/project'
import type { SourceFile } from '../support/project'
import { owntest } from '../support/tags'

const REQUIRED: Record<string, number> = {
  'state/taskReducer.test.ts': 10,
  'state/selectors.test.ts': 5,
  'utils/date.test.ts': 6,
  'components/TaskForm.test.tsx': 5,
  'App.test.tsx': 6,
}

const TEST_FNS = new Set(['it', 'test'])

interface TestCase {
  file: SourceFile
  sf: ts.SourceFile
  call: ts.CallExpression
  name: string
  body: ts.Node | undefined
}

function tests(): TestCase[] {
  const files = ownTestFiles()
  if (files.length === 0) throw new Error('the model wrote no test files')
  return files.flatMap((file) => {
    const sf = parse(file)
    return collect(sf, ts.isCallExpression)
      .filter((call) => {
        const callee = call.expression
        const base = ts.isPropertyAccessExpression(callee) ? callee.expression : callee
        return ts.isIdentifier(base) && TEST_FNS.has(base.text) && !ts.isPropertyAccessExpression(call.parent)
      })
      .map((call) => {
        const first = call.arguments[0]
        const name = first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) ? first.text : first?.getText() ?? ''
        return { file, sf, call, name, body: call.arguments[1] }
      })
  })
}

const allText = () => ownTestFiles().map((f) => f.text).join('\n')

function countMatches(text: string, pattern: RegExp) {
  return (text.match(pattern) ?? []).length
}

describe('R-OWNTESTS: quality of the tests the model wrote', () => {
  owntest(3, 'the five required test files exist', () => {
    const present = new Set(ownTestFiles().map((f) => f.rel))
    expect(Object.keys(REQUIRED).filter((rel) => !present.has(rel))).toEqual([])
  })

  owntest(3, 'each required test file has enough test cases', () => {
    const counts = new Map<string, number>()
    for (const t of tests()) counts.set(t.file.rel, (counts.get(t.file.rel) ?? 0) + 1)
    const short = Object.entries(REQUIRED).filter(([rel, min]) => (counts.get(rel) ?? 0) < min)
    expect(short.map(([rel, min]) => `${rel} needs ${min}, has ${counts.get(rel) ?? 0}`)).toEqual([])
  })

  owntest(3, 'no test is skipped, focused or left as a todo', () => {
    tests()
    expect(countMatches(allText(), /\b(it|test|describe)\.(skip|only|todo|skipIf|fails)\b|\b(xit|xdescribe|fit|fdescribe)\(/g)).toBe(0)
  })

  owntest(4, 'every test makes at least one assertion', () => {
    const empty = tests().filter((t) => {
      if (!t.body) return true
      let asserts = 0
      visit(t.body, (n) => {
        if (ts.isIdentifier(n) && (n.text === 'expect' || n.text === 'assert' || n.text === 'expectTypeOf')) asserts += 1
      })
      return asserts === 0
    })
    expect(empty.map((t) => `${t.file.rel}:${lineOf(t.sf, t.call.getStart())} ${t.name}`)).toEqual([])
  })

  owntest(3, 'on average a test checks at least 1.5 things, and weak matchers are under 20%', () => {
    const all = tests()
    const text = allText()
    const expects = countMatches(text, /\bexpect\s*\(/g)
    expect(all.length).toBeGreaterThan(0)
    expect(expects / all.length).toBeGreaterThanOrEqual(1.5)
    const weak = countMatches(text, /\.(toBeTruthy|toBeFalsy|toBeDefined)\(|\.not\.(toBeNull|toBeUndefined)\(/g)
    expect(weak / Math.max(expects, 1)).toBeLessThan(0.2)
  })

  owntest(3, 'no snapshot assertions and no tautologies like expect(true).toBe(true)', () => {
    tests()
    const text = allText()
    expect(countMatches(text, /toMatch(Inline)?Snapshot/g)).toBe(0)
    expect(countMatches(text, /expect\(\s*(true|false|1|0|'[^']*'|"[^"]*")\s*\)\.(toBe|toEqual)\(/g)).toBe(0)
  })

  owntest(4, 'component tests query like a user (roles, labels, text), not by test id or selector', () => {
    const files = ownTestFiles().filter((f) => f.rel.endsWith('.tsx'))
    expect(files.length).toBeGreaterThan(0)
    const text = files.map((f) => f.text).join('\n')
    const good = countMatches(text, /\b(get|query|find)(All)?By(Role|LabelText|Text|DisplayValue|PlaceholderText)\b/g)
    const bad = countMatches(text, /\bBy(TestId)\b|querySelector(All)?\(|container\.|\.firstChild|\.children\b|\.innerHTML/g)
    expect(good).toBeGreaterThanOrEqual(15)
    expect(bad).toBe(0)
  })

  owntest(3, 'interactions use user-event, not fireEvent', () => {
    const files = ownTestFiles().filter((f) => f.rel.endsWith('.tsx'))
    expect(files.length).toBeGreaterThan(0)
    // user-event may be imported in a shared test helper (for example src/test/renderApp.tsx)
    const helpers = testHelperFiles()
    const text = [...files, ...helpers].map((f) => f.text).join('\n')
    expect(text).toMatch(/@testing-library\/user-event/)
    expect(countMatches(text, /\bfireEvent\b/g)).toBe(0)
  })

  owntest(3, 'every user-event call is awaited', () => {
    const methods = new Set(['click', 'type', 'clear', 'selectOptions', 'keyboard', 'tab', 'hover', 'unhover', 'dblClick', 'tripleClick', 'paste', 'upload', 'deselectOptions', 'pointer'])
    const loose: string[] = []
    for (const file of ownTestFiles().filter((f) => f.rel.endsWith('.tsx'))) {
      const sf = parse(file)
      visit(sf, (node) => {
        if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return
        const target = node.expression.expression.getText()
        if (!/^(user|userEvent|u)$/.test(target) || !methods.has(node.expression.name.text)) return
        const parent = node.parent
        const awaited = ts.isAwaitExpression(parent) || ts.isReturnStatement(parent) || (ts.isArrowFunction(parent) && parent.body === node)
        if (!awaited) loose.push(`${file.rel}:${lineOf(sf, node.getStart())}`)
      })
    }
    expect(ownTestFiles().length).toBeGreaterThan(0)
    expect(loose).toEqual([])
  })

  owntest(3, 'test names describe behaviour: at least 4 words, 20+ characters', () => {
    const all = tests()
    expect(all.length).toBeGreaterThan(0)
    const vague = all.filter((t) => t.name.length < 20 || t.name.trim().split(/\s+/).length < 4)
    expect(vague.length / all.length).toBeLessThanOrEqual(0.1)
  })

  owntest(2, 'larger test files group their cases with describe blocks', () => {
    const byFile = new Map<string, number>()
    tests().forEach((t) => byFile.set(t.file.rel, (byFile.get(t.file.rel) ?? 0) + 1))
    const ungrouped = ownTestFiles().filter(
      (f) => (byFile.get(f.rel) ?? 0) >= 6 && !/\bdescribe\s*\(/.test(f.text),
    )
    expect(ungrouped.map((f) => f.rel)).toEqual([])
  })

  owntest(4, 'the tests cover edge cases: at least 7 of 10 edge-case themes appear in test names', () => {
    const names = tests().map((t) => t.name.toLowerCase()).join('\n')
    const themes = [
      /empty|blank|no tasks/,
      /whitespace|trim|spaces/,
      /exact|boundary|limit|80|81|longer than/,
      /same (state|reference)|identity|unchanged|no-op|nothing/,
      /mutat|frozen|immutab/,
      /overdue|past|today/,
      /escape|cancel|discard/,
      /unknown|missing|invalid|not found|does not exist/,
      /case|insensitive/,
      /clear|reset/,
    ]
    expect(themes.filter((theme) => theme.test(names)).length).toBeGreaterThanOrEqual(7)
  })

  owntest(4, 'the reducer tests exercise all nine action types', () => {
    const text = ownTestFiles().filter((f) => /taskReducer.*\.test/.test(f.rel)).map((f) => f.text).join('\n')
    expect(text.length).toBeGreaterThan(0)
    const types = ['task/added', 'task/updated', 'task/moved', 'task/deleted', 'filters/queryChanged', 'filters/priorityChanged', 'filters/cleared']
    expect(types.filter((type) => !text.includes(type))).toEqual([])
    // the two newer actions may be tested in any of the model's own test files
    const everything = allText()
    expect(['tasks/doneCleared', 'filters/sortChanged'].filter((type) => !everything.includes(type))).toEqual([])
  })

  owntest(3, 'the form tests assert all three validation messages', () => {
    const text = allText()
    expect(text.length).toBeGreaterThan(0)
    for (const message of ['Title is required.', 'Title must be 80 characters or fewer.', 'Due date cannot be in the past.']) {
      expect(text, message).toContain(message)
    }
  })

  owntest(3, 'the reducer tests check immutability or reference stability, not just values', () => {
    const text = ownTestFiles().filter((f) => /taskReducer.*\.test/.test(f.rel)).map((f) => f.text).join('\n')
    expect(text.length).toBeGreaterThan(0)
    expect(text).toMatch(/\.toBe\(\s*(state|initial|before|previous|start|original)\w*\s*\)|Object\.freeze|deepFreeze|not\.toBe\(/)
  })

  owntest(2, 'tests that fake timers or spies restore them', () => {
    const text = allText()
    expect(text.length).toBeGreaterThan(0)
    if (/useFakeTimers/.test(text)) expect(text).toMatch(/useRealTimers/)
    if (/vi\.spyOn|vi\.stubGlobal|vi\.stubEnv/.test(text)) expect(text).toMatch(/restoreAllMocks|mockRestore|unstubAllGlobals|unstubAllEnvs|restoreMocks/)
  })

  owntest(3, 'date-dependent tests control "today" instead of relying on the real clock', () => {
    const text = ownTestFiles().filter((f) => /date\.test|TaskForm\.test|App\.test/.test(f.rel)).map((f) => f.text).join('\n')
    expect(text.length).toBeGreaterThan(0)
    expect(text).toMatch(/useFakeTimers|setSystemTime|new Date\(\s*20\d\d/)
    expect(text).not.toMatch(/Date\.now\(\)\s*[+-]/)
  })

  const namesMatching = (pattern: RegExp) => tests().filter((t) => pattern.test(t.name.toLowerCase()))

  owntest(3, 'there are at least 3 tests about sorting and one covers a tie or an undated task', () => {
    const found = namesMatching(/\bsort/)
    expect(found.length).toBeGreaterThanOrEqual(3)
    expect(found.some((t) => /tie|stable|undated|no due|without|last|same/.test(t.name.toLowerCase()))).toBe(true)
  })

  owntest(3, 'there are at least 3 tests about Clear completed and one covers a task a filter hides', () => {
    const found = namesMatching(/clear(s|ing)? (the )?(completed|done)|clear completed|done tasks?/)
    expect(found.length).toBeGreaterThanOrEqual(3)
    expect(found.some((t) => /filter|hidden|hiding|search/.test(t.name.toLowerCase()))).toBe(true)
  })

  owntest(3, 'there are at least 3 tests about keyboard shortcuts and one types inside a field', () => {
    const found = namesMatching(/shortcut|keyboard|\bkey\b|escape/)
    expect(found.length).toBeGreaterThanOrEqual(3)
    expect(found.some((t) => /field|input|textarea|typing|types|while/.test(t.name.toLowerCase()))).toBe(true)
  })
})
