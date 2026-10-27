import { describe, expect } from 'vitest'
import { deepFreeze, makeTask } from '../support/fixtures'
import { loadSelectors, loadTypes } from '../support/load'
import { edge, req, state } from '../support/tags'

async function setup() {
  const { selectVisibleTasks, groupByStatus } = await loadSelectors()
  const { DEFAULT_FILTERS } = await loadTypes()
  const tasks = [
    makeTask({ id: '1', title: 'Fix login bug', priority: 'high' }),
    makeTask({ id: '2', title: 'Write docs', description: 'Explain the LOGIN flow' }),
    makeTask({ id: '3', title: 'Plan sprint', priority: 'low', status: 'done' }),
    makeTask({ id: '4', title: 'Review PR', priority: 'high', status: 'doing' }),
  ]
  const withFilters = (filters: Record<string, string>) => ({
    tasks,
    filters: { ...DEFAULT_FILTERS, ...filters },
  })
  const ids = (list: { id: string }[]) => list.map((t) => t.id)
  return { selectVisibleTasks, groupByStatus, tasks, withFilters, ids }
}

describe('R-SELECT: selectors', () => {
  req(2, 'selectVisibleTasks returns every task when no filter is active', async () => {
    const { selectVisibleTasks, withFilters, ids } = await setup()
    expect(ids(selectVisibleTasks(withFilters({})))).toEqual(['1', '2', '3', '4'])
  })

  req(3, 'the query matches the title and the description', async () => {
    const { selectVisibleTasks, withFilters, ids } = await setup()
    expect(ids(selectVisibleTasks(withFilters({ query: 'login' })))).toEqual(['1', '2'])
  })

  req(2, 'the query is case-insensitive', async () => {
    const { selectVisibleTasks, withFilters, ids } = await setup()
    expect(ids(selectVisibleTasks(withFilters({ query: 'DOCS' })))).toEqual(['2'])
  })

  req(3, 'the priority filter keeps only that priority', async () => {
    const { selectVisibleTasks, withFilters, ids } = await setup()
    expect(ids(selectVisibleTasks(withFilters({ priority: 'high' })))).toEqual(['1', '4'])
  })

  req(2, 'the query and the priority filter are combined with AND', async () => {
    const { selectVisibleTasks, withFilters, ids } = await setup()
    expect(ids(selectVisibleTasks(withFilters({ query: 'login', priority: 'high' })))).toEqual(['1'])
  })

  req(3, 'groupByStatus returns an array for every status, in input order', async () => {
    const { groupByStatus, tasks, ids } = await setup()
    const groups = groupByStatus(tasks)
    expect(Object.keys(groups).sort()).toEqual(['doing', 'done', 'todo'])
    expect(ids(groups.todo)).toEqual(['1', '2'])
    expect(ids(groups.doing)).toEqual(['4'])
    expect(ids(groups.done)).toEqual(['3'])
    expect(groupByStatus([])).toEqual({ todo: [], doing: [], done: [] })
  })

  edge(2, 'the query is trimmed before matching', async () => {
    const { selectVisibleTasks, withFilters, ids } = await setup()
    expect(ids(selectVisibleTasks(withFilters({ query: '   fix  ' })))).toEqual(['1'])
  })

  edge(2, 'a whitespace-only query does not filter anything', async () => {
    const { selectVisibleTasks, withFilters } = await setup()
    expect(selectVisibleTasks(withFilters({ query: '     ' }))).toHaveLength(4)
  })

  edge(1, 'no match gives an empty list', async () => {
    const { selectVisibleTasks, withFilters } = await setup()
    expect(selectVisibleTasks(withFilters({ query: 'zzz' }))).toEqual([])
  })

  edge(2, 'matching does not span the boundary between title and description', async () => {
    const { selectVisibleTasks } = await loadSelectors()
    const { DEFAULT_FILTERS } = await loadTypes()
    const tasks = [makeTask({ id: 'x', title: 'alpha', description: 'beta' })]
    const result = selectVisibleTasks({ tasks, filters: { ...DEFAULT_FILTERS, query: 'alpha beta' } })
    expect(result).toEqual([])
  })

  state(2, 'selectors do not mutate their input and return the original task objects', async () => {
    const { selectVisibleTasks, groupByStatus, tasks, withFilters } = await setup()
    const frozen = deepFreeze(structuredClone(tasks))
    const input = { tasks: frozen, filters: withFilters({ query: 'o' }).filters }
    expect(() => selectVisibleTasks(input)).not.toThrow()
    expect(() => groupByStatus(frozen)).not.toThrow()
    const visible = selectVisibleTasks({ tasks, filters: withFilters({ query: 'fix' }).filters })
    expect(visible[0]).toBe(tasks[0])
    expect(groupByStatus(tasks).todo[0]).toBe(tasks[0])
  })
})
