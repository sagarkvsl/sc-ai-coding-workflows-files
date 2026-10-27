import { describe, expect, it } from 'vitest'
import type { Task } from '../types/task'
import { DEFAULT_FILTERS } from '../types/task'
import { countDone, sortTasks } from './selectors'
import { createInitialState, taskReducer } from './taskReducer'

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

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

const tasks = deepFreeze([
  makeTask({ id: 'a', priority: 'low', dueDate: '2026-07-01', createdAt: '2026-01-01T00:00:00.000Z' }),
  makeTask({ id: 'b', priority: 'high', dueDate: null, createdAt: '2026-03-01T00:00:00.000Z' }),
  makeTask({ id: 'c', priority: 'medium', dueDate: '2026-06-01', createdAt: '2026-02-01T00:00:00.000Z' }),
  makeTask({ id: 'd', priority: 'high', dueDate: '2026-06-01', createdAt: '2026-02-01T00:00:00.000Z' }),
])

function ids(list: Task[]): string[] {
  return list.map((task) => task.id)
}

describe('sortTasks', () => {
  it('puts the newest created task first and keeps ties in input order', () => {
    expect(ids(sortTasks(tasks, 'created'))).toEqual(['b', 'c', 'd', 'a'])
  })

  it('sorts by due date, earliest first, with undated tasks last', () => {
    expect(ids(sortTasks(tasks, 'due'))).toEqual(['c', 'd', 'a', 'b'])
  })

  it('sorts high priority first and keeps ties in input order', () => {
    expect(ids(sortTasks(tasks, 'priority'))).toEqual(['b', 'd', 'c', 'a'])
  })

  it('returns a new array and leaves frozen input untouched', () => {
    const sorted = sortTasks(tasks, 'priority')
    expect(sorted).not.toBe(tasks)
    expect(ids(tasks)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('handles an empty list', () => {
    expect(sortTasks([], 'due')).toEqual([])
  })
})

describe('countDone', () => {
  it('counts only the tasks in the done column', () => {
    const mixed = [makeTask({ status: 'done' }), makeTask({ status: 'doing' }), makeTask({ status: 'done' })]
    expect(countDone(mixed)).toBe(2)
    expect(countDone([])).toBe(0)
  })
})

describe('sort and clear-done actions', () => {
  const state = deepFreeze(
    createInitialState([
      makeTask({ id: 'a', status: 'done' }),
      makeTask({ id: 'b', status: 'todo' }),
      makeTask({ id: 'c', status: 'done' }),
    ]),
  )

  it('stores the chosen sort key and returns the same state for the same key', () => {
    const sorted = taskReducer(state, { type: 'filters/sortChanged', sort: 'due' })
    expect(sorted.filters.sort).toBe('due')
    expect(taskReducer(state, { type: 'filters/sortChanged', sort: 'created' })).toBe(state)
  })

  it('keeps the sort key when the filters are cleared', () => {
    const sorted = taskReducer(state, { type: 'filters/sortChanged', sort: 'priority' })
    const searched = taskReducer(sorted, { type: 'filters/queryChanged', query: 'x' })
    const cleared = taskReducer(searched, { type: 'filters/cleared' })
    expect(cleared.filters).toEqual({ ...DEFAULT_FILTERS, sort: 'priority' })
    expect(taskReducer(sorted, { type: 'filters/cleared' })).toBe(sorted)
  })

  it('removes every done task and keeps the order of the rest', () => {
    const next = taskReducer(state, { type: 'tasks/doneCleared' })
    expect(ids(next.tasks)).toEqual(['b'])
    expect(next.tasks[0]).toBe(state.tasks[1])
  })

  it('returns the same state when there is no done task to clear', () => {
    const open = deepFreeze(createInitialState([makeTask({ id: 'x' })]))
    expect(taskReducer(open, { type: 'tasks/doneCleared' })).toBe(open)
  })
})
