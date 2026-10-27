import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect } from 'vitest'
import { deepFreeze, makeTask } from '../../../../tests/support/fixtures'
import { loadSrc } from '../../../support/load'
import { lt } from '../../../support/tags'

const ids = (list: { id: string }[]) => list.map((t) => t.id)

async function reducer() {
  const { taskReducer, createInitialState } = await loadSrc('state/taskReducer')
  return { taskReducer, createInitialState }
}

describe('parseLabels', () => {
  lt(4, 'splits on commas, trims, drops empties and removes case-insensitive duplicates', async () => {
    const { parseLabels } = await loadSrc('utils/labels')
    expect(parseLabels(' Bug, ui ,bug,, UI ')).toEqual(['Bug', 'ui'])
    expect(parseLabels('')).toEqual([])
    expect(parseLabels(' , ,')).toEqual([])
    expect(parseLabels('a,b,a,c')).toEqual(['a', 'b', 'c'])
  })
})

describe('labels in the state', () => {
  lt(3, 'DEFAULT_FILTERS has an empty label next to query, priority and sort', async () => {
    const { DEFAULT_FILTERS } = await loadSrc('types/task')
    expect(DEFAULT_FILTERS).toEqual({ query: '', priority: 'all', sort: 'created', label: '' })
  })

  lt(3, 'filters/labelChanged stores the label and is a no-op for the same label', async () => {
    const { taskReducer, createInitialState } = await reducer()
    const state = createInitialState([makeTask({ id: 'a', labels: ['bug'] })])
    const next = taskReducer(state, { type: 'filters/labelChanged', label: 'bug' })
    expect(next.filters.label).toBe('bug')
    expect(taskReducer(next, { type: 'filters/labelChanged', label: 'bug' })).toBe(next)
    expect(taskReducer(state, { type: 'filters/labelChanged', label: '' })).toBe(state)
  })

  lt(4, 'filters/cleared resets query, priority and label but keeps the sort', async () => {
    const { taskReducer, createInitialState } = await reducer()
    let state = createInitialState([makeTask({ id: 'a', labels: ['bug'] })])
    state = taskReducer(state, { type: 'filters/labelChanged', label: 'bug' })
    state = taskReducer(state, { type: 'filters/sortChanged', sort: 'priority' })
    state = taskReducer(state, { type: 'filters/queryChanged', query: 'x' })
    expect(taskReducer(state, { type: 'filters/cleared' }).filters).toEqual({ query: '', priority: 'all', sort: 'priority', label: '' })
  })

  lt(3, 'filters/cleared is a no-op when only the sort differs', async () => {
    const { taskReducer, createInitialState } = await reducer()
    const sorted = taskReducer(createInitialState([]), { type: 'filters/sortChanged', sort: 'due' })
    expect(taskReducer(sorted, { type: 'filters/cleared' })).toBe(sorted)
  })

  lt(5, 'deleting the last task that has the selected label resets the label filter', async () => {
    const { taskReducer, createInitialState } = await reducer()
    let state = createInitialState([makeTask({ id: 'a', labels: ['bug'] }), makeTask({ id: 'b', labels: [] })])
    state = taskReducer(state, { type: 'filters/labelChanged', label: 'bug' })
    const next = taskReducer(state, { type: 'task/deleted', id: 'a' })
    expect(next.filters.label).toBe('')
    expect(ids(next.tasks)).toEqual(['b'])
  })

  lt(4, 'deleting a task keeps the label filter while another task still has the label', async () => {
    const { taskReducer, createInitialState } = await reducer()
    let state = createInitialState([makeTask({ id: 'a', labels: ['Bug'] }), makeTask({ id: 'b', labels: ['bug'] })])
    state = taskReducer(state, { type: 'filters/labelChanged', label: 'Bug' })
    expect(taskReducer(state, { type: 'task/deleted', id: 'a' }).filters.label).toBe('Bug')
  })

  lt(5, 'editing away the last use of the selected label resets the label filter', async () => {
    const { taskReducer, createInitialState } = await reducer()
    let state = createInitialState([makeTask({ id: 'a', labels: ['bug'] })])
    state = taskReducer(state, { type: 'filters/labelChanged', label: 'bug' })
    const next = taskReducer(state, { type: 'task/updated', id: 'a', changes: { labels: ['ui'] } })
    expect(next.filters.label).toBe('')
    expect(next.tasks[0].labels).toEqual(['ui'])
  })

  lt(4, 'clearing done tasks resets the label filter when only done tasks had it', async () => {
    const { taskReducer, createInitialState } = await reducer()
    let state = createInitialState([makeTask({ id: 'a', labels: ['x'], status: 'done' }), makeTask({ id: 'b' })])
    state = taskReducer(state, { type: 'filters/labelChanged', label: 'x' })
    expect(taskReducer(state, { type: 'tasks/doneCleared' }).filters.label).toBe('')
  })

  lt(4, 'an update with the same labels in the same order is a no-op; a new order is not', async () => {
    const { taskReducer, createInitialState } = await reducer()
    const state = createInitialState([makeTask({ id: 'a', labels: ['a', 'b'] })])
    expect(taskReducer(state, { type: 'task/updated', id: 'a', changes: { labels: ['a', 'b'] } })).toBe(state)
    const reordered = taskReducer(state, { type: 'task/updated', id: 'a', changes: { labels: ['b', 'a'] } })
    expect(reordered).not.toBe(state)
    expect(reordered.tasks[0].labels).toEqual(['b', 'a'])
  })

  lt(3, 'the new reducer paths never mutate frozen input', async () => {
    const { taskReducer, createInitialState } = await reducer()
    const state = deepFreeze(createInitialState([makeTask({ id: 'a', labels: ['x'] })]))
    const picked = taskReducer(state, { type: 'filters/labelChanged', label: 'x' })
    expect(() => taskReducer(deepFreeze(picked), { type: 'task/deleted', id: 'a' })).not.toThrow()
    expect(() => taskReducer(state, { type: 'task/updated', id: 'a', changes: { labels: ['y'] } })).not.toThrow()
  })
})

