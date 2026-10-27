import { describe, expect, vi } from 'vitest'
import { deepFreeze, makeTask } from '../support/fixtures'
import { loadReducer, loadTypes } from '../support/load'
import { edge, req, state } from '../support/tags'

async function setup() {
  const { taskReducer, createInitialState, initialState } = await loadReducer()
  const { DEFAULT_FILTERS } = await loadTypes()
  const first = makeTask({ id: 'a', title: 'First' })
  const second = makeTask({ id: 'b', title: 'Second', status: 'doing' })
  const third = makeTask({ id: 'c', title: 'Third', status: 'done' })
  const start = createInitialState([first, second, third])
  return { taskReducer, createInitialState, initialState, DEFAULT_FILTERS, first, second, third, start }
}

describe('R-STATE: reducer behaviour', () => {
  req(2, 'initialState has no tasks and the default filters', async () => {
    const { initialState, DEFAULT_FILTERS } = await setup()
    expect(initialState).toEqual({ tasks: [], filters: DEFAULT_FILTERS })
  })

  req(2, 'createInitialState wraps the given tasks with default filters', async () => {
    const { start, first, second, third, DEFAULT_FILTERS } = await setup()
    expect(start).toEqual({ tasks: [first, second, third], filters: DEFAULT_FILTERS })
  })

  req(3, 'task/added puts the new task at the top of the list', async () => {
    const { taskReducer, start } = await setup()
    const added = makeTask({ id: 'new' })
    const next = taskReducer(start, { type: 'task/added', task: added })
    expect(next.tasks.map((t: { id: string }) => t.id)).toEqual(['new', 'a', 'b', 'c'])
  })

  req(3, 'task/updated applies title, description, priority and dueDate', async () => {
    const { taskReducer, start, first } = await setup()
    const next = taskReducer(start, {
      type: 'task/updated',
      id: 'a',
      changes: { title: 'T', description: 'D', priority: 'high', dueDate: '2026-07-01' },
    })
    expect(next.tasks[0]).toEqual({
      ...first,
      title: 'T',
      description: 'D',
      priority: 'high',
      dueDate: '2026-07-01',
    })
  })

  req(2, 'task/updated can clear a due date back to null', async () => {
    const { taskReducer, createInitialState } = await setup()
    const dated = createInitialState([makeTask({ id: 'a', dueDate: '2026-07-01' })])
    const next = taskReducer(dated, { type: 'task/updated', id: 'a', changes: { dueDate: null } })
    expect(next.tasks[0].dueDate).toBeNull()
  })

  req(3, 'task/moved changes only the status', async () => {
    const { taskReducer, start, first } = await setup()
    const next = taskReducer(start, { type: 'task/moved', id: 'a', status: 'done' })
    expect(next.tasks[0]).toEqual({ ...first, status: 'done' })
  })

  req(3, 'task/deleted removes only that task and keeps the order', async () => {
    const { taskReducer, start } = await setup()
    const next = taskReducer(start, { type: 'task/deleted', id: 'b' })
    expect(next.tasks.map((t: { id: string }) => t.id)).toEqual(['a', 'c'])
  })

  req(2, 'filters/queryChanged stores the query exactly as typed', async () => {
    const { taskReducer, start } = await setup()
    const next = taskReducer(start, { type: 'filters/queryChanged', query: '  Doc ' })
    expect(next.filters.query).toBe('  Doc ')
  })

  req(2, 'filters/priorityChanged stores the priority filter', async () => {
    const { taskReducer, start } = await setup()
    const next = taskReducer(start, { type: 'filters/priorityChanged', priority: 'high' })
    expect(next.filters.priority).toBe('high')
  })

  req(2, 'filters/cleared restores both filters and keeps the tasks', async () => {
    const { taskReducer, start, DEFAULT_FILTERS } = await setup()
    const dirty = taskReducer(
      taskReducer(start, { type: 'filters/queryChanged', query: 'x' }),
      { type: 'filters/priorityChanged', priority: 'low' },
    )
    const next = taskReducer(dirty, { type: 'filters/cleared' })
    expect(next.filters).toEqual(DEFAULT_FILTERS)
    expect(next.tasks).toBe(start.tasks)
  })

  edge(2, 'an unknown id leaves the state reference untouched for update, move and delete', async () => {
    const { taskReducer, start } = await setup()
    expect(taskReducer(start, { type: 'task/updated', id: 'x', changes: { title: 'n' } })).toBe(start)
    expect(taskReducer(start, { type: 'task/moved', id: 'x', status: 'done' })).toBe(start)
    expect(taskReducer(start, { type: 'task/deleted', id: 'x' })).toBe(start)
  })

  edge(2, 'moving a task to the status it already has returns the same state', async () => {
    const { taskReducer, start } = await setup()
    expect(taskReducer(start, { type: 'task/moved', id: 'a', status: 'todo' })).toBe(start)
  })

  edge(2, 'an update that changes nothing returns the same state', async () => {
    const { taskReducer, start } = await setup()
    const next = taskReducer(start, {
      type: 'task/updated',
      id: 'a',
      changes: { title: 'First', priority: 'medium' },
    })
    expect(next).toBe(start)
  })

  edge(2, 'filter actions that change nothing return the same state', async () => {
    const { taskReducer, start } = await setup()
    expect(taskReducer(start, { type: 'filters/queryChanged', query: '' })).toBe(start)
    expect(taskReducer(start, { type: 'filters/priorityChanged', priority: 'all' })).toBe(start)
    expect(taskReducer(start, { type: 'filters/cleared' })).toBe(start)
  })

  edge(1, 'deleting the last task leaves an empty list', async () => {
    const { taskReducer, createInitialState } = await setup()
    const one = createInitialState([makeTask({ id: 'only' })])
    expect(taskReducer(one, { type: 'task/deleted', id: 'only' }).tasks).toEqual([])
  })

  state(3, 'the state holds exactly { tasks, filters } with no derived fields', async () => {
    const { taskReducer, initialState, start } = await setup()
    const actions = [
      { type: 'task/added', task: makeTask({ id: 'n' }) },
      { type: 'task/updated', id: 'a', changes: { title: 'z' } },
      { type: 'task/moved', id: 'a', status: 'done' },
      { type: 'task/deleted', id: 'b' },
      { type: 'filters/queryChanged', query: 'q' },
      { type: 'filters/priorityChanged', priority: 'low' },
      { type: 'filters/sortChanged', sort: 'due' },
      { type: 'tasks/doneCleared' },
    ]
    expect(Object.keys(initialState).sort()).toEqual(['filters', 'tasks'])
    for (const action of actions) {
      expect(Object.keys(taskReducer(start, action)).sort()).toEqual(['filters', 'tasks'])
    }
  })

  state(4, 'the reducer never mutates a deeply frozen state', async () => {
    const { taskReducer, start } = await setup()
    const frozen = deepFreeze(structuredClone(start))
    const actions = [
      { type: 'task/added', task: makeTask({ id: 'n' }) },
      { type: 'task/updated', id: 'a', changes: { title: 'z', priority: 'high' } },
      { type: 'task/moved', id: 'a', status: 'done' },
      { type: 'task/deleted', id: 'b' },
      { type: 'filters/queryChanged', query: 'q' },
      { type: 'filters/priorityChanged', priority: 'low' },
      { type: 'filters/cleared' },
    ]
    for (const action of actions) {
      expect(() => taskReducer(frozen, action)).not.toThrow()
    }
  })

  state(3, 'only the changed task gets a new identity', async () => {
    const { taskReducer, start, first, second, third } = await setup()
    const moved = taskReducer(start, { type: 'task/moved', id: 'b', status: 'done' })
    expect(moved.tasks[0]).toBe(first)
    expect(moved.tasks[1]).not.toBe(second)
    expect(moved.tasks[2]).toBe(third)
    const updated = taskReducer(start, { type: 'task/updated', id: 'c', changes: { title: 'x' } })
    expect(updated.tasks[0]).toBe(first)
    expect(updated.tasks[1]).toBe(second)
    expect(updated.filters).toBe(start.filters)
  })

  state(3, 'the reducer is pure: no clock, randomness or id generation inside it', async () => {
    const { taskReducer, start } = await setup()
    const now = vi.spyOn(Date, 'now')
    const random = vi.spyOn(Math, 'random')
    const uuid = vi.spyOn(crypto, 'randomUUID')
    const actions = [
      { type: 'task/added', task: makeTask({ id: 'n' }) },
      { type: 'task/updated', id: 'a', changes: { title: 'z' } },
      { type: 'task/moved', id: 'a', status: 'done' },
      { type: 'task/deleted', id: 'b' },
    ]
    const run = () => actions.map((action) => taskReducer(start, action))
    expect(run()).toEqual(run())
    expect(now).not.toHaveBeenCalled()
    expect(random).not.toHaveBeenCalled()
    expect(uuid).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
