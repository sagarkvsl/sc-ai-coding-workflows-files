#!/usr/bin/env node
// Scores a model's Task Board project against spec.md.
//
//   node score.mjs --target ../path/to/model-output [--name run-1]
//   node score.mjs --target reference                 # sanity check: should be ~100
//
// Flags: --skip-dynamic   only the hidden suite (fast, no own-test/bug runs)
//        --validate-bugs  check that the hidden suite catches every injected bug
//        --verbose        list every failing check
//        --concurrency N  parallel vitest runs for the bug step (default 4)
//        --violations F   JSON file from judge/audit.mjs; a broken run rule caps the total at 50

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUGS } from './judge/bugs.mjs'

const BENCH = path.dirname(fileURLToPath(import.meta.url))
const WORK = path.join(BENCH, '.work')
const REPORTS = path.join(BENCH, 'reports')
const VITEST = path.join(BENCH, 'node_modules', 'vitest', 'vitest.mjs')
const VITE = path.join(BENCH, 'node_modules', 'vite', 'bin', 'vite.js')
const TZ = 'America/Los_Angeles' // far from UTC, so date bugs show up

// Points per category. They add up to 100.
const CATEGORIES = {
  REQ: { label: 'Requirements completeness', points: 25 },
  EDGE: { label: 'Behaviour and edge cases', points: 18 },
  STATE: { label: 'State design and render efficiency', points: 14 },
  ARCH: { label: 'Architecture and modularity', points: 10 },
  TS: { label: 'TypeScript quality', points: 8 },
  QUAL: { label: 'Code quality', points: 7 },
  STYLE: { label: 'Styles, HTML and accessibility', points: 5 },
  OWNTEST: { label: "Quality of the model's own tests", points: 13 },
}

// Steep marking: a category earns points * (share of checks passed) ^ CURVE.
const CURVE = 3
// Hard caps on the total, applied after the curve.
const CAPS = { build: 60, typecheck: 85, rules: 50 }
// Share of the injected bugs the model's tests must catch for full marks.
const BUG_TARGET = 0.85

// ---------------------------------------------------------------- arguments
const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const targetArg = option('target', 'reference')
const target = path.resolve(process.cwd(), targetArg)
const name = option('name', path.basename(target)).replace(/[^\w.-]/g, '_')
const concurrency = Number(option('concurrency', '4'))

if (!fs.existsSync(path.join(target, 'src'))) {
  console.error(`No src/ folder in ${target}`)
  process.exit(2)
}

// ------------------------------------------------------------------ helpers
function copyProject(from, to) {
  fs.rmSync(to, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.cpSync(from, to, {
    recursive: true,
    filter: (p) => !/(^|\/)(node_modules|dist|\.git|coverage)(\/|$)/.test(p),
  })
}

function run(command, commandArgs, { cwd = BENCH, env = {}, timeout = 300000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd,
      env: { ...process.env, TZ, FORCE_COLOR: '0', ...env },
    })
    let output = ''
    child.stdout.on('data', (d) => (output += d))
    child.stderr.on('data', (d) => (output += d))
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, output })
    })
  })
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

async function vitest(extraArgs, { env = {}, label }) {
  const json = path.join(WORK, '_json', `${label}-${process.pid}-${Math.random().toString(36).slice(2)}.json`)
  fs.mkdirSync(path.dirname(json), { recursive: true })
  const result = await run(process.execPath, [VITEST, 'run', '--reporter=json', `--outputFile=${json}`, ...extraArgs], { env })
  const report = readJson(json)
  fs.rmSync(json, { force: true })
  const tests = new Map()
  for (const file of report?.testResults ?? []) {
    for (const t of file.assertionResults ?? []) tests.set(t.fullName, t.status)
  }
  return { tests, output: result.output, crashed: report === null }
}

const ownTests = (dir, label) =>
  vitest(['--root', dir, '--config', path.join(BENCH, 'vitest.own.config.ts')], { label })

const pool = async (items, size, worker) => {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        results[i] = await worker(items[i], i)
      }
    }),
  )
  return results
}

const isTestSupport = (rel) =>
  /\.(test|spec)\.[tj]sx?$/.test(rel) || /(^|\/)(__tests__|tests?|test-utils|testing)\//.test(rel)

function listFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    return e.isDirectory() ? listFiles(full) : [full]
  })
}

