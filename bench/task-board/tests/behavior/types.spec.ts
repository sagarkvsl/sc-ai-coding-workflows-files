import { describe } from 'vitest'
import { expect } from 'vitest'
import { loadTypes } from '../support/load'
import { req } from '../support/tags'

describe('R-TYPES: shared types and constants', () => {
  req(1, 'STATUSES lists todo, doing, done in that order', async () => {
    const { STATUSES } = await loadTypes()
    expect([...STATUSES]).toEqual(['todo', 'doing', 'done'])
  })

  req(1, 'PRIORITIES lists low, medium, high in that order', async () => {
    const { PRIORITIES } = await loadTypes()
    expect([...PRIORITIES]).toEqual(['low', 'medium', 'high'])
  })

  req(1, 'MAX_TITLE_LENGTH is 80', async () => {
    const { MAX_TITLE_LENGTH } = await loadTypes()
    expect(MAX_TITLE_LENGTH).toBe(80)
  })

  req(1, 'STATUS_LABELS and PRIORITY_LABELS hold the display names', async () => {
    const { STATUS_LABELS, PRIORITY_LABELS } = await loadTypes()
    expect(STATUS_LABELS).toEqual({ todo: 'To do', doing: 'In progress', done: 'Done' })
    expect(PRIORITY_LABELS).toEqual({ low: 'Low', medium: 'Medium', high: 'High' })
  })

  req(1, 'DEFAULT_FILTERS is an empty query, priority "all" and sort "created"', async () => {
    const { DEFAULT_FILTERS } = await loadTypes()
    expect(DEFAULT_FILTERS).toEqual({ query: '', priority: 'all', sort: 'created' })
  })
})
