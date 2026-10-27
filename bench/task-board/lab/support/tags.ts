import { it } from 'vitest'

// Every hidden task test is titled "[LAB weight] name" so the scorer can weigh it
// and still count it when the spec file cannot load.
export const lt = (weight: number, name: string, body: () => unknown) => it(`[LAB ${weight}] ${name}`, body)