/** Builds <dest> = reference solution + the model's test files. */
function referenceWithModelTests(modelDir, dest) {
  copyProject(path.join(BENCH, 'reference'), dest)
  for (const file of listFiles(path.join(dest, 'src'))) {
    if (isTestSupport(path.relative(path.join(dest, 'src'), file))) fs.rmSync(file)
  }
  const modelSrc = path.join(modelDir, 'src')
  for (const file of listFiles(modelSrc)) {
    const rel = path.relative(modelSrc, file)
    if (!isTestSupport(rel)) continue
    fs.mkdirSync(path.dirname(path.join(dest, 'src', rel)), { recursive: true })
    fs.copyFileSync(file, path.join(dest, 'src', rel))
  }
}

function applyBug(dir, bug) {
  for (const edit of bug.edits) {
    const file = path.join(dir, edit.file)
    const text = fs.readFileSync(file, 'utf8')
    if (text.split(edit.find).length - 1 !== 1) throw new Error(`Bug ${bug.id}: pattern not unique in ${edit.file}`)
    fs.writeFileSync(file, text.replace(edit.find, () => edit.replace))
  }
}

const parseTag = (title) => {
  const m = title.match(/\[(REQ|EDGE|STATE|ARCH|TS|QUAL|STYLE|OWNTEST) ([\d.]+)\]\s*(.*)$/)
  return m ? { category: m[1], weight: Number(m[2]), name: m[3] } : null
}

// --------------------------------------------------------------------- main
const MANIFEST = path.join(BENCH, 'tests', 'manifest.json')
const entries = [] // { category, weight, score (0..1), name, kind }
const notes = []
const started = Date.now()
const modelWork = path.join(WORK, name)

console.log(`Scoring ${target}\n  work dir: ${modelWork}\n`)
copyProject(target, modelWork)

// 1. Hidden suite ----------------------------------------------------------
process.stdout.write('1/5 hidden behaviour + static suite ... ')
const hidden = await vitest([], { env: { TASKBOARD_TARGET: modelWork }, label: 'hidden' })
let hiddenCount = 0
const seen = new Map()
for (const [title, status] of hidden.tests) {
  const tag = parseTag(title)
  if (tag) seen.set(title, { tag, passed: status === 'passed' })
}
if (flag('write-manifest')) {
  fs.writeFileSync(MANIFEST, JSON.stringify([...seen.keys()].sort(), null, 2) + '\n')
  console.log(`\nwrote ${seen.size} titles to tests/manifest.json`)
}
// Every check in the manifest counts, even if its spec file could not load.
const expected = fs.existsSync(MANIFEST) ? readJson(MANIFEST) : [...seen.keys()]
for (const title of expected) {
  const tag = parseTag(title)
  if (!tag) continue
  hiddenCount += 1
  entries.push({ ...tag, score: seen.get(title)?.passed ? 1 : 0, kind: 'hidden' })
}
console.log(hidden.crashed ? 'CRASHED' : `${hiddenCount} checks`)
if (hidden.crashed) notes.push(`Hidden suite crashed:\n${hidden.output.slice(-1500)}`)

