import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, vi } from 'vitest'
import { makeTask } from '../support/fixtures'
import { loadProvider, loadUseTasks } from '../support/load'
import { edge, req, state } from '../support/tags'

async function setup(tasks = [
  makeTask({ id: 'a', title: 'Fix login bug', priority: 'high' }),
  makeTask({ id: 'b', title: 'Write docs', status: 'doing' }),
  makeTask({ id: 'c', title: 'Plan sprint', priority: 'low', status: 'done' }),
]) {
  const { useTasks } = await loadUseTasks()
  const { TaskProvider } = await loadProvider()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TaskProvider initialTasks={tasks}>{children}</TaskProvider>
  )
  return renderHook(() => useTasks(), { wrapper })
}

const ids = (list: { id: string }[]) => list.map((t) => t.id)

describe('R-HOOK: useTasks', () => {
  req(3, 'exposes the tasks grouped by status plus total and visibleCount', async () => {
    const { result } = await setup()
    expect(ids(result.current.columns.todo)).toEqual(['a'])
    expect(ids(result.current.columns.doing)).toEqual(['b'])
    expect(ids(result.current.columns.done)).toEqual(['c'])
    expect(result.current.total).toBe(3)
    expect(result.current.visibleCount).toBe(3)
    expect(result.current.filters).toEqual({ query: '', priority: 'all', sort: 'created' })
  })

  req(4, 'addTask creates a todo task at the top with a fresh id and ISO createdAt', async () => {
    const { result } = await setup()
    act(() =>
      result.current.addTask({ title: 'New', description: 'd', priority: 'low', dueDate: null }),
    )
    act(() =>
      result.current.addTask({ title: 'Newer', description: '', priority: 'high', dueDate: '2026-07-01' }),
    )
    const [newer, older] = result.current.columns.todo
    expect(newer).toMatchObject({ title: 'Newer', status: 'todo', priority: 'high', dueDate: '2026-07-01' })
    expect(older).toMatchObject({ title: 'New', status: 'todo', description: 'd', dueDate: null })
    expect(newer.id).not.toBe(older.id)
    expect(typeof newer.id).toBe('string')
    expect(new Date(newer.createdAt).toISOString()).toBe(newer.createdAt)
    expect(result.current.total).toBe(5)
  })

  req(3, 'updateTask, moveTask and deleteTask change the right task', async () => {
    const { result } = await setup()
    act(() => result.current.updateTask('a', { title: 'Renamed' }))
    expect(result.current.columns.todo[0].title).toBe('Renamed')
    act(() => result.current.moveTask('a', 'done'))
    expect(ids(result.current.columns.done)).toEqual(['a', 'c'])
    act(() => result.current.deleteTask('b'))
    expect(result.current.total).toBe(2)
    expect(result.current.columns.doing).toEqual([])
  })

  req(3, 'setQuery, setPriority and clearFilters drive columns and visibleCount', async () => {
    const { result } = await setup()
    act(() => result.current.setQuery('docs'))
    expect(result.current.visibleCount).toBe(1)
    expect(result.current.total).toBe(3)
    act(() => result.current.setQuery(''))
    act(() => result.current.setPriority('high'))
    expect(ids(result.current.columns.todo)).toEqual(['a'])
    expect(result.current.visibleCount).toBe(1)
    act(() => result.current.clearFilters())
    expect(result.current.visibleCount).toBe(3)
    expect(result.current.filters).toEqual({ query: '', priority: 'all', sort: 'created' })
  })

  edge(3, 'throws a helpful error when used outside TaskProvider', async () => {
    const { useTasks } = await loadUseTasks()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useTasks())).toThrowError(/TaskProvider/)
    spy.mockRestore()
  })

  edge(2, 'TaskProvider works with no initialTasks', async () => {
    const { useTasks } = await loadUseTasks()
    const { TaskProvider } = await loadProvider()
    const { result } = renderHook(() => useTasks(), {
      wrapper: ({ children }: { children: ReactNode }) => <TaskProvider>{children}</TaskProvider>,
    })
    expect(result.current.total).toBe(0)
    expect(result.current.columns).toEqual({ todo: [], doing: [], done: [] })
  })

  state(4, 'action functions keep their identity across state changes', async () => {
    const { result } = await setup()
    const before = { ...result.current }
    act(() => result.current.moveTask('a', 'done'))
    act(() => result.current.setQuery('x'))
    for (const name of [
      'addTask',
      'updateTask',
      'moveTask',
      'deleteTask',
      'clearDone',
      'setQuery',
      'setPriority',
      'setSort',
      'clearFilters',
    ] as const) {
      expect(result.current[name]).toBe(before[name])
    }
  })

  state(4, 'columns keep their identity when a re-render changes nothing', async () => {
    const { result, rerender } = await setup()
    const before = result.current.columns
    rerender()
    rerender()
    expect(result.current.columns).toBe(before)
  })

  state(3, 'columns, total and visibleCount are derived, never stale', async () => {
    const { result } = await setup()
    const before = result.current.columns
    act(() => result.current.setPriority('low'))
    expect(result.current.columns).not.toBe(before)
    expect(result.current.visibleCount).toBe(1)
    act(() => result.current.addTask({ title: 'x', description: '', priority: 'low', dueDate: null }))
    expect(result.current.total).toBe(4)
    expect(result.current.visibleCount).toBe(2)
  })
})
