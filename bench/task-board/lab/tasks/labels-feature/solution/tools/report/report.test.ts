import { describe, expect, it } from 'vitest'
import type { Task } from '../../src/types/task'
import { buildReport } from './report'

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'id',
    title: 'Task',
    description: '',
    priority: 'medium',
    status: 'todo',
    dueDate: null,
    labels: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const today = new Date(2026, 5, 15, 12, 0, 0)

describe('buildReport', () => {
  it('counts tasks per column', () => {
    const report = buildReport(
      [
        makeTask({ id: '1' }),
        makeTask({ id: '2', status: 'doing' }),
        makeTask({ id: '3', status: 'done' }),
      ],
      today,
    )
    expect(report).toContain('Total: 3 (To do 1, In progress 1, Done 1)')
  })

  it('lists overdue tasks, earliest due date first', () => {
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

  it('names the highest priority open task', () => {
    const report = buildReport(
      [
        makeTask({ id: '1', title: 'Low one', priority: 'low' }),
        makeTask({ id: '2', title: 'Urgent', priority: 'high' }),
        makeTask({ id: '3', title: 'Finished', priority: 'high', status: 'done' }),
      ],
      today,
    )
    expect(report).toContain('Next up: Urgent')
  })

  it('handles an empty board', () => {
    expect(buildReport([], today)).toBe(
      'Task Board report for 2026-06-15\nTotal: 0 (To do 0, In progress 0, Done 0)\nOverdue: 0',
    )
  })
})
