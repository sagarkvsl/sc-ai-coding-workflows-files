import { applyBugs } from '../../support/patches.mjs'

export const IDS = ['hook-add-task-wrong-status', 'reducer-append-instead-of-prepend', 'select-ignores-description', 'form-focus-not-returned']
export async function prepare(dir) {
  applyBugs(dir, IDS)
}
