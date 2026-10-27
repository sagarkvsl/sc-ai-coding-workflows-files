#!/usr/bin/env node
// Self-test of the model runner against the mock server. No real model, no key, no cost.
//   node lab/agent/selftest.mjs
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { start, stop } from './mock-server.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BENCH = path.resolve(HERE, '../..')
const port = await start()
const base = `http://127.0.0.1:${port}`
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-selftest-'))
const models = { models: {} }
for (const scenario of ['tools', 'json', 'nousage', 'escape']) {
  models.models[scenario] = { label: `mock-${scenario}`, tier: 'self-hosted', baseUrl: `${base}/${scenario}/v1`, model: 'mock', toolMode: scenario === 'json' ? 'json' : 'native', price: { input: 1, output: 2 } }
}
const modelsFile = path.join(tmp, 'models.json')
fs.writeFileSync(modelsFile, JSON.stringify(models))
// Async on purpose: the mock server lives in this process, so a blocking spawn would starve it.
const node = (script, scriptArgs) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...scriptArgs], { cwd: BENCH })
    let stdout = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stdout += d))
    child.on('close', () => resolve({ stdout }))
  })
let failed = 0
const check = (label, ok, detail = '') => {
  if (!ok) failed += 1
  console.log(`${ok ? 'ok ' : 'BAD'} ${label}${detail ? `  (${detail})` : ''}`)
}

for (const scenario of ['tools', 'json', 'nousage', 'escape']) {
  const dir = path.join(tmp, scenario)
  await node('lab/lab.mjs', ['prepare', 'fix-date-file', dir])
  const run = await node('lab/agent/run-model.mjs', ['--model', scenario, '--models', modelsFile, '--dir', dir, '--name', `selftest-${scenario}`])
  const report = JSON.parse(fs.readFileSync(path.join(BENCH, 'reports', `selftest-${scenario}.run.json`), 'utf8'))
  const scored = await node('lab/lab.mjs', ['score', 'fix-date-file', dir, '--name', `selftest-${scenario}`])
  const total = Number(/TOTAL ([\d.]+)/.exec(scored.stdout)?.[1] ?? NaN)
  if (scenario === 'escape') {
    check('escape: the sandbox refused the outside read and write', report.toolErrors >= 3 && !fs.existsSync(path.join(tmp, 'outside.txt')), `${report.toolErrors} tool errors`)
    check('escape: the run ended on its own and the bugs are still there', report.stopReason === 'finished' && total < 60, `score ${total}`)
    continue
  }
  check(`${scenario}: the scripted model fixed the task`, total === 100, `score ${total}`)
  check(`${scenario}: stopped by finish`, report.stopReason === 'finished', report.stopReason)
  if (scenario === 'nousage') check('nousage: tokens estimated and flagged', report.usageEstimated === true && report.tokens.total > 0, `${report.tokens.total} tokens`)
  else check(`${scenario}: tokens and cost come from the reported usage`, report.tokens.input > 0 && report.usd > 0 && report.usageEstimated === false, `$${report.usd}`)
  check(`${scenario}: tier and model are recorded`, report.tier === 'self-hosted' && report.modelLabel === `mock-${scenario}`)
}
await stop()
for (const scenario of ['tools', 'json', 'nousage', 'escape']) for (const ext of ['json', 'run.json', 'transcript.jsonl']) fs.rmSync(path.join(BENCH, 'reports', `selftest-${scenario}.${ext}`), { force: true })
fs.rmSync(tmp, { recursive: true, force: true })
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
