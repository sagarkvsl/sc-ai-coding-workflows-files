import { describe, expect, it } from 'vitest'
import type { Task, TaskState } from '../types/task'
import { DEFAULT_FILTERS } from '../types/task'
import { createInitialState, initialState, taskReducer } from './taskReducer'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'a',
    title: 'Write docs',
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

const first = makeTask({ id: 'a', title: 'First' })
const second = makeTask({ id: 'b', title: 'Second', status: 'doing' })
const state: TaskState = deepFreeze(createInitialState([first, second]))

describe('initial state', () => {
  it('starts with no tasks and the default filters', () => {
    expect(initialState).toEqual({ tasks: [], filters: DEFAULT_FILTERS })
  })

  it('wraps the given tasks without adding derived fields', () => {
    expect(Object.keys(state).sort()).toEqual(['filters', 'tasks'])
    expect(state.tasks).toEqual([first, second])
  })
})

describe('task actions', () => {
  it('adds a new task at the top of the list', () => {
    const added = makeTask({ id: 'c', title: 'Third' })
    const next = taskReducer(state, { type: 'task/added', task: added })
    expect(next.tasks.map((task) => task.id)).toEqual(['c', 'a', 'b'])
  })

  it('updates only the fields that were given', () => {
    const next = taskReducer(state, {
      type: 'task/updated',
      id: 'a',
      changes: { title: 'Renamed', priority: 'high' },
    })
    expect(next.tasks[0]).toEqual({ ...first, title: 'Renamed', priority: 'high' })
  })

  it('keeps the identity of tasks that were not touched', () => {
    const next = taskReducer(state, {
      type: 'task/updated',
      id: 'a',
      changes: { title: 'Renamed' },
    })
    expect(next.tasks[1]).toBe(second)
  })

  it('moves a task to another status', () => {
    const next = taskReducer(state, { type: 'task/moved', id: 'a', status: 'done' })
    expect(next.tasks[0].status).toBe('done')
    expect(next.tasks[1]).toBe(second)
  })

  it('deletes a task and keeps the order of the others', () => {
    const next = taskReducer(state, { type: 'task/deleted', id: 'a' })
    expect(next.tasks).toEqual([second])
  })

  it('does not mutate the previous state', () => {
    expect(() =>
      taskReducer(state, {
        type: 'task/updated',
        id: 'a',
        changes: { title: 'Changed' },
      }),
    ).not.toThrow()
    expect(state.tasks[0].title).toBe('First')
  })
})

describe('no-op actions return the same state reference', () => {
  it('ignores an unknown id for update, move and delete', () => {
    expect(
      taskReducer(state, { type: 'task/updated', id: 'x', changes: { title: 'n' } }),
    ).toBe(state)
    expect(taskReducer(state, { type: 'task/moved', id: 'x', status: 'done' })).toBe(state)
    expect(taskReducer(state, { type: 'task/deleted', id: 'x' })).toBe(state)
  })

  it('ignores a move to the current status', () => {
    expect(taskReducer(state, { type: 'task/moved', id: 'a', status: 'todo' })).toBe(state)
  })

  it('ignores an update that changes nothing', () => {
    const next = taskReducer(state, {
      type: 'task/updated',
      id: 'a',
      changes: { title: 'First' },
    })
    expect(next).toBe(state)
  })
})

describe('filter actions', () => {
  it('stores the query and priority filter', () => {
    const queried = taskReducer(state, { type: 'filters/queryChanged', query: 'doc' })
    const filtered = taskReducer(queried, {
      type: 'filters/priorityChanged',
      priority: 'high',
    })
    expect(filtered.filters).toEqual({
      ...DEFAULT_FILTERS,
      query: 'doc',
      priority: 'high',
    })
  })

  it('resets both filters when cleared', () => {
    const queried = taskReducer(state, { type: 'filters/queryChanged', query: 'doc' })
    expect(taskReducer(queried, { type: 'filters/cleared' }).filters).toEqual(
      DEFAULT_FILTERS,
    )
  })

  it('returns the same state when the filters do not change', () => {
    expect(taskReducer(state, { type: 'filters/queryChanged', query: '' })).toBe(state)
    expect(taskReducer(state, { type: 'filters/priorityChanged', priority: 'all' })).toBe(
      state,
    )
    expect(taskReducer(state, { type: 'filters/cleared' })).toBe(state)
  })
})
