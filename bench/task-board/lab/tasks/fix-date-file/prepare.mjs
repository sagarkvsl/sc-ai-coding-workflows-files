import { applyBugs } from '../../support/patches.mjs'

export const IDS = ['date-today-counts-as-past', 'date-format-month-off-by-one', 'date-iso-uses-utc']
export async function prepare(dir) {
  applyBugs(dir, IDS)
}
