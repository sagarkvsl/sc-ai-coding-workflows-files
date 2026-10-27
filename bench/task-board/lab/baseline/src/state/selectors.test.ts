import { describe, expect, it } from 'vitest'
import type { Task, TaskState } from '../types/task'
import { DEFAULT_FILTERS } from '../types/task'
import { groupByStatus, selectVisibleTasks } from './selectors'

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'id',
    title: 'Task',
    description: '',
    priority: 'medium',
    status: 'todo',
    dueDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const tasks = [
  makeTask({ id: '1', title: 'Fix login bug', priority: 'high' }),
  makeTask({ id: '2', title: 'Write docs', description: 'Explain the LOGIN flow' }),
  makeTask({ id: '3', title: 'Plan sprint', priority: 'low', status: 'done' }),
]

function stateWith(filters: Partial<TaskState['filters']>): TaskState {
  return { tasks, filters: { ...DEFAULT_FILTERS, ...filters } }
}

describe('selectVisibleTasks', () => {
  it('returns every task when no filter is active', () => {
    expect(selectVisibleTasks(stateWith({}))).toEqual(tasks)
  })

  it('matches the query against the title and the description', () => {
    const ids = selectVisibleTasks(stateWith({ query: 'login' })).map((t) => t.id)
    expect(ids).toEqual(['1', '2'])
  })

  it('ignores case and surrounding whitespace in the query', () => {
    const ids = selectVisibleTasks(stateWith({ query: '  FIX ' })).map((t) => t.id)
    expect(ids).toEqual(['1'])
  })

  it('treats a whitespace-only query as no filter', () => {
    expect(selectVisibleTasks(stateWith({ query: '   ' }))).toHaveLength(3)
  })

  it('filters by priority', () => {
    const ids = selectVisibleTasks(stateWith({ priority: 'low' })).map((t) => t.id)
    expect(ids).toEqual(['3'])
  })

  it('combines the query and the priority filter', () => {
    expect(selectVisibleTasks(stateWith({ query: 'login', priority: 'high' }))).toEqual([
      tasks[0],
    ])
  })

  it('returns an empty list when nothing matches', () => {
    expect(selectVisibleTasks(stateWith({ query: 'zzz' }))).toEqual([])
  })
})

describe('groupByStatus', () => {
  it('groups tasks by status and keeps their order', () => {
    const groups = groupByStatus(tasks)
    expect(groups.todo.map((t) => t.id)).toEqual(['1', '2'])
    expect(groups.done.map((t) => t.id)).toEqual(['3'])
  })

  it('always returns an array for every status', () => {
    expect(groupByStatus([])).toEqual({ todo: [], doing: [], done: [] })
  })
})
