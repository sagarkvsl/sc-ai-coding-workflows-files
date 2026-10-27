// Reducer and selector rules for the "sort" and "clear completed" features.
import { describe, expect } from 'vitest'
import { deepFreeze, makeTask } from '../support/fixtures'
import { loadReducer, loadSelectors, loadTypes } from '../support/load'
import { edge, req, state } from '../support/tags'

async function setup() {
  const { taskReducer, createInitialState } = await loadReducer()
  const { sortTasks } = await loadSelectors()
  const { DEFAULT_FILTERS, SORT_KEYS, SORT_LABELS } = await loadTypes()
  const a = makeTask({ id: 'a', status: 'done' })
  const b = makeTask({ id: 'b', status: 'todo' })
  const c = makeTask({ id: 'c', status: 'done' })
  const d = makeTask({ id: 'd', status: 'doing' })
  const start = createInitialState([a, b, c, d])
  return { taskReducer, createInitialState, sortTasks, DEFAULT_FILTERS, SORT_KEYS, SORT_LABELS, a, b, c, d, start }
}

const ids = (list: { id: string }[]) => list.map((t) => t.id)

describe('R-SORT-STATE: sort and clear-done in the reducer', () => {
  req(2, 'SORT_KEYS and SORT_LABELS name the three orders', async () => {
    const { SORT_KEYS, SORT_LABELS } = await setup()
    expect([...SORT_KEYS]).toEqual(['created', 'due', 'priority'])
    expect(SORT_LABELS).toEqual({ created: 'Newest first', due: 'Due date', priority: 'Priority' })
  })

  req(3, 'filters/sortChanged stores the sort key and leaves everything else alone', async () => {
    const { taskReducer, start } = await setup()
    const next = taskReducer(start, { type: 'filters/sortChanged', sort: 'priority' })
    expect(next.filters).toEqual({ query: '', priority: 'all', sort: 'priority' })
    expect(next.tasks).toBe(start.tasks)
  })

  edge(2, 'filters/sortChanged with the current key returns the same state object', async () => {
    const { taskReducer, start } = await setup()
    expect(taskReducer(start, { type: 'filters/sortChanged', sort: 'created' })).toBe(start)
    const due = taskReducer(start, { type: 'filters/sortChanged', sort: 'due' })
    expect(taskReducer(due, { type: 'filters/sortChanged', sort: 'due' })).toBe(due)
  })

  req(3, 'filters/cleared resets the query and priority but keeps the sort key', async () => {
    const { taskReducer, start } = await setup()
    let dirty = taskReducer(start, { type: 'filters/sortChanged', sort: 'due' })
    dirty = taskReducer(dirty, { type: 'filters/queryChanged', query: 'x' })
    dirty = taskReducer(dirty, { type: 'filters/priorityChanged', priority: 'high' })
    const next = taskReducer(dirty, { type: 'filters/cleared' })
    expect(next.filters).toEqual({ query: '', priority: 'all', sort: 'due' })
  })

  edge(3, 'filters/cleared returns the same state when only the sort key differs from default', async () => {
    const { taskReducer, start } = await setup()
    const sorted = taskReducer(start, { type: 'filters/sortChanged', sort: 'priority' })
    expect(taskReducer(sorted, { type: 'filters/cleared' })).toBe(sorted)
  })

  req(3, 'tasks/doneCleared removes every done task and keeps the order of the rest', async () => {
    const { taskReducer, start } = await setup()
    const next = taskReducer(start, { type: 'tasks/doneCleared' })
    expect(ids(next.tasks)).toEqual(['b', 'd'])
  })

  state(3, 'tasks/doneCleared keeps the identity of the remaining tasks and of the filters', async () => {
    const { taskReducer, start, b, d } = await setup()
    const next = taskReducer(start, { type: 'tasks/doneCleared' })
    expect(next.tasks[0]).toBe(b)
    expect(next.tasks[1]).toBe(d)
    expect(next.filters).toBe(start.filters)
  })

  edge(2, 'tasks/doneCleared returns the same state when no task is done', async () => {
    const { taskReducer, createInitialState } = await setup()
    const open = createInitialState([makeTask({ id: 'x' }), makeTask({ id: 'y', status: 'doing' })])
    expect(taskReducer(open, { type: 'tasks/doneCleared' })).toBe(open)
    const empty = createInitialState([])
    expect(taskReducer(empty, { type: 'tasks/doneCleared' })).toBe(empty)
  })

  edge(1, 'tasks/doneCleared on a list of only done tasks leaves an empty list', async () => {
    const { taskReducer, createInitialState } = await setup()
    const allDone = createInitialState([makeTask({ id: 'x', status: 'done' })])
    expect(taskReducer(allDone, { type: 'tasks/doneCleared' }).tasks).toEqual([])
  })

  state(3, 'the new actions never mutate frozen input', async () => {
    const { taskReducer, createInitialState } = await setup()
    const frozen = deepFreeze(createInitialState([makeTask({ id: 'a', status: 'done' }), makeTask({ id: 'b' })]))
    expect(() => taskReducer(frozen, { type: 'tasks/doneCleared' })).not.toThrow()
    expect(() => taskReducer(frozen, { type: 'filters/sortChanged', sort: 'due' })).not.toThrow()
    expect(() => taskReducer(frozen, { type: 'filters/cleared' })).not.toThrow()
    expect(frozen.tasks).toHaveLength(2)
  })
})

