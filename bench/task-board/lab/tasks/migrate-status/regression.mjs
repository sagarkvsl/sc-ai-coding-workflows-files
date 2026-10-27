import { transformTree } from '../../support/rename.mjs'

export async function generate(testsDir) {
  transformTree(testsDir)
}
