#!/usr/bin/env node
// Runs ONE model on ONE prepared lab task through a small, model-agnostic agent loop.
// Works with any OpenAI-compatible chat endpoint: a local server (Ollama, LM Studio, llama.cpp,
// vLLM), a free-tier provider, or a paid frontier model. Every model gets the same tools, the
// same prompt and the same limits, so the comparison is about the model and not the harness.
//
//   node lab/agent/run-model.mjs --model <key from models.json> --dir <prepared task folder> --name <label>
//        [--models lab/models.json] [--max-turns 60] [--timeout 300]
//
// Tools: list_dir, read_file, search_text, write_file, replace_in_file, finish. There is no shell, so
// "no command that runs the project" holds by construction. Output: reports/<name>.run.json (tokens,
// cost, time, turns; same shape as judge/audit.mjs) and reports/<name>.transcript.jsonl.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const LAB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BENCH = path.resolve(LAB, '..')
const args = process.argv.slice(2)
const option = (key, fallback) => {
  const i = args.indexOf(`--${key}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const modelKey = option('model')
const dir = path.resolve(option('dir', '.'))
const name = option('name', `${modelKey}-run`).replace(/[^\w.-]/g, '_')
const modelsFile = path.resolve(option('models', path.join(LAB, 'models.json')))
const MAX_TURNS = Number(option('max-turns', '60'))
const TIMEOUT_MS = Number(option('timeout', '300')) * 1000
if (!modelKey || !fs.existsSync(path.join(dir, 'TASK.md'))) {
  console.error('usage: node lab/agent/run-model.mjs --model <key> --dir <prepared folder with TASK.md> --name <label>')
  process.exit(2)
}
const config = JSON.parse(fs.readFileSync(modelsFile, 'utf8')).models[modelKey]
if (!config) {
  console.error(`unknown model "${modelKey}" in ${modelsFile}`)
  process.exit(2)
}
const apiKey = config.apiKeyEnv ? process.env[config.apiKeyEnv] : undefined
if (config.apiKeyEnv && !apiKey) {
  console.error(`${config.apiKeyEnv} is not set (needed for ${modelKey})`)
  process.exit(2)
}

// ---------------------------------------------------------------- tools
const READ_LIMIT = 400
const OUTPUT_LIMIT = 12000
const blocked = /(^|\/)(node_modules|\.git|dist)(\/|$)/
function resolveInside(rel) {
  const full = path.resolve(dir, String(rel ?? '.'))
  if (full !== dir && !full.startsWith(dir + path.sep)) throw new Error('path is outside the repository')
  if (blocked.test(path.relative(dir, full))) throw new Error('that folder is not available')
  return full
}
function walk(base) {
  return fs.readdirSync(base, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(base, e.name)
    if (blocked.test(path.relative(dir, full))) return []
    return e.isDirectory() ? walk(full) : [full]
  })
}
const clip = (text) => (text.length > OUTPUT_LIMIT ? `${text.slice(0, OUTPUT_LIMIT)}\n[output cut at ${OUTPUT_LIMIT} characters]` : text)

const TOOLS = {
  list_dir: {
    description: 'List the entries of a folder in the repository. Folders end with /.',
    parameters: { path: { type: 'string', description: 'folder, relative to the repository root. Use "." for the root.' } },
    required: ['path'],
    run: ({ path: p }) => {
      const full = resolveInside(p)
      return fs.readdirSync(full, { withFileTypes: true }).filter((e) => !blocked.test(e.name)).map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join('\n')
    },
  },
  read_file: {
    description: `Read a text file. Lines are numbered. At most ${READ_LIMIT} lines per call; use start_line and end_line to read more.`,
    parameters: { path: { type: 'string' }, start_line: { type: 'integer' }, end_line: { type: 'integer' } },
    required: ['path'],
    run: ({ path: p, start_line, end_line }) => {
      const lines = fs.readFileSync(resolveInside(p), 'utf8').split('\n')
      const from = Math.max(1, Number(start_line) || 1)
      const to = Math.min(lines.length, Number(end_line) || from + READ_LIMIT - 1, from + READ_LIMIT - 1)
      const body = lines.slice(from - 1, to).map((l, i) => `${from + i}\t${l}`).join('\n')
      return clip(`${p} (lines ${from}-${to} of ${lines.length})\n${body}`)
    },
  },
  search_text: {
    description: 'Search every text file under a folder for a regular expression. Returns file:line: text for up to 60 matches.',
    parameters: { pattern: { type: 'string' }, path: { type: 'string', description: 'folder to search, default "."' } },
    required: ['pattern'],
    run: ({ pattern, path: p }) => {
      const re = new RegExp(String(pattern))
      const hits = []
      for (const file of walk(resolveInside(p ?? '.'))) {
        if (!/\.(ts|tsx|css|html|md|json|mjs)$/.test(file)) continue
        fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          if (hits.length < 60 && re.test(line)) hits.push(`${path.relative(dir, file)}:${i + 1}: ${line.trim().slice(0, 160)}`)
        })
      }
      return hits.length ? hits.join('\n') : 'no matches'
    },
  },
  write_file: {
    description: 'Create or completely replace a file with the given content. Folders are created as needed.',
    parameters: { path: { type: 'string' }, content: { type: 'string' } },
    required: ['path', 'content'],
    run: ({ path: p, content }) => {
      const full = resolveInside(p)
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, String(content))
      return `wrote ${p} (${String(content).split('\n').length} lines)`
    },
  },
  replace_in_file: {
    description: 'In an existing file, replace one exact piece of text with another. `old` must occur exactly once.',
    parameters: { path: { type: 'string' }, old: { type: 'string' }, new: { type: 'string' } },
    required: ['path', 'old', 'new'],
    run: ({ path: p, old, new: replacement }) => {
      const full = resolveInside(p)
      const text = fs.readFileSync(full, 'utf8')
      const count = text.split(String(old)).length - 1
      if (count !== 1) throw new Error(`"old" occurs ${count} times in ${p}; it must occur exactly once. Include more context.`)
      fs.writeFileSync(full, text.replace(String(old), () => String(replacement)))
      return `edited ${p}`
    },
  },
  finish: {
    description: 'Call this when the task is done. Give a short summary of what you changed.',
    parameters: { summary: { type: 'string' } },
    required: ['summary'],
    run: ({ summary }) => `finished: ${summary}`,
  },
}
const toolSpecs = Object.entries(TOOLS).map(([toolName, t]) => ({
  type: 'function',
  function: { name: toolName, description: t.description, parameters: { type: 'object', properties: t.parameters, required: t.required } },
}))

// ---------------------------------------------------------------- prompt
const taskText = fs.readFileSync(path.join(dir, 'TASK.md'), 'utf8')
const SYSTEM = `You are a software engineer working in a code repository. You can only use the tools provided: you can read, search and edit files, but you cannot run any command, install anything, or run the tests. Work carefully, because nothing can be checked by running it. Read the code you need before you change it, make the smallest correct change, and call finish when you are done. Stay inside the repository.${config.toolMode === 'json' ? `

You have no native tool calling. To use a tool, reply with ONLY one JSON object in a fenced json block, for example:
\`\`\`json
{"tool": "read_file", "args": {"path": "src/App.tsx"}}
\`\`\`
Tools and their arguments:
${Object.entries(TOOLS).map(([n, t]) => `- ${n}(${Object.keys(t.parameters).join(', ')}): ${t.description}`).join('\n')}` : ''}`

// ---------------------------------------------------------------- model call
const started = Date.now()
const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: taskText }]
const transcript = []
const usage = { input: 0, output: 0, estimated: false }
const toolCounts = {}
let toolErrors = 0
let trimmed = 0
let stopReason = 'max-turns'
const estimate = (msgs) => Math.ceil(JSON.stringify(msgs).length / 4)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Free tiers rate-limit and local servers sometimes hiccup: retry 429 and 5xx a few times.
async function callModel() {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await callOnce()
    } catch (error) {
      const retryable = /^HTTP (429|5\d\d)/.test(error.message) || error.name === 'AbortError'
      if (!retryable || attempt >= 4) throw error
      await sleep(2000 * 2 ** (attempt - 1))
    }
  }
}

async function callOnce() {
  const body = { model: config.model, messages, temperature: 0, ...(config.toolMode === 'json' ? {} : { tools: toolSpecs, tool_choice: 'auto' }), ...(config.extraBody ?? {}) }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

function parseJsonCall(text) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const raw = fenced ? fenced[1] : text
  try {
    const parsed = JSON.parse(raw.trim())
    return parsed?.tool ? { name: parsed.tool, args: parsed.args ?? {} } : null
  } catch {
    return null
  }
}

function elideOld() {
  if (!config.contextTokens || estimate(messages) < config.contextTokens * 0.8) return
  for (const m of messages) {
    if (m.role === 'tool' && m.content.length > 300 && m.content !== '[older tool output removed to save context]') {
      m.content = '[older tool output removed to save context]'
      trimmed += 1
      if (estimate(messages) < config.contextTokens * 0.6) break
    }
  }
}

let idleTurns = 0
for (let turn = 1; turn <= MAX_TURNS; turn += 1) {
  elideOld()
  let reply
  try {
    reply = await callModel()
  } catch (error) {
    stopReason = `model error: ${String(error.message).slice(0, 200)}`
    break
  }
  const message = reply.choices?.[0]?.message ?? {}
  if (reply.usage) {
    usage.input += reply.usage.prompt_tokens ?? 0
    usage.output += reply.usage.completion_tokens ?? 0
  } else {
    usage.estimated = true
    usage.input += estimate(messages)
    usage.output += Math.ceil(JSON.stringify(message).length / 4)
  }
  let calls = (message.tool_calls ?? []).map((c) => {
    let parsedArgs = {}
    try {
      parsedArgs = JSON.parse(c.function?.arguments || '{}')
    } catch {
      parsedArgs = { __invalid: true }
    }
    return { id: c.id, name: c.function?.name, args: parsedArgs }
  })
  if (config.toolMode === 'json') {
    const call = parseJsonCall(message.content ?? '')
    calls = call ? [{ id: `json-${turn}`, ...call }] : []
  }
  transcript.push({ turn, content: (message.content ?? '').slice(0, 2000), calls: calls.map((c) => ({ name: c.name, args: c.args })) })
  messages.push(config.toolMode === 'json' ? { role: 'assistant', content: message.content ?? '' } : { role: 'assistant', content: message.content ?? null, tool_calls: message.tool_calls })
  if (calls.length === 0) {
    idleTurns += 1
    if (idleTurns >= 2) {
      stopReason = 'stopped without calling finish'
      break
    }
    messages.push({ role: 'user', content: 'Continue by calling a tool, or call finish if the task is done.' })
    continue
  }
  idleTurns = 0
  let finished = false
  for (const call of calls) {
    toolCounts[call.name] = (toolCounts[call.name] ?? 0) + 1
    let result
    try {
      if (!TOOLS[call.name]) throw new Error(`unknown tool "${call.name}"`)
      if (call.args.__invalid) throw new Error('arguments were not valid JSON')
      result = TOOLS[call.name].run(call.args)
    } catch (error) {
      toolErrors += 1
      result = `error: ${error.message}`
    }
    transcript.push({ turn, tool: call.name, result: String(result).slice(0, 600) })
    messages.push(config.toolMode === 'json' ? { role: 'user', content: `Result of ${call.name}:\n${result}` } : { role: 'tool', tool_call_id: call.id, content: String(result) })
    if (call.name === 'finish') finished = true
  }
  if (finished) {
    stopReason = 'finished'
    break
  }
}

// ---------------------------------------------------------------- report
const price = config.price ?? { input: 0, output: 0 }
const usd = (usage.input * price.input + usage.output * price.output) / 1e6
const result = {
  name,
  workdir: dir,
  harness: 'lab-agent',
  modelLabel: config.label ?? modelKey,
  tier: config.tier ?? 'unknown',
  model: config.model,
  rootAgent: modelKey,
  agentCount: 1,
  subagentCount: 0,
  turns: transcript.filter((t) => t.calls).length,
  toolCounts,
  toolErrors,
  trimmedToolOutputs: trimmed,
  stopReason,
  tokens: { input: usage.input, output: usage.output, cacheRead: 0, cacheWrite: 0, total: usage.input + usage.output },
  usageEstimated: usage.estimated,
  usd: Number(usd.toFixed(4)),
  unpricedModels: config.price === undefined,
  wallSeconds: (Date.now() - started) / 1000,
  violations: [],
  pricing: { source: 'lab/models.json', note: 'free-tier and self-hosted models are priced at 0 unless set; self-hosted still costs hardware and time' },
}
fs.mkdirSync(path.join(BENCH, 'reports'), { recursive: true })
fs.writeFileSync(path.join(BENCH, 'reports', `${name}.run.json`), JSON.stringify(result, null, 2))
fs.writeFileSync(path.join(BENCH, 'reports', `${name}.transcript.jsonl`), transcript.map((t) => JSON.stringify(t)).join('\n'))
console.log(`${name}: ${result.modelLabel} (${result.tier}) ${result.stopReason}, ${result.turns} turns, ${result.tokens.total.toLocaleString('en-US')} tokens${result.usageEstimated ? ' (estimated)' : ''}, $${result.usd.toFixed(4)}, ${result.wallSeconds.toFixed(0)}s, ${toolErrors} tool error(s)`)
