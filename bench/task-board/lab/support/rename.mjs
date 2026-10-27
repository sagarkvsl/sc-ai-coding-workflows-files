import fs from 'node:fs'
import path from 'node:path'

// The two renames of the migration task, applied to text. Used to build the solved copy and the
// transformed regression suite, so both agree on what "correct" means.
const RULES = [
  [/\bdoing\b/g, 'review'],
  [/\btodo\b/g, 'backlog'],
  [/\bTo do\b/g, 'Backlog'],
  [/\bIn progress\b/g, 'In review'],
]
export const transformText = (text) => RULES.reduce((t, [from, to]) => t.replace(from, to), text)

export function transformTree(dir, accept = /\.(ts|tsx|css|html|md|json)$/) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (/(^|\/)(node_modules|dist)$/.test(full)) continue
    if (entry.isDirectory()) transformTree(full, accept)
    else if (accept.test(entry.name) && entry.name !== 'TASK.md') fs.writeFileSync(full, transformText(fs.readFileSync(full, 'utf8')))
  }
}
