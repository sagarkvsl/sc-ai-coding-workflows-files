import fs from 'node:fs'
import path from 'node:path'
import { BUGS } from '../../judge/bugs.mjs'

function edits(ids) {
  const found = BUGS.filter((b) => ids.includes(b.id))
  if (found.length !== ids.length) throw new Error(`unknown bug id in ${ids.join(', ')}`)
  return found.flatMap((b) => b.edits.map((e) => ({ ...e, id: b.id })))
}
export function applyBugs(dir, ids) {
  for (const e of edits(ids)) {
    const file = path.join(dir, e.file)
    const text = fs.readFileSync(file, 'utf8')
    if (text.split(e.find).length - 1 !== 1) throw new Error(`${e.id}: pattern not unique in ${e.file}`)
    fs.writeFileSync(file, text.replace(e.find, e.replace))
  }
}
export function revertBugs(dir, ids) {
  for (const e of edits(ids)) {
    const file = path.join(dir, e.file)
    const text = fs.readFileSync(file, 'utf8')
    if (text.split(e.replace).length - 1 < 1) throw new Error(`${e.id}: bug not present in ${e.file}`)
    fs.writeFileSync(file, text.replace(e.replace, e.find))
  }
}
