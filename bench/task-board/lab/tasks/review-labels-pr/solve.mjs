import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFECTS } from './defects.mjs'

// A perfect reviewer: one finding per planted defect, at the right line.
export async function solve(dir) {
  const findings = DEFECTS.map((d) => {
    const text = fs.readFileSync(path.join(dir, d.file), 'utf8')
    const index = text.indexOf(d.replace)
    return { file: d.file, line: text.slice(0, index).split('\n').length, issue: d.issue }
  })
  fs.writeFileSync(path.join(dir, 'review.json'), JSON.stringify(findings, null, 2))
}
