import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect } from 'vitest'
import { makeTask } from '../support/fixtures'
import { loadProvider, loadUseTasks } from '../support/load'
import { edge, req, state } from '../support/tags'

async function setup() {
  const { useTasks } = await loadUseTasks()
  const { TaskProvider } = await loadProvider()
  const tasks = [
    makeTask({ id: 'a', title: 'Alpha', priority: 'low', dueDate: '2026-08-01' }),
    makeTask({ id: 'b', title: 'Beta', priority: 'high', status: 'done' }),
    makeTask({ id: 'c', title: 'Gamma', priority: 'high', dueDate: '2026-07-01' }),
    makeTask({ id: 'd', title: 'Delta', priority: 'medium', status: 'done' }),
  ]
  return renderHook(() => useTasks(), {
    wrapper: ({ children }: { children: ReactNode }) => <TaskProvider initialTasks={tasks}>{children}</TaskProvider>,
  })
}

const ids = (list: { id: string }[]) => list.map((t) => t.id)

describe('R-HOOK-V2: sort and clear-done through useTasks', () => {
  req(3, 'doneCount counts every done task, ignoring the filters', async () => {
    const { result } = await setup()
    expect(result.current.doneCount).toBe(2)
    act(() => result.current.setQuery('alpha'))
    expect(result.current.visibleCount).toBe(1)
    expect(result.current.doneCount).toBe(2)
  })

  req(3, 'clearDone removes done tasks, including ones a filter hides', async () => {
    const { result } = await setup()
    act(() => result.current.setQuery('alpha'))
    act(() => result.current.clearDone())
    act(() => result.current.clearFilters())
    expect(result.current.total).toBe(2)
    expect(result.current.doneCount).toBe(0)
    expect(result.current.columns.done).toEqual([])
  })

  req(3, 'setSort reorders every column and is stored in filters.sort', async () => {
    const { result } = await setup()
    expect(result.current.filters.sort).toBe('created')
    act(() => result.current.setSort('due'))
    expect(result.current.filters.sort).toBe('due')
    expect(ids(result.current.columns.todo)).toEqual(['c', 'a'])
    act(() => result.current.setSort('priority'))
    expect(ids(result.current.columns.todo)).toEqual(['c', 'a'])
    expect(ids(result.current.columns.done)).toEqual(['b', 'd'])
  })

  edge(3, 'sorting is applied after filtering and never changes the counts', async () => {
    const { result } = await setup()
    act(() => result.current.setPriority('high'))
    act(() => result.current.setSort('due'))
    expect(ids(result.current.columns.todo)).toEqual(['c'])
    expect(result.current.visibleCount).toBe(2)
    expect(result.current.total).toBe(4)
  })

  edge(2, 'clearFilters keeps the chosen sort', async () => {
    const { result } = await setup()
    act(() => result.current.setSort('priority'))
    act(() => result.current.setQuery('x'))
    act(() => result.current.clearFilters())
    expect(result.current.filters).toEqual({ query: '', priority: 'all', sort: 'priority' })
  })

  state(3, 'columns keep their identity on a re-render and change when the sort changes', async () => {
    const { result, rerender } = await setup()
    const before = result.current.columns
    rerender()
    expect(result.current.columns).toBe(before)
    act(() => result.current.setSort('due'))
    expect(result.current.columns).not.toBe(before)
  })

  state(2, 'doneCount is derived: it follows moves and deletes without a stale value', async () => {
    const { result } = await setup()
    act(() => result.current.moveTask('a', 'done'))
    expect(result.current.doneCount).toBe(3)
    act(() => result.current.deleteTask('b'))
    expect(result.current.doneCount).toBe(2)
    act(() => result.current.moveTask('d', 'todo'))
    expect(result.current.doneCount).toBe(1)
  })
})
