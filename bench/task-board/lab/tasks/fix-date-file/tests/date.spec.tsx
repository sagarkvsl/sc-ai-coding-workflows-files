import { screen, within } from '@testing-library/react'
import { describe, expect } from 'vitest'
import { makeTask } from '../../../../tests/support/fixtures'
import { addTask, card, renderApp, useFixedToday } from '../../../../tests/support/render'
import { loadSrc, loadTool } from '../../../support/load'
import { lt } from '../../../support/tags'

useFixedToday()

describe('date fixes', () => {
  lt(3, 'isPastDate says today is not past and yesterday is', async () => {
    const { isPastDate } = await loadSrc('utils/date')
    const today = new Date(2026, 5, 15, 12)
    expect(isPastDate('2026-06-15', today)).toBe(false)
    expect(isPastDate('2026-06-14', today)).toBe(true)
    expect(isPastDate('2026-06-16', today)).toBe(false)
  })

  lt(3, 'isOverdue is false for a task due today and true for one due yesterday', async () => {
    const { isOverdue } = await loadSrc('utils/date')
    const today = new Date(2026, 5, 15, 9)
    expect(isOverdue('2026-06-15', 'todo', today)).toBe(false)
    expect(isOverdue('2026-06-14', 'todo', today)).toBe(true)
    expect(isOverdue('2026-06-14', 'done', today)).toBe(false)
  })

  lt(3, 'a card due today has no Overdue badge but one due yesterday has', async () => {
    await renderApp([
      makeTask({ id: 'a', title: 'Due today', dueDate: '2026-06-15' }),
      makeTask({ id: 'b', title: 'Due yesterday', dueDate: '2026-06-14' }),
    ])
    expect(within(card('Due today')).queryByText('Overdue')).not.toBeInTheDocument()
    expect(within(card('Due yesterday')).getByText('Overdue')).toBeVisible()
  })

  lt(3, 'the add form accepts today as a due date', async () => {
    const { user } = await renderApp([])
    await addTask(user, { title: 'Ship it', dueDate: '2026-06-15' })
    expect(screen.queryByText('Due date cannot be in the past.')).not.toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Ship it' })).toBeVisible()
  })

  lt(2, 'the add form still rejects yesterday', async () => {
    const { user } = await renderApp([])
    await addTask(user, { title: 'Late', dueDate: '2026-06-14' })
    expect(screen.getByText('Due date cannot be in the past.')).toBeVisible()
  })

  lt(4, 'formatDueDate names every month correctly', async () => {
    const { formatDueDate } = await loadSrc('utils/date')
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    names.forEach((name, i) => {
      const month = String(i + 1).padStart(2, '0')
      expect(formatDueDate(`2026-${month}-04`)).toBe(`Due 4 ${name} 2026`)
    })
  })

  lt(2, 'formatDueDate leaves an invalid date unchanged', async () => {
    const { formatDueDate } = await loadSrc('utils/date')
    expect(formatDueDate('2026-13-01')).toBe('2026-13-01')
    expect(formatDueDate('nonsense')).toBe('nonsense')
  })

  lt(4, 'toIsoDate returns the local calendar date late in the evening', async () => {
    const { toIsoDate } = await loadSrc('utils/date')
    expect(toIsoDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
    expect(toIsoDate(new Date(2026, 11, 31, 20, 0))).toBe('2026-12-31')
    expect(toIsoDate(new Date(2026, 2, 1, 0, 5))).toBe('2026-03-01')
  })

  lt(3, 'the report names today by its local date in the evening', async () => {
    const { buildReport } = await loadTool('report/report')
    const report = buildReport([], new Date(2026, 5, 15, 20, 30))
    expect(report.split('\n')[0]).toBe('Task Board report for 2026-06-15')
  })

  lt(2, 'the report lists a task due today as not overdue', async () => {
    const { buildReport } = await loadTool('report/report')
    const report = buildReport([makeTask({ title: 'Today', dueDate: '2026-06-15' }), makeTask({ title: 'Old', dueDate: '2026-06-01' })], new Date(2026, 5, 15, 12))
    expect(report).toContain('Overdue: 1')
    expect(report).toContain('- Old (Due 1 Jun 2026)')
    expect(report).not.toContain('- Today')
  })
})
