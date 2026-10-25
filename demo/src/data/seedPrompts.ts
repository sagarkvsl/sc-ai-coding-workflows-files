import type { Prompt } from '../types'

export const seedPrompts: Prompt[] = [
  {
    id: 'seed-debugging',
    title: 'Find the root cause',
    text: 'Here is the error and the code that throws it. List the three most likely root causes, ranked, and tell me how to confirm each one before changing any code.',
    tag: 'debugging',
    createdAt: new Date('2026-09-01'),
  },
  {
    id: 'seed-refactor',
    title: 'Smaller functions, same behavior',
    text: 'Refactor this function into smaller functions with clear names. Keep the public API and behavior identical, and explain each extraction in one line.',
    tag: 'refactor',
    createdAt: new Date('2026-09-08'),
  },
  {
    id: 'seed-testing',
    title: 'Edge cases first',
    text: 'Before writing tests for this component, list the edge cases a user could hit. Then write one focused test per edge case using React Testing Library.',
    tag: 'testing',
    createdAt: new Date('2026-09-15'),
  },
  {
    id: 'seed-review',
    title: 'Review like a teammate',
    text: 'Review this diff as a senior teammate. Point out bugs and risky changes first, then readability. Skip style nits that a linter would catch.',
    tag: 'review',
    createdAt: new Date('2026-09-22'),
  },
]