describe('label selectors', () => {
  const tasks = () => [
    makeTask({ id: 'a', title: 'One', labels: ['Bug', 'ui'] }),
    makeTask({ id: 'b', title: 'Two', labels: ['bug'] }),
    makeTask({ id: 'c', title: 'Three', labels: ['api'] }),
    makeTask({ id: 'd', title: 'Four', labels: [] }),
  ]

  lt(4, 'selectVisibleTasks filters by label ignoring case', async () => {
    const { selectVisibleTasks } = await loadSrc('state/selectors')
    const { DEFAULT_FILTERS } = await loadSrc('types/task')
    const filters = { ...DEFAULT_FILTERS, label: 'BUG' }
    expect(ids(selectVisibleTasks({ tasks: tasks(), filters }))).toEqual(['a', 'b'])
  })

  lt(4, 'the text query also matches labels, each label on its own', async () => {
    const { selectVisibleTasks } = await loadSrc('state/selectors')
    const { DEFAULT_FILTERS } = await loadSrc('types/task')
    const find = (query: string) => ids(selectVisibleTasks({ tasks: tasks(), filters: { ...DEFAULT_FILTERS, query } }))
    expect(find('ap')).toEqual(['c'])
    expect(find('UI')).toEqual(['a'])
    expect(find('gui')).toEqual([])
  })

  lt(2, 'the label and the text filters combine with AND', async () => {
    const { selectVisibleTasks } = await loadSrc('state/selectors')
    const { DEFAULT_FILTERS } = await loadSrc('types/task')
    const filters = { ...DEFAULT_FILTERS, label: 'bug', query: 'two' }
    expect(ids(selectVisibleTasks({ tasks: tasks(), filters }))).toEqual(['b'])
  })

  lt(4, 'selectLabels lists distinct labels, first spelling, sorted ignoring case', async () => {
    const { selectLabels } = await loadSrc('state/selectors')
    expect(selectLabels(tasks())).toEqual(['api', 'Bug', 'ui'])
    expect(selectLabels([])).toEqual([])
  })

  lt(2, 'selectLabels does not mutate its input', async () => {
    const { selectLabels } = await loadSrc('state/selectors')
    const frozen = deepFreeze(tasks())
    expect(() => selectLabels(frozen)).not.toThrow()
  })
})

describe('labels through useTasks', () => {
  async function setup() {
    const { useTasks } = await loadSrc('hooks/useTasks')
    const { TaskProvider } = await loadSrc('state/TaskContext')
    const initial = [makeTask({ id: 'a', labels: ['bug'] }), makeTask({ id: 'b', labels: ['ui'] })]
    return renderHook(() => useTasks(), { wrapper: ({ children }: { children: ReactNode }) => <TaskProvider initialTasks={initial}>{children}</TaskProvider> })
  }

  lt(3, 'useTasks exposes labels over all tasks and setLabel filters the columns', async () => {
    const { result } = await setup()
    expect(result.current.labels).toEqual(['bug', 'ui'])
    act(() => result.current.setLabel('ui'))
    expect(ids(result.current.columns.todo)).toEqual(['b'])
    expect(result.current.labels).toEqual(['bug', 'ui'])
  })

  lt(2, 'setLabel keeps its identity and labels keeps its identity on a re-render', async () => {
    const { result, rerender } = await setup()
    const before = { setLabel: result.current.setLabel, labels: result.current.labels }
    rerender()
    act(() => result.current.setQuery('x'))
    expect(result.current.setLabel).toBe(before.setLabel)
    expect(result.current.labels).toBe(before.labels)
  })
})
