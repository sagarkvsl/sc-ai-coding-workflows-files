import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDueDate, isOverdue, isPastDate, toIsoDate } from './date'

const today = new Date(2026, 5, 15, 12, 0, 0)

afterEach(() => {
  vi.useRealTimers()
})

describe('toIsoDate', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 9, 0, 0))).toBe('2026-01-05')
  })

  it('uses the local date late in the evening, not the UTC date', () => {
    expect(toIsoDate(new Date(2026, 11, 31, 23, 59, 0))).toBe('2026-12-31')
  })
})

describe('isPastDate', () => {
  it('is true for yesterday', () => {
    expect(isPastDate('2026-06-14', today)).toBe(true)
  })

  it('is false for today and for tomorrow', () => {
    expect(isPastDate('2026-06-15', today)).toBe(false)
    expect(isPastDate('2026-06-16', today)).toBe(false)
  })

  it('is false for a value that is not an ISO date', () => {
    expect(isPastDate('not a date', today)).toBe(false)
  })
})

describe('isOverdue', () => {
  it('is true for an open task with a past due date', () => {
    expect(isOverdue({ dueDate: '2026-06-01', status: 'doing' }, today)).toBe(true)
  })

  it('is false once the task is done', () => {
    expect(isOverdue({ dueDate: '2026-06-01', status: 'done' }, today)).toBe(false)
  })

  it('is false when there is no due date', () => {
    expect(isOverdue({ dueDate: null, status: 'todo' }, today)).toBe(false)
  })
})

describe('formatDueDate', () => {
  it('formats the day without padding and the month as a short name', () => {
    expect(formatDueDate('2026-03-05')).toBe('Due 5 Mar 2026')
  })

  it('does not shift the day across time zones', () => {
    expect(formatDueDate('2026-01-01')).toBe('Due 1 Jan 2026')
    expect(formatDueDate('2026-12-31')).toBe('Due 31 Dec 2026')
  })

  it('returns the input unchanged when it is not a valid date', () => {
    expect(formatDueDate('soon')).toBe('soon')
    expect(formatDueDate('2026-13-01')).toBe('2026-13-01')
  })
})
