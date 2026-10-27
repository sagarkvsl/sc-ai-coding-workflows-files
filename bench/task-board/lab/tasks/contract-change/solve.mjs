import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export async function solve(dir) {
  const overlay = path.join(path.dirname(fileURLToPath(import.meta.url)), 'solution')
  fs.cpSync(overlay, dir, { recursive: true })
}
