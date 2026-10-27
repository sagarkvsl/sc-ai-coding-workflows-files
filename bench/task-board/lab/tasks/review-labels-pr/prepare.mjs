import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFECTS } from './defects.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const LAB = path.resolve(HERE, '../..')

// `dir` already holds a copy of the baseline. Turn it into "the repository after the PR".
export async function prepare(dir) {
  const before = fs.mkdtempSync(path.join(os.tmpdir(), 'review-before-'))
  fs.cpSync(dir, before, { recursive: true })
  fs.cpSync(path.join(LAB, 'tasks', 'labels-feature', 'solution'), dir, { recursive: true })
  for (const d of DEFECTS) {
    const file = path.join(dir, d.file)
    const text = fs.readFileSync(file, 'utf8')
    if (text.split(d.find).length - 1 !== 1) throw new Error(`${d.id}: pattern not unique in ${d.file}`)
    fs.writeFileSync(file, text.replace(d.find, d.replace))
  }
  let diff = ''
  try {
    execFileSync('diff', ['-ruN', '-x', 'node_modules', '-x', 'TASK.md', 'before', 'after'], { cwd: path.dirname(before), stdio: 'pipe' })
  } catch (error) {
    diff = ''
  }
  // Build the diff with stable a/ and b/ names.
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'review-diff-'))
  fs.symlinkSync(before, path.join(parent, 'a'))
  fs.symlinkSync(dir, path.join(parent, 'b'))
  try {
    execFileSync('diff', ['-ruN', '-x', 'node_modules', '-x', 'TASK.md', '-x', 'PR.diff', 'a/', 'b/'], { cwd: parent, stdio: 'pipe' })
  } catch (error) {
    diff = String(error.stdout ?? '')
  }
  fs.writeFileSync(path.join(dir, 'PR.diff'), diff)
  fs.rmSync(before, { recursive: true, force: true })
  fs.rmSync(parent, { recursive: true, force: true })
  fs.writeFileSync(
    path.join(dir, 'LABELS_SPEC.md'),
    fs.readFileSync(path.join(LAB, 'tasks', 'labels-feature', 'task.md'), 'utf8').replace('# Task: add labels to tasks', '# Labels: what the PR must implement'),
  )
}
