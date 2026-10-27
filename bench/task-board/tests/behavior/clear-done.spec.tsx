import { screen, within } from '@testing-library/react'
import { describe, expect } from 'vitest'
import { makeTask } from '../support/fixtures'
import { column, renderApp, useFixedToday } from '../support/render'
import { edge, req, state } from '../support/tags'

useFixedToday()

const clear = () => screen.getByRole('button', { name: 'Clear completed' })

function mixed() {
  return [
    makeTask({ id: 'a', title: 'Open task', status: 'todo' }),
    makeTask({ id: 'b', title: 'Active task', status: 'doing' }),
    makeTask({ id: 'c', title: 'Finished one', status: 'done', priority: 'high' }),
    makeTask({ id: 'd', title: 'Finished two', status: 'done', priority: 'low' }),
  ]
}

describe('R-CLEAR-DONE: the Clear completed button', () => {
  req(3, 'the header has a Clear completed button that is enabled when a task is done', async () => {
    await renderApp(mixed())
    const header = screen.getByRole('banner')
    expect(within(header).getByRole('button', { name: 'Clear completed' })).toBeEnabled()
  })

  req(3, 'clicking it removes every done task and nothing else', async () => {
    const { user } = await renderApp(mixed())
    await user.click(clear())
    expect(screen.queryByText('Finished one')).not.toBeInTheDocument()
    expect(screen.queryByText('Finished two')).not.toBeInTheDocument()
    expect(screen.getByText('Open task')).toBeVisible()
    expect(screen.getByText('Active task')).toBeVisible()
  })

  req(3, 'the summary and the Done column count update at once', async () => {
    const { user } = await renderApp(mixed())
    await user.click(clear())
    expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 2 tasks')
    expect(screen.getByRole('heading', { level: 2, name: 'Done 0' })).toBeVisible()
    expect(within(column('Done')).getByText('No tasks here.')).toBeVisible()
  })

  req(2, 'the button is disabled when no task is done', async () => {
    await renderApp([makeTask({ id: 'a', status: 'todo' }), makeTask({ id: 'b', status: 'doing' })])
    expect(clear()).toBeDisabled()
  })

  req(2, 'the button is disabled after it has cleared everything', async () => {
    const { user } = await renderApp(mixed())
    await user.click(clear())
    expect(clear()).toBeDisabled()
  })

  edge(3, 'it also removes done tasks that a filter is hiding', async () => {
    const { user } = await renderApp(mixed())
    await user.type(screen.getByLabelText('Search tasks'), 'open')
    expect(screen.queryByText('Finished one')).not.toBeInTheDocument()
    expect(clear()).toBeEnabled()
    await user.click(clear())
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.queryByText('Finished one')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 2 tasks')
  })

  edge(3, 'the button follows moves: moving a task into Done enables it, moving the last one out disables it', async () => {
    const { user } = await renderApp([makeTask({ id: 'a', title: 'Solo', status: 'todo' })])
    expect(clear()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Move Solo to Done' }))
    expect(clear()).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Move Solo to To do' }))
    expect(clear()).toBeDisabled()
  })

  edge(2, 'clearing the only tasks shows the empty-board message', async () => {
    const { user } = await renderApp([makeTask({ id: 'a', status: 'done' })])
    await user.click(clear())
    expect(screen.getByText('No tasks yet. Add your first task above.')).toBeVisible()
  })

  edge(2, 'it needs no confirmation step', async () => {
    const { user } = await renderApp(mixed())
    await user.click(clear())
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  state(3, 'clearing commits once', async () => {
    const { user, commits } = await renderApp(mixed())
    commits.count = 0
    await user.click(clear())
    expect(commits.count).toBe(1)
  })
})
