import { screen, within } from '@testing-library/react'
import { describe, expect } from 'vitest'
import { deepFreeze, makeTask } from '../../../../tests/support/fixtures'
import { card, column, renderApp, useFixedToday } from '../../../../tests/support/render'
import { loadSrc, loadTool } from '../../../support/load'
import { lt } from '../../../support/tags'

useFixedToday()

const ids = (list: { id: string }[]) => list.map((t) => t.id)
const today = new Date(2026, 5, 15, 12)

describe('isOverdue(task, today)', () => {
  lt(4, 'takes a task-like object and applies the same rule', async () => {
    const { isOverdue } = await loadSrc('utils/date')
    expect(isOverdue({ dueDate: '2026-06-01', status: 'todo' }, today)).toBe(true)
    expect(isOverdue({ dueDate: '2026-06-15', status: 'todo' }, today)).toBe(false)
    expect(isOverdue({ dueDate: '2026-06-01', status: 'done' }, today)).toBe(false)
    expect(isOverdue({ dueDate: null, status: 'doing' }, today)).toBe(false)
  })

  lt(2, 'accepts a full task object', async () => {
    const { isOverdue } = await loadSrc('utils/date')
    expect(isOverdue(makeTask({ dueDate: '2026-01-01' }), today)).toBe(true)
  })
})

describe('sortTasks(tasks, options)', () => {
  const sample = () =>
    deepFreeze([
      makeTask({ id: 'a', priority: 'low', dueDate: '2026-07-01', createdAt: '2026-01-01T00:00:00.000Z' }),
      makeTask({ id: 'b', priority: 'high', dueDate: null, createdAt: '2026-03-01T00:00:00.000Z' }),
      makeTask({ id: 'c', priority: 'medium', dueDate: '2026-06-01', createdAt: '2026-02-01T00:00:00.000Z' }),
      makeTask({ id: 'd', priority: 'high', dueDate: '2026-06-01', createdAt: '2026-02-01T00:00:00.000Z' }),
    ])

  lt(4, 'sorts by each key through options.by', async () => {
    const { sortTasks } = await loadSrc('state/selectors')
    expect(ids(sortTasks(sample(), { by: 'created' }))).toEqual(['b', 'c', 'd', 'a'])
    expect(ids(sortTasks(sample(), { by: 'due' }))).toEqual(['c', 'd', 'a', 'b'])
    expect(ids(sortTasks(sample(), { by: 'priority' }))).toEqual(['b', 'd', 'c', 'a'])
  })

  lt(4, 'reverse: true returns the whole sorted list in reverse order', async () => {
    const { sortTasks } = await loadSrc('state/selectors')
    expect(ids(sortTasks(sample(), { by: 'priority', reverse: true }))).toEqual(['a', 'c', 'd', 'b'])
    expect(ids(sortTasks(sample(), { by: 'due', reverse: true }))).toEqual(['b', 'a', 'd', 'c'])
  })

  lt(2, 'reverse: false and a missing reverse behave the same', async () => {
    const { sortTasks } = await loadSrc('state/selectors')
    expect(ids(sortTasks(sample(), { by: 'due', reverse: false }))).toEqual(ids(sortTasks(sample(), { by: 'due' })))
  })

  lt(3, 'still returns a new array and never mutates the input', async () => {
    const { sortTasks } = await loadSrc('state/selectors')
    const input = sample()
    const out = sortTasks(input, { by: 'priority', reverse: true })
    expect(out).not.toBe(input)
    expect(ids(input)).toEqual(['a', 'b', 'c', 'd'])
  })

  lt(2, 'the SortOptions type is exported from types/task.ts as a type only', async () => {
    const mod = await loadSrc('types/task')
    expect('SortOptions' in mod).toBe(false)
  })
})

describe('callers still work', () => {
  lt(5, 'the card still shows Overdue for a past due task and not for today or done', async () => {
    await renderApp([
      makeTask({ id: 'a', title: 'Late', dueDate: '2026-06-01' }),
      makeTask({ id: 'b', title: 'Today', dueDate: '2026-06-15' }),
      makeTask({ id: 'c', title: 'Finished', dueDate: '2026-06-01', status: 'done' }),
    ])
    expect(within(card('Late')).getByText('Overdue')).toBeVisible()
    expect(within(card('Today')).queryByText('Overdue')).not.toBeInTheDocument()
    expect(within(card('Finished')).queryByText('Overdue')).not.toBeInTheDocument()
  })

  lt(5, 'the board still sorts every column through the Sort by select', async () => {
    const { user } = await renderApp([
      makeTask({ id: 'a', title: 'Low', priority: 'low' }),
      makeTask({ id: 'b', title: 'High', priority: 'high' }),
      makeTask({ id: 'c', title: 'Mid', priority: 'medium' }),
    ])
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Priority')
    const titles = within(column('To do')).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['High', 'Mid', 'Low'])
  })

  lt(6, 'the report tool lists overdue tasks, earliest first, through the new signatures', async () => {
    const { buildReport } = await loadTool('report/report')
    const report = buildReport(
      [
        makeTask({ id: '1', title: 'Later', dueDate: '2026-06-10' }),
        makeTask({ id: '2', title: 'Earlier', dueDate: '2026-06-01' }),
        makeTask({ id: '3', title: 'Today', dueDate: '2026-06-15' }),
        makeTask({ id: '4', title: 'Done', dueDate: '2026-05-01', status: 'done' }),
      ],
      today,
    )
    expect(report).toContain('Overdue: 2\n- Earlier (Due 1 Jun 2026)\n- Later (Due 10 Jun 2026)')
  })

  lt(5, 'the report tool still names the highest priority open task', async () => {
    const { buildReport } = await loadTool('report/report')
    const report = buildReport(
      [makeTask({ id: '1', title: 'Low one', priority: 'low' }), makeTask({ id: '2', title: 'Urgent', priority: 'high' }), makeTask({ id: '3', title: 'Finished', priority: 'high', status: 'done' })],
      today,
    )
    expect(report).toContain('Next up: Urgent')
  })

  lt(3, 'the report tool handles an empty board', async () => {
    const { buildReport } = await loadTool('report/report')
    expect(buildReport([], today)).toBe('Task Board report for 2026-06-15\nTotal: 0 (To do 0, In progress 0, Done 0)\nOverdue: 0')
  })
})
