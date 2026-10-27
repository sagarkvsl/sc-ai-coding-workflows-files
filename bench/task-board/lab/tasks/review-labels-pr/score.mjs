import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFECTS } from './defects.mjs'
import { prepare } from './prepare.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const LAB = path.resolve(HERE, '../..')
const TOLERANCE = 4

function lineOf(text, needle) {
  const index = text.indexOf(needle)
  return index < 0 ? -1 : text.slice(0, index).split('\n').length
}

export async function scoreTask(work) {
  // Where each planted defect really is, from a freshly prepared copy.
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'review-fresh-'))
  fs.cpSync(path.join(LAB, 'baseline'), fresh, { recursive: true })
  await prepare(fresh)
  const places = DEFECTS.map((d) => ({ ...d, line: lineOf(fs.readFileSync(path.join(fresh, d.file), 'utf8'), d.replace) }))
  fs.rmSync(fresh, { recursive: true, force: true })

  let findings = []
  const notes = []
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(work, 'review.json'), 'utf8'))
    findings = Array.isArray(parsed) ? parsed.slice(0, 15) : []
  } catch {
    notes.push('review.json is missing or is not valid JSON')
  }
  const taken = new Set()
  let matched = 0
  for (const finding of findings) {
    const file = String(finding?.file ?? '').replace(/^\.?\//, '')
    const line = Number(finding?.line)
    const hit = places
      .filter((p) => !taken.has(p.id) && p.file === file && Number.isFinite(line) && Math.abs(p.line - line) <= TOLERANCE)
      .sort((a, b) => Math.abs(a.line - line) - Math.abs(b.line - line))[0]
    if (hit) {
      taken.add(hit.id)
      matched += 1
    }
  }
  const recall = matched / DEFECTS.length
  const precision = findings.length === 0 ? 0 : matched / findings.length
  const f1 = recall + precision === 0 ? 0 : (2 * recall * precision) / (recall + precision)
  const score = 100 * f1 ** 2
  const missed = places.filter((p) => !taken.has(p.id))
  notes.push(`found ${matched} of ${DEFECTS.length} planted defects with ${findings.length - matched} false alarm(s) (recall ${(recall * 100).toFixed(0)}%, precision ${(precision * 100).toFixed(0)}%)`)
  if (missed.length) notes.push(`missed:\n  - ${missed.map((p) => `${p.id} (${p.file}:${p.line})`).join('\n  - ')}`)
  return { score, parts: { recall: Number(recall.toFixed(3)), precision: Number(precision.toFixed(3)), f1: Number(f1.toFixed(3)), score: Number(score.toFixed(1)) }, notes }
}
