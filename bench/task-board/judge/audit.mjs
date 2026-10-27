#!/usr/bin/env node
// Audits one benchmark run from its agent transcripts: how many tokens and dollars it used,
// how many sub-agents it started, and whether it broke a rule of the run (spec.md section 14).
//
//   node judge/audit.mjs --root <agentId> --workdir <folder> --name <label> [--orchestrator]
//
// Transcripts are read from the Claude Code projects folder (--dir to override). Every agent
// that the root started, directly or through other agents, is found from the tool results.
// Output: reports/<name>.run.json (and a short summary on stdout).

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BENCH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = (key, fallback) => {
  const i = args.indexOf(`--${key}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const root = option('root')
const workdir = path.resolve(option('workdir', '.'))
const name = option('name', root)
const isOrchestrator = args.includes('--orchestrator')
const modelLabel = option('label', null) // for example "opus-5.5 solo"
const tier = option('tier', 'frontier')
const MAX_SUBAGENTS = 3
if (!root) {
  console.error('usage: node judge/audit.mjs --root <agentId> --workdir <folder> --name <label> [--orchestrator]')
  process.exit(2)
}

function findDir() {
  const given = option('dir', null)
  if (given) return given
  const base = path.join(os.homedir(), '.claude', 'projects')
  for (const project of fs.readdirSync(base)) {
    for (const session of fs.readdirSync(path.join(base, project))) {
      const candidate = path.join(base, project, session, 'subagents')
      if (fs.existsSync(path.join(candidate, `agent-${root}.jsonl`))) return candidate
    }
  }
  console.error(`No transcript found for agent ${root}`)
  process.exit(2)
}
const DIR = findDir()
const PRICES = JSON.parse(fs.readFileSync(path.join(BENCH, 'judge', 'pricing.json'), 'utf8'))

function readAgent(id) {
  const file = path.join(DIR, `agent-${id}.jsonl`)
  if (!fs.existsSync(file)) return null
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })
}

function cost(model, usage) {
  const table = PRICES.models[model]
  if (!table) return { usd: 0, known: false }
  const input = usage.input_tokens ?? 0
  const read = usage.cache_read_input_tokens ?? 0
  const write = usage.cache_creation_input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  const rates = table.long && input + read + write > table.longPromptTokens ? table.long : table
  const usd = (input * rates.input + read * rates.cacheRead + write * rates.cacheWrite + output * rates.output) / 1e6
  return { usd, known: true }
}

// Walk the tree of agents -------------------------------------------------------------------
const agents = []
const queue = [{ id: root, parent: null, depth: 0 }]
const seen = new Set()
while (queue.length > 0) {
  const { id, parent, depth } = queue.shift()
  if (seen.has(id)) continue
  seen.add(id)
  const entries = readAgent(id)
  if (entries === null) {
    agents.push({ id, parent, depth, missing: true })
    continue
  }
  const calls = new Map()
  const toolUses = []
  const stamps = []
  for (const entry of entries) {
    if (entry.timestamp) stamps.push(Date.parse(entry.timestamp))
    if (entry.type === 'assistant' && entry.message?.usage) {
      calls.set(entry.message.id ?? entry.uuid, { model: entry.message.model, usage: entry.message.usage })
      for (const block of entry.message.content ?? []) {
        if (block.type === 'tool_use') toolUses.push({ name: block.name, input: block.input ?? {} })
      }
    }
    const launched = entry.toolUseResult?.agentId
    if (launched && launched !== id) queue.push({ id: launched, parent: id, depth: depth + 1 })
  }
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  let usd = 0
  let unknownModel = false
  const models = new Set()
  for (const { model, usage } of calls.values()) {
    models.add(model)
    tokens.input += usage.input_tokens ?? 0
    tokens.output += usage.output_tokens ?? 0
    tokens.cacheRead += usage.cache_read_input_tokens ?? 0
    tokens.cacheWrite += usage.cache_creation_input_tokens ?? 0
    const c = cost(model, usage)
    usd += c.usd
    if (!c.known) unknownModel = true
  }
  agents.push({
    id,
    parent,
    depth,
    models: [...models],
    apiCalls: calls.size,
    tokens,
    usd,
    unknownModel,
    seconds: stamps.length > 1 ? (Math.max(...stamps) - Math.min(...stamps)) / 1000 : 0,
    toolUses,
  })
}

// Rule checks -------------------------------------------------------------------------------
const violations = []
const subagents = agents.filter((a) => a.depth > 0)
if (subagents.length > MAX_SUBAGENTS) violations.push(`${subagents.length} sub-agents started (limit ${MAX_SUBAGENTS})`)

const EXECUTES = /(^|[\s;&|(])(npm|npx|node|tsc|vitest|vite|yarn|pnpm|bun|deno)(\s|$)/
const insideWork = (p) => typeof p === 'string' && path.resolve(workdir, p).startsWith(workdir)
const pathKeys = ['file_path', 'path', 'notebook_path']
for (const agent of agents.filter((a) => !a.missing)) {
  const who = agent.depth === 0 ? 'root' : `sub-agent ${agent.id.slice(0, 6)}`
  for (const use of agent.toolUses) {
    if (use.name === 'Bash') {
      const command = String(use.input.command ?? '')
      if (EXECUTES.test(command)) violations.push(`${who} ran a command: ${command.replace(/\s+/g, ' ').slice(0, 80)}`)
      if (/\/Users\/[^/\s]+\/Projects\/|\/bench\/|\/judge\/|\/reference\//.test(command)) violations.push(`${who} touched the benchmark folders in a command`)
    }
    for (const key of pathKeys) {
      const value = use.input[key]
      if (value && ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'NotebookEdit'].includes(use.name) && !insideWork(value)) {
        violations.push(`${who} used ${use.name} outside the working folder: ${String(value).slice(0, 80)}`)
      }
    }
    if (isOrchestrator && agent.depth === 0 && ['Write', 'Edit', 'NotebookEdit'].includes(use.name)) {
      violations.push(`orchestrator wrote a file itself: ${String(use.input.file_path ?? '').slice(-60)}`)
    }
  }
}
const unique = [...new Set(violations)]

// Totals ------------------------------------------------------------------------------------
const sum = (key) => agents.reduce((s, a) => s + (a.tokens?.[key] ?? 0), 0)
const rootAgent = agents.find((a) => a.depth === 0)
const byModel = {}
for (const a of agents.filter((x) => !x.missing)) {
  for (const model of a.models) {
    const row = (byModel[model] ??= { agents: 0, usd: 0 })
    row.agents += 1
  }
}
const result = {
  name,
  workdir,
  rootAgent: root,
  harness: 'claude-code-agents',
  modelLabel: modelLabel ?? [...new Set(agents.flatMap((x) => x.models ?? []))].join(' + '),
  tier,
  agentCount: agents.length,
  subagentCount: subagents.length,
  missingTranscripts: agents.filter((a) => a.missing).length,
  tokens: { input: sum('input'), output: sum('output'), cacheRead: sum('cacheRead'), cacheWrite: sum('cacheWrite') },
  usd: Number(agents.reduce((s, a) => s + (a.usd ?? 0), 0).toFixed(4)),
  unpricedModels: agents.some((a) => a.unknownModel),
  wallSeconds: rootAgent?.seconds ?? 0,
  violations: unique,
  agents: agents.map(({ toolUses, ...rest }) => ({ ...rest, toolUseCounts: (toolUses ?? []).reduce((m, t) => ({ ...m, [t.name]: (m[t.name] ?? 0) + 1 }), {}) })),
  pricing: { source: PRICES.source, assumptions: PRICES.assumptions },
}
result.tokens.total = result.tokens.input + result.tokens.output + result.tokens.cacheRead + result.tokens.cacheWrite
fs.mkdirSync(path.join(BENCH, 'reports'), { recursive: true })
const file = path.join(BENCH, 'reports', `${name}.run.json`)
fs.writeFileSync(file, JSON.stringify(result, null, 2))
console.log(`${name}: ${result.agentCount} agent(s), ${result.subagentCount} sub-agent(s), ${result.tokens.total.toLocaleString('en-US')} tokens, $${result.usd.toFixed(4)}, ${result.wallSeconds.toFixed(0)}s`)
console.log(unique.length ? `violations:\n  - ${unique.join('\n  - ')}` : 'no rule violations')
console.log(`wrote ${path.relative(process.cwd(), file)}`)
