import { revertBugs } from '../../support/patches.mjs'
import { IDS } from './prepare.mjs'

export async function solve(dir) {
  revertBugs(dir, IDS)
}
