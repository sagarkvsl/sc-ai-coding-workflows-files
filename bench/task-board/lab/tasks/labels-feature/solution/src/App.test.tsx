import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import { TaskProvider } from './state/TaskContext'
import type { Task } from './types/task'

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'id',
    title: 'Task',
    description: '',
    priority: 'medium',
    status: 'todo',
    dueDate: null,
    labels: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const seed = [
  makeTask({ id: '1', title: 'Fix login bug', priority: 'high' }),
  makeTask({ id: '2', title: 'Write docs', status: 'doing' }),
  makeTask({ id: '3', title: 'Plan sprint', priority: 'low', status: 'done' }),
]

function renderApp(tasks: Task[] = seed) {
  render(
    <TaskProvider initialTasks={tasks}>
      <App />
    </TaskProvider>,
  )
  return userEvent.setup()
}

function column(name: string) {
  return screen.getByRole('region', { name })
}

describe('board', () => {
  it('shows each task in the column for its status', () => {
    renderApp()
    expect(within(column('To do')).getByText('Fix login bug')).toBeVisible()
    expect(within(column('In progress')).getByText('Write docs')).toBeVisible()
    expect(within(column('Done')).getByText('Plan sprint')).toBeVisible()
  })

  it('shows the number of visible tasks in the header and the columns', () => {
    renderApp()
    expect(screen.getByRole('status')).toHaveTextContent('Showing 3 of 3 tasks')
    expect(within(column('To do')).getByRole('heading', { level: 2 })).toHaveTextContent(
      'To do 1',
    )
  })

  it('shows empty messages for an empty board and an empty column', () => {
    renderApp([])
    expect(screen.getByText('No tasks yet. Add your first task above.')).toBeVisible()
    expect(within(column('Done')).getByText('No tasks here.')).toBeVisible()
  })
})

describe('moving and deleting', () => {
  it('moves a task to another column', async () => {
    const user = renderApp()
    await user.click(screen.getByRole('button', { name: 'Move Fix login bug to Done' }))
    expect(within(column('Done')).getByText('Fix login bug')).toBeVisible()
    expect(within(column('To do')).queryByText('Fix login bug')).not.toBeInTheDocument()
  })

  it('deletes a task only after confirmation', async () => {
    const user = renderApp()
    await user.click(screen.getByRole('button', { name: 'Delete Write docs' }))
    await user.click(screen.getByRole('button', { name: 'Cancel delete Write docs' }))
    expect(screen.getByText('Write docs')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Delete Write docs' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete Write docs' }))
    expect(screen.queryByText('Write docs')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 2 tasks')
  })
})

describe('editing', () => {
  it('saves changes made in the inline form', async () => {
    const user = renderApp()
    await user.click(screen.getByRole('button', { name: 'Edit Write docs' }))
    const form = screen.getByRole('form', { name: 'Edit Write docs' })
    await user.clear(within(form).getByLabelText('Title'))
    await user.type(within(form).getByLabelText('Title'), 'Write guide')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Write guide')).toBeVisible()
  })

  it('discards changes when the user cancels', async () => {
    const user = renderApp()
    await user.click(screen.getByRole('button', { name: 'Edit Write docs' }))
    const form = screen.getByRole('form', { name: 'Edit Write docs' })
    await user.type(within(form).getByLabelText('Title'), ' extra')
    await user.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Write docs')).toBeVisible()
  })

  it('keeps an open edit form when another card moves', async () => {
    const user = renderApp([
      makeTask({ id: 'b', title: 'Second' }),
      makeTask({ id: 'a', title: 'First' }),
    ])
    await user.click(screen.getByRole('button', { name: 'Edit First' }))
    await user.click(screen.getByRole('button', { name: 'Move Second to Done' }))
    expect(screen.getByRole('form', { name: 'Edit First' })).toBeVisible()
  })
})

describe('filters', () => {
  it('narrows the board by search text and updates the counts', async () => {
    const user = renderApp()
    await user.type(screen.getByLabelText('Search tasks'), 'login')
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 3 tasks')
    expect(screen.queryByText('Write docs')).not.toBeInTheDocument()
  })

  it('clears every filter with the clear button', async () => {
    const user = renderApp()
    const clear = screen.getByRole('button', { name: 'Clear filters' })
    expect(clear).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Filter by priority'), 'Low')
    expect(clear).toBeEnabled()
    await user.click(clear)
    expect(screen.getByRole('status')).toHaveTextContent('Showing 3 of 3 tasks')
    expect(screen.getByLabelText('Filter by priority')).toHaveValue('all')
  })

  it('explains when no task matches the filters', async () => {
    const user = renderApp()
    await user.type(screen.getByLabelText('Search tasks'), 'zzz')
    expect(screen.getByText('No tasks match your filters.')).toBeVisible()
  })
})
