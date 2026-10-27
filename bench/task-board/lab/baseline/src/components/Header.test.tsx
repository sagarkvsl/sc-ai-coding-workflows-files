import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../App'
import { TaskProvider } from '../state/TaskContext'
import type { Task } from '../types/task'

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

const seed = [
  makeTask({ id: '1', title: 'Open one', priority: 'low', dueDate: '2026-09-01' }),
  makeTask({ id: '2', title: 'Open two', priority: 'high', dueDate: '2026-08-01' }),
  makeTask({ id: '3', title: 'Finished', status: 'done' }),
]

function renderApp(tasks: Task[] = seed) {
  render(
    <TaskProvider initialTasks={tasks}>
      <App />
    </TaskProvider>,
  )
  return userEvent.setup()
}

function titlesIn(name: string): string[] {
  const region = screen.getByRole('region', { name })
  return within(region)
    .queryAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent ?? '')
}

describe('clear completed', () => {
  it('removes done tasks, updates the counts and disables itself', async () => {
    const user = renderApp()
    const button = screen.getByRole('button', { name: 'Clear completed' })
    expect(button).toBeEnabled()
    await user.click(button)
    expect(screen.queryByText('Finished')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 2 tasks')
    expect(button).toBeDisabled()
  })

  it('removes done tasks that a filter is hiding', async () => {
    const user = renderApp()
    await user.type(screen.getByLabelText('Search tasks'), 'Open')
    await user.click(screen.getByRole('button', { name: 'Clear completed' }))
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.queryByText('Finished')).not.toBeInTheDocument()
  })

  it('is disabled when no task is done', () => {
    renderApp([makeTask({ id: 'x', title: 'Only open' })])
    expect(screen.getByRole('button', { name: 'Clear completed' })).toBeDisabled()
  })
})

describe('sort by', () => {
  it('orders a column by due date with undated tasks last', async () => {
    const user = renderApp([...seed, makeTask({ id: '4', title: 'No date' })])
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Due date')
    expect(titlesIn('To do')).toEqual(['Open two', 'Open one', 'No date'])
  })

  it('orders a column by priority, high first', async () => {
    const user = renderApp()
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Priority')
    expect(titlesIn('To do')).toEqual(['Open two', 'Open one'])
  })

  it('keeps the chosen sort when the filters are cleared', async () => {
    const user = renderApp()
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Priority')
    await user.type(screen.getByLabelText('Search tasks'), 'Open')
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByLabelText('Sort by')).toHaveValue('priority')
  })
})