let buildFailed = false
if (!flag('skip-dynamic')) {
  // 2. Build ---------------------------------------------------------------
  process.stdout.write('2/5 vite build ... ')
  const build = await run(process.execPath, [VITE, 'build', modelWork, '--outDir', path.join(modelWork, 'dist')], { timeout: 120000 })
  console.log(build.code === 0 ? 'ok' : 'FAILED')
  buildFailed = build.code !== 0
  entries.push({ category: 'ARCH', weight: 4, score: build.code === 0 ? 1 : 0, name: 'vite build succeeds', kind: 'dynamic' })
  if (build.code !== 0) notes.push(`vite build failed:\n${build.output.slice(-800)}`)

  // 3. Model's own tests on the model's own code ---------------------------
  process.stdout.write("3/5 model's tests on the model's code ... ")
  const own = await ownTests(modelWork, 'own')
  const ownTotal = own.tests.size
  const ownPassed = [...own.tests.values()].filter((s) => s === 'passed').length
  console.log(`${ownPassed}/${ownTotal} pass`)
  entries.push({
    category: 'OWNTEST',
    weight: 8,
    score: ownTotal >= 20 ? ownPassed / ownTotal : 0,
    name: `the model's own tests pass on its own code (${ownPassed}/${ownTotal}, needs 20+ tests)`,
    kind: 'dynamic',
  })

  // 4. Model's tests on the clean reference --------------------------------
  process.stdout.write("4/5 model's tests on the reference solution ... ")
  const refDir = path.join(WORK, `${name}-on-reference`)
  referenceWithModelTests(modelWork, refDir)
  const clean = await ownTests(refDir, 'clean')
  const cleanPassed = [...clean.tests.values()].filter((s) => s === 'passed').length
  console.log(`${cleanPassed}/${clean.tests.size} pass`)
  entries.push({
    category: 'OWNTEST',
    weight: 12,
    score: clean.tests.size >= 20 ? cleanPassed / clean.tests.size : 0,
    name: `the model's tests also pass on the reference (they test the spec, not private details) (${cleanPassed}/${clean.tests.size})`,
    kind: 'dynamic',
  })

  // 5. Bug injection -------------------------------------------------------
  console.log(`5/5 injecting ${BUGS.length} bugs into the reference (concurrency ${concurrency})`)
  const baseline = new Set([...clean.tests].filter(([, s]) => s === 'passed').map(([n]) => n))
  if (baseline.size < 20) console.log('    (fewer than 20 usable tests: bug runs skipped, scored 0)')
  const bugResults = await pool(baseline.size < 20 ? [] : BUGS, concurrency, async (bug) => {
    const dir = path.join(WORK, `${name}-bug-${bug.id}`)
    copyProject(refDir, dir)
    applyBug(dir, bug)
    const result = await ownTests(dir, `bug-${bug.id}`)
    fs.rmSync(dir, { recursive: true, force: true })
    const failing = [...baseline].filter((n) => result.tests.get(n) !== 'passed')
    const killed = baseline.size > 0 && failing.length > 0
    process.stdout.write(killed ? 'x' : '.')
    return { bug, killed, failing: failing.length }
  })
  const killedCount = bugResults.filter((r) => r.killed).length
  const notKilled = baseline.size < 20 ? BUGS.map((bug) => ({ bug })) : bugResults.filter((r) => !r.killed)
  console.log(`\n    killed ${killedCount}/${BUGS.length} bugs`)
  // A good suite does not need to kill every subtle bug: BUG_TARGET earns full marks.
  entries.push({
    category: 'OWNTEST',
    weight: 30,
    score: baseline.size >= 20 ? Math.min(1, killedCount / BUGS.length / BUG_TARGET) : 0,
    name: `the model's tests catch injected bugs (${killedCount}/${BUGS.length} killed; ${BUG_TARGET * 100}% = full marks)`,
    kind: 'dynamic',
  })
  notes.push(
    `Bugs NOT caught by the model's tests:\n${notKilled
      .map((r) => `  - ${r.bug.id}  (${r.bug.rule})`)
      .join('\n') || '  (none)'}`,
  )

  // Optional: confirm the hidden suite itself catches each bug --------------
  if (flag('validate-bugs')) {
    console.log('validating bugs against the hidden behaviour suite ...')
    const missed = []
    await pool(BUGS, concurrency, async (bug) => {
      const dir = path.join(WORK, `${name}-validate-${bug.id}`)
      copyProject(path.join(BENCH, 'reference'), dir)
      applyBug(dir, bug)
      const result = await vitest(['tests/behavior'], { env: { TASKBOARD_TARGET: dir }, label: `validate-${bug.id}` })
      fs.rmSync(dir, { recursive: true, force: true })
      const failed = [...result.tests.values()].filter((s) => s === 'failed').length
      process.stdout.write(failed > 0 ? 'x' : '!')
      if (failed === 0) missed.push(bug.id)
    })
    console.log(missed.length ? `\n  NOT caught by hidden tests: ${missed.join(', ')}` : '\n  every bug is caught by the hidden behaviour suite')
  }
  fs.rmSync(refDir, { recursive: true, force: true })
}

