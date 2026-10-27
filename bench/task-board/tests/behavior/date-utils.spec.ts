import { describe, expect } from 'vitest'
import { loadDate, loadId } from '../support/load'
import { edge, req } from '../support/tags'

const today = new Date(2026, 5, 15, 12, 0, 0)

describe('R-DATE: date and id utilities', () => {
  req(2, 'toIsoDate formats the local calendar date as YYYY-MM-DD', async () => {
    const { toIsoDate } = await loadDate()
    expect(toIsoDate(new Date(2026, 0, 5, 9, 0, 0))).toBe('2026-01-05')
    expect(toIsoDate(new Date(2026, 10, 30, 9, 0, 0))).toBe('2026-11-30')
  })

  req(3, 'formatDueDate gives "Due 5 Mar 2026" for 2026-03-05', async () => {
    const { formatDueDate } = await loadDate()
    expect(formatDueDate('2026-03-05')).toBe('Due 5 Mar 2026')
    expect(formatDueDate('2026-10-21')).toBe('Due 21 Oct 2026')
  })

  req(2, 'isPastDate is true only for days before today', async () => {
    const { isPastDate } = await loadDate()
    expect(isPastDate('2026-06-14', today)).toBe(true)
    expect(isPastDate('2026-05-30', today)).toBe(true)
    expect(isPastDate('2026-06-16', today)).toBe(false)
  })

  req(3, 'isOverdue needs a past due date and an unfinished task', async () => {
    const { isOverdue } = await loadDate()
    expect(isOverdue('2026-06-01', 'todo', today)).toBe(true)
    expect(isOverdue('2026-06-01', 'doing', today)).toBe(true)
    expect(isOverdue('2026-06-01', 'done', today)).toBe(false)
    expect(isOverdue(null, 'todo', today)).toBe(false)
    expect(isOverdue('2026-06-20', 'todo', today)).toBe(false)
  })

  req(1, 'createId returns a non-empty string', async () => {
    const { createId } = await loadId()
    expect(typeof createId()).toBe('string')
    expect(createId().length).toBeGreaterThan(8)
  })

  edge(3, 'today is not in the past, and not overdue', async () => {
    const { isPastDate, isOverdue } = await loadDate()
    expect(isPastDate('2026-06-15', today)).toBe(false)
    expect(isOverdue('2026-06-15', 'todo', today)).toBe(false)
  })

  edge(3, 'toIsoDate uses the local date, not the UTC date (late evening)', async () => {
    const { toIsoDate } = await loadDate()
    expect(toIsoDate(new Date(2026, 0, 5, 23, 30, 0))).toBe('2026-01-05')
    expect(toIsoDate(new Date(2026, 11, 31, 23, 59, 0))).toBe('2026-12-31')
  })

  edge(3, 'formatDueDate does not shift the day across time zones', async () => {
    const { formatDueDate } = await loadDate()
    expect(formatDueDate('2026-01-01')).toBe('Due 1 Jan 2026')
    expect(formatDueDate('2026-12-31')).toBe('Due 31 Dec 2026')
    expect(formatDueDate('2026-03-08')).toBe('Due 8 Mar 2026')
  })

  edge(2, 'formatDueDate does not pad the day and always uses English month names', async () => {
    const { formatDueDate } = await loadDate()
    expect(formatDueDate('2026-02-09')).toBe('Due 9 Feb 2026')
    expect(formatDueDate('2026-09-01')).toBe('Due 1 Sep 2026')
  })

  edge(2, 'formatDueDate returns invalid input unchanged', async () => {
    const { formatDueDate } = await loadDate()
    expect(formatDueDate('soon')).toBe('soon')
    expect(formatDueDate('2026-13-01')).toBe('2026-13-01')
    expect(formatDueDate('')).toBe('')
  })

  edge(2, 'isPastDate is false for values that are not ISO dates', async () => {
    const { isPastDate } = await loadDate()
    expect(isPastDate('garbage', today)).toBe(false)
    expect(isPastDate('', today)).toBe(false)
  })

  edge(1, 'toIsoDate and isPastDate agree across a year boundary', async () => {
    const { isPastDate } = await loadDate()
    const newYear = new Date(2027, 0, 1, 8, 0, 0)
    expect(isPastDate('2026-12-31', newYear)).toBe(true)
    expect(isPastDate('2027-01-01', newYear)).toBe(false)
  })

  edge(1, 'createId returns a different value every call', async () => {
    const { createId } = await loadId()
    const ids = new Set(Array.from({ length: 50 }, () => createId()))
    expect(ids.size).toBe(50)
  })
})
