import { it } from 'vitest'

// Every hidden test is tagged "[CATEGORY weight] name". The scorer reads the tag
// from the test title, so a test that cannot even load still counts as a failure.
export type Category =
  | 'REQ'
  | 'EDGE'
  | 'STATE'
  | 'ARCH'
  | 'TS'
  | 'QUAL'
  | 'STYLE'
  | 'OWNTEST'

type Body = () => unknown

function tagged(category: Category) {
  return (weight: number, name: string, body: Body) =>
    it(`[${category} ${weight}] ${name}`, body)
}

export const req = tagged('REQ')
export const edge = tagged('EDGE')
export const state = tagged('STATE')
export const arch = tagged('ARCH')
export const typed = tagged('TS')
export const qual = tagged('QUAL')
export const style = tagged('STYLE')
export const owntest = tagged('OWNTEST')