// Scoring -------------------------------------------------------------------
const rows = Object.entries(CATEGORIES).map(([key, meta]) => {
  const mine = entries.filter((e) => e.category === key)
  const total = mine.reduce((sum, e) => sum + e.weight, 0)
  const earned = mine.reduce((sum, e) => sum + e.weight * e.score, 0)
  const ratio = total === 0 ? 0 : earned / total
  const curved = ratio ** CURVE
  return {
    key,
    ...meta,
    checks: mine.length,
    passed: mine.filter((e) => e.score === 1).length,
    ratio,
    curved,
    earned: curved * meta.points,
    failing: mine.filter((e) => e.score < 1),
  }
})
const maxPoints = flag('skip-dynamic')
  ? rows.reduce((s, r) => s + (r.key === 'OWNTEST' ? 0 : r.points), 0)
  : 100
const total = rows.reduce((s, r) => s + (flag('skip-dynamic') && r.key === 'OWNTEST' ? 0 : r.earned), 0)
const rawScore = flag('skip-dynamic') ? (total / maxPoints) * 100 : total

// Hard caps -----------------------------------------------------------------
const caps = []
if (buildFailed) caps.push({ reason: 'vite build failed', limit: CAPS.build })
const tscCheck = entries.find((e) => /^tsc --noEmit reports zero errors/.test(e.name))
if (tscCheck && tscCheck.score < 1) caps.push({ reason: 'tsc --noEmit reports errors', limit: CAPS.typecheck })
const violationsFile = option('violations', null)
const violations = violationsFile ? (readJson(path.resolve(process.cwd(), violationsFile))?.violations ?? []) : []
if (violations.length > 0) caps.push({ reason: `run rule broken: ${violations.join('; ')}`, limit: CAPS.rules })
const score = caps.reduce((s, c) => Math.min(s, c.limit), rawScore)
const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'

const pad = (s, n) => String(s).padEnd(n)
console.log('\n' + '-'.repeat(78))
console.log(`${pad('Category', 40)}${pad('Checks', 14)}${pad('Points', 12)}Score`)
console.log('-'.repeat(78))
for (const r of rows) {
  if (flag('skip-dynamic') && r.key === 'OWNTEST') continue
  console.log(
    `${pad(r.label, 40)}${pad(`${r.passed}/${r.checks}`, 14)}${pad(`${r.earned.toFixed(1)}/${r.points}`, 12)}${(r.ratio * 100).toFixed(0)}%`,
  )
}
console.log('-'.repeat(78))
if (caps.length > 0) {
  console.log(`before caps ${rawScore.toFixed(1)}`)
  for (const c of caps) console.log(`CAP ${c.limit}: ${c.reason}`)
}
console.log(`TOTAL ${score.toFixed(1)} / 100   grade ${grade}${flag('skip-dynamic') ? '   (own-test category skipped, scaled)' : ''}`)
console.log(`(${((Date.now() - started) / 1000).toFixed(0)}s)`)

if (flag('verbose') || rows.some((r) => r.failing.length > 0 && r.failing.length <= 6)) {
  console.log('\nFailing checks:')
  for (const r of rows) {
    const shown = flag('verbose') ? r.failing : r.failing.slice(0, 6)
    if (shown.length === 0) continue
    console.log(`\n  ${r.label}`)
    for (const e of shown) console.log(`    - [${e.weight}] ${e.name}${e.score > 0 ? ` (${(e.score * 100).toFixed(0)}%)` : ''}`)
    if (!flag('verbose') && r.failing.length > 6) console.log(`    ... and ${r.failing.length - 6} more (use --verbose)`)
  }
}
for (const note of notes) console.log(`\n${note}`)

fs.mkdirSync(REPORTS, { recursive: true })
const reportFile = path.join(REPORTS, `${name}.json`)
fs.writeFileSync(
  reportFile,
  JSON.stringify(
    {
      name,
      target,
      date: new Date().toISOString(),
      score: Number(score.toFixed(2)),
      rawScore: Number(rawScore.toFixed(2)),
      caps,
      grade,
      categories: rows.map(({ key, label, points, earned, ratio, checks, passed }) => ({
        key,
        label,
        points,
        earned: Number(earned.toFixed(2)),
        ratio: Number(ratio.toFixed(3)),
        checks,
        passed,
      })),
      checks: entries.map(({ category, weight, score: s, name: n, kind }) => ({ category, weight, score: s, name: n, kind })),
    },
    null,
    2,
  ),
)
console.log(`\nReport: ${path.relative(process.cwd(), reportFile)}`)
fs.rmSync(path.join(WORK, '_json'), { recursive: true, force: true })
process.exit(0)