describe('R-SORT-SELECT: sortTasks', () => {
  const sample = () =>
    deepFreeze([
      makeTask({ id: 'a', priority: 'low', dueDate: '2026-07-01', createdAt: '2026-01-01T00:00:00.000Z' }),
      makeTask({ id: 'b', priority: 'high', dueDate: null, createdAt: '2026-03-01T00:00:00.000Z' }),
      makeTask({ id: 'c', priority: 'medium', dueDate: '2026-06-01', createdAt: '2026-02-01T00:00:00.000Z' }),
      makeTask({ id: 'd', priority: 'high', dueDate: '2026-06-01', createdAt: '2026-02-01T00:00:00.000Z' }),
    ])

  req(3, 'sort "created" puts the newest createdAt first', async () => {
    const { sortTasks } = await setup()
    expect(ids(sortTasks(sample(), 'created'))).toEqual(['b', 'c', 'd', 'a'])
  })

  req(3, 'sort "due" orders by due date, earliest first, with undated tasks last', async () => {
    const { sortTasks } = await setup()
    expect(ids(sortTasks(sample(), 'due'))).toEqual(['c', 'd', 'a', 'b'])
  })

  req(3, 'sort "priority" orders high, medium, low', async () => {
    const { sortTasks } = await setup()
    expect(ids(sortTasks(sample(), 'priority'))).toEqual(['b', 'd', 'c', 'a'])
  })

  edge(3, 'every sort is stable: tasks that tie keep their input order', async () => {
    const { sortTasks } = await setup()
    const same = [makeTask({ id: 'x' }), makeTask({ id: 'y' }), makeTask({ id: 'z' })]
    for (const key of ['created', 'due', 'priority']) {
      expect(ids(sortTasks(same, key))).toEqual(['x', 'y', 'z'])
    }
    const reversed = [...same].reverse()
    expect(ids(sortTasks(reversed, 'priority'))).toEqual(['z', 'y', 'x'])
  })

  edge(3, 'sortTasks returns a new array and never mutates its input', async () => {
    const { sortTasks } = await setup()
    const input = sample()
    const out = sortTasks(input, 'due')
    expect(out).not.toBe(input)
    expect(ids(input)).toEqual(['a', 'b', 'c', 'd'])
    expect(out[0]).toBe(input[2])
  })

  edge(1, 'sortTasks handles an empty list', async () => {
    const { sortTasks } = await setup()
    expect(sortTasks([], 'priority')).toEqual([])
  })

  edge(2, 'sort "due" compares calendar days, so 2026-12-01 comes after 2026-02-10', async () => {
    const { sortTasks } = await setup()
    const list = [makeTask({ id: 'dec', dueDate: '2026-12-01' }), makeTask({ id: 'feb', dueDate: '2026-02-10' })]
    expect(ids(sortTasks(list, 'due'))).toEqual(['feb', 'dec'])
  })
})
