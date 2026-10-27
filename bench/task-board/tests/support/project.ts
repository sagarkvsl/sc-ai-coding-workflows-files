import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export const TARGET = path.resolve(process.env.TASKBOARD_TARGET ?? 'reference')
export const SRC = path.join(TARGET, 'src')

export interface SourceFile {
  rel: string // relative to src, posix style
  abs: string
  text: string
}

function walkDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walkDir(full)
    return [full]
  })
}

const TEST_FILE = /\.(test|spec)\.[tj]sx?$/
const TEST_DIRS = /(^|\/)(__tests__|tests?|test-utils|testing)\//

export function isTestFile(rel: string): boolean {
  return TEST_FILE.test(rel) || TEST_DIRS.test(rel) || /(^|\/)setupTests\.[tj]s$/.test(rel)
}

function load(files: string[]): SourceFile[] {
  return files.map((abs) => ({
    rel: path.relative(SRC, abs).split(path.sep).join('/'),
    abs,
    text: fs.readFileSync(abs, 'utf8'),
  }))
}

const CODE = /\.(ts|tsx)$/

/** Non-test TypeScript sources under src/. */
export function sourceFiles(): SourceFile[] {
  return load(walkDir(SRC).filter((f) => CODE.test(f))).filter(
    (f) => !isTestFile(f.rel) && !f.rel.endsWith('.d.ts'),
  )
}

/** The model's own test files under src/. */
export function ownTestFiles(): SourceFile[] {
  return load(walkDir(SRC).filter((f) => CODE.test(f))).filter((f) => TEST_FILE.test(f.rel))
}

/** Shared test helpers (src/test/**, test-utils/**), which are neither source nor *.test.* files. */
export function testHelperFiles(): SourceFile[] {
  return load(walkDir(SRC).filter((f) => CODE.test(f))).filter((f) => TEST_DIRS.test(f.rel) && !TEST_FILE.test(f.rel))
}

export function cssFiles(): SourceFile[] {
  return load(walkDir(SRC).filter((f) => f.endsWith('.css')))
}

export function readTarget(rel: string): string | null {
  const file = path.join(TARGET, rel)
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
}

export function readSrc(rel: string): string | null {
  return readTarget(path.join('src', rel))
}

/** Static checks must not pass vacuously on an empty project. */
export function requireSources(min = 8): SourceFile[] {
  const files = sourceFiles()
  if (files.length < min) {
    throw new Error(`Only ${files.length} source files found (need at least ${min}) - nothing to analyse`)
  }
  return files
}

export function parse(file: { rel: string; text: string }): ts.SourceFile {
  const kind = file.rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(file.rel, file.text, ts.ScriptTarget.Latest, true, kind)
}

export function visit(node: ts.Node, callback: (node: ts.Node) => void) {
  callback(node)
  ts.forEachChild(node, (child) => visit(child, callback))
}

export function collect<T extends ts.Node>(
  root: ts.Node,
  guard: (node: ts.Node) => node is T,
): T[] {
  const found: T[] = []
  visit(root, (node) => {
    if (guard(node)) found.push(node)
  })
  return found
}

export function lineOf(sf: ts.SourceFile, pos: number): number {
  return sf.getLineAndCharacterOfPosition(pos).line + 1
}

export function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  )
}

/** Cyclomatic complexity of one function, not counting nested functions. */
export function complexity(fn: ts.FunctionLikeDeclaration): number {
  let score = 1
  const walk = (node: ts.Node) => {
    if (node !== fn && isFunctionLike(node)) return
    if (
      ts.isIfStatement(node) ||
      ts.isConditionalExpression(node) ||
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isCaseClause(node) ||
      ts.isCatchClause(node)
    ) {
      score += 1
    }
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(node.operatorToken.kind)
    ) {
      score += 1
    }
    ts.forEachChild(node, walk)
  }
  ts.forEachChild(fn, walk)
  return score
}

export interface ImportInfo {
  specifier: string
  typeOnly: boolean
}

export function importsOf(sf: ts.SourceFile): ImportInfo[] {
  return sf.statements.filter(ts.isImportDeclaration).map((decl) => ({
    specifier: (decl.moduleSpecifier as ts.StringLiteral).text,
    typeOnly: decl.importClause?.isTypeOnly ?? false,
  }))
}

/** Resolves a relative import to the rel path of a source file, if it exists. */
export function resolveImport(fromRel: string, specifier: string, known: Set<string>): string | null {
  if (!specifier.startsWith('.')) return null
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), specifier))
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
  return candidates.find((c) => known.has(c)) ?? null
}

export function topDir(rel: string): string {
  return rel.includes('/') ? rel.split('/')[0] : '.'
}
