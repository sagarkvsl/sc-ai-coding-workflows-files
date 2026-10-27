import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { TaskProvider } from '../state/TaskContext'

function renderApp() {
  render(
    <TaskProvider>
      <App />
    </TaskProvider>,
  )
  return userEvent.setup()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('add task form', () => {
  it('adds a trimmed task to the To do column', async () => {
    const user = renderApp()
    await user.type(screen.getByLabelText('Title'), '  Buy milk  ')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    const todo = screen.getByRole('region', { name: 'To do' })
    expect(within(todo).getByRole('heading', { level: 3, name: 'Buy milk' })).toBeVisible()
  })

  it('shows a required error for an empty title and adds nothing', async () => {
    const user = renderApp()
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Title is required.')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('treats a whitespace-only title as empty', async () => {
    const user = renderApp()
    await user.type(screen.getByLabelText('Title'), '   ')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Title is required.')
  })

  it('accepts a title of exactly 80 characters and rejects 81', async () => {
    const user = renderApp()
    const title = screen.getByLabelText('Title')
    await user.type(title, 'a'.repeat(81))
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Title must be 80 characters or fewer.',
    )

    await user.type(title, '{Backspace}')
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })

  it('rejects a due date in the past but accepts today', async () => {
    const user = renderApp()
    await user.type(screen.getByLabelText('Title'), 'Pay rent')
    await user.type(screen.getByLabelText('Due date'), '2026-06-14')
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Due date cannot be in the past.')

    await user.clear(screen.getByLabelText('Due date'))
    await user.type(screen.getByLabelText('Due date'), '2026-06-15')
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('links the error to the invalid field and clears it on typing', async () => {
    const user = renderApp()
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    const title = screen.getByLabelText('Title')
    expect(title).toBeInvalid()
    expect(title).toHaveAccessibleDescription('Title is required.')

    await user.type(title, 'x')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('resets the fields and focuses the title after a successful add', async () => {
    const user = renderApp()
    await user.type(screen.getByLabelText('Title'), 'Water plants')
    await user.type(screen.getByLabelText('Description'), 'Balcony')
    await user.selectOptions(screen.getByLabelText('Priority'), 'High')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    expect(screen.getByLabelText('Title')).toHaveValue('')
    expect(screen.getByLabelText('Description')).toHaveValue('')
    expect(screen.getByLabelText('Priority')).toHaveValue('medium')
    expect(screen.getByLabelText('Title')).toHaveFocus()
  })
})
