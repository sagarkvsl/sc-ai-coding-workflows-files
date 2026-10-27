#!/usr/bin/env node
// Prints one comparison table from reports/<name>.json (score) and reports/<name>.run.json (cost).
//   node judge/compare.mjs s1-opus-haiku s2-sonnet-solo s3-opus-sonnet
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPORTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'reports')
const names = process.argv.slice(2)
const read = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null)

const rows = names.map((name) => ({ name, score: read(path.join(REPORTS, `${name}.json`)), run: read(path.join(REPORTS, `${name}.run.json`)) }))
const cell = (value, width) => String(value).padEnd(width)
const money = (usd) => (usd === undefined ? 'n/a' : `$${usd.toFixed(2)}`)
const millions = (tokens) => (tokens === undefined ? 'n/a' : `${(tokens / 1e6).toFixed(2)}M`)

console.log([cell('Run', 20), cell('Score', 8), cell('Before caps', 12), cell('Tokens', 9), cell('Cost', 8), cell('Sub-agents', 11), cell('Time', 7), cell('Points per $', 13), 'Rule breaks'].join(''))
for (const { name, score, run } of rows) {
  const perDollar = score && run && run.usd > 0 ? (score.score / run.usd).toFixed(0) : 'n/a'
  console.log([
    cell(name, 20),
    cell(score ? score.score.toFixed(1) : 'n/a', 8),
    cell(score ? score.rawScore?.toFixed(1) ?? score.score.toFixed(1) : 'n/a', 12),
    cell(millions(run?.tokens.total), 9),
    cell(money(run?.usd), 8),
    cell(run ? run.subagentCount : 'n/a', 11),
    cell(run ? `${(run.wallSeconds / 60).toFixed(1)}m` : 'n/a', 7),
    cell(perDollar, 13),
    run ? run.violations.length : 'n/a',
  ].join(''))
}
console.log('\nCategory points (after the curve)')
const keys = rows.find((r) => r.score)?.score.categories.map((c) => c.key) ?? []
console.log([cell('Category', 38), ...rows.map((r) => cell(r.name, 18))].join(''))
for (const key of keys) {
  const label = rows.find((r) => r.score).score.categories.find((c) => c.key === key)
  console.log([cell(`${label.label} (${label.points})`, 38), ...rows.map((r) => cell(r.score ? r.score.categories.find((c) => c.key === key).earned.toFixed(1) : 'n/a', 18))].join(''))
}
