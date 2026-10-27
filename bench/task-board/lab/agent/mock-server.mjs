// A fake OpenAI-compatible endpoint that "solves" the fix-date-file task with scripted tool calls.
// Used only by selftest.mjs to prove the runner, the sandbox, the accounting and the scoring work
// without any real model. Scenarios are chosen by the URL prefix: /tools /json /nousage /escape.
import http from 'node:http'

const FIXES = [
  ['dueDate <= toIsoDate(today)', 'dueDate < toIsoDate(today)'],
  ['MONTHS[Number(month)]', 'MONTHS[Number(month) - 1]'],
  [
    'return date.toISOString().slice(0, 10)',
    "const month = String(date.getMonth() + 1).padStart(2, '0')\n  const day = String(date.getDate()).padStart(2, '0')\n  return `${date.getFullYear()}-${month}-${day}`",
  ],
]

function plan(scenario) {
  const steps = [{ tool: 'read_file', args: { path: 'src/utils/date.ts' } }]
  if (scenario === 'escape') {
    steps.push({ tool: 'read_file', args: { path: '../../../../../etc/hosts' } })
    steps.push({ tool: 'replace_in_file', args: { path: 'src/utils/date.ts', old: 'this text is not in the file', new: 'x' } })
    steps.push({ tool: 'write_file', args: { path: '../outside.txt', content: 'x' } })
    steps.push({ tool: 'finish', args: { summary: 'gave up' } })
    return steps
  }
  for (const [old, replacement] of FIXES) steps.push({ tool: 'replace_in_file', args: { path: 'src/utils/date.ts', old, new: replacement } })
  steps.push({ tool: 'finish', args: { summary: 'fixed the three date bugs in src/utils/date.ts' } })
  return steps
}

const server = http.createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    const scenario = req.url.split('/')[1]
    const request = JSON.parse(body)
    const step = request.messages.filter((m) => m.role === 'assistant').length
    const next = plan(scenario)[step] ?? { tool: 'finish', args: { summary: 'done' } }
    const message =
      scenario === 'json'
        ? { role: 'assistant', content: `I will do this next.\n\`\`\`json\n${JSON.stringify({ tool: next.tool, args: next.args })}\n\`\`\`` }
        : { role: 'assistant', content: null, tool_calls: [{ id: `call_${step}`, type: 'function', function: { name: next.tool, arguments: JSON.stringify(next.args) } }] }
    const reply = { choices: [{ index: 0, message, finish_reason: 'stop' }] }
    if (scenario !== 'nousage') reply.usage = { prompt_tokens: 1000 + step * 400, completion_tokens: 60 }
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(reply))
  })
})
export function start() {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))
}
export const stop = () => new Promise((resolve) => server.close(resolve))
