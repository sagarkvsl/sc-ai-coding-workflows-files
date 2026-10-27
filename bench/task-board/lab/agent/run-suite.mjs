#!/usr/bin/env node
// Runs one model through the lab tasks, one after another: prepare, run, score.
//
//   node lab/agent/run-suite.mjs --model <key from models.json> [--tasks fix-date-file,labels-feature] [--out ../../runs]
//
// Results go to reports/<model>__<task>.json (score) and .run.json (tokens, cost, time).
// Then: node lab/lab.mjs pivot
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BENCH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const option = (key, fallback) => {
  const i = args.indexOf(`--${key}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const model = option('model')
if (!model) {
  console.error('usage: node lab/agent/run-suite.mjs --model <key> [--tasks a,b] [--out folder]')
  process.exit(2)
}
const all = fs.readdirSync(path.join(BENCH, 'lab', 'tasks')).filter((d) => fs.existsSync(path.join(BENCH, 'lab', 'tasks', d, 'meta.json')))
const tasks = option('tasks', all.join(',')).split(',')
const out = path.resolve(BENCH, option('out', '../../runs'))
const run = (script, scriptArgs) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...scriptArgs], { cwd: BENCH, stdio: 'inherit' })
    child.on('close', (code) => resolve(code))
  })

for (const task of tasks) {
  const name = `${model}__${task}`
  const dir = path.join(out, model, task)
  console.log(`\n=== ${name}`)
  await run('lab/lab.mjs', ['prepare', task, dir])
  await run('lab/agent/run-model.mjs', ['--model', model, '--dir', dir, '--name', name, ...(option('models') ? ['--models', option('models')] : [])])
  await run('lab/lab.mjs', ['score', task, dir, '--name', name, '--violations', `reports/${name}.run.json`])
}
console.log('\nDone. Compare models with: node lab/lab.mjs pivot')
