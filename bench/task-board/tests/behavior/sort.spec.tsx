import { screen, within } from '@testing-library/react'
import { describe, expect } from 'vitest'
import { makeTask } from '../support/fixtures'
import { addTask, column, renderApp, useFixedToday } from '../support/render'
import { edge, req, state } from '../support/tags'

useFixedToday()

const sortSelect = () => screen.getByLabelText('Sort by')

function titlesIn(name: string): string[] {
  return within(column(name))
    .queryAllByRole('heading', { level: 3 })
    .map((h) => h.textContent ?? '')
}

function board() {
  return [
    makeTask({ id: 'a', title: 'Alpha', priority: 'low', dueDate: '2026-08-01', createdAt: '2026-01-01T00:00:00.000Z' }),
    makeTask({ id: 'b', title: 'Bravo', priority: 'high', dueDate: null, createdAt: '2026-03-01T00:00:00.000Z' }),
    makeTask({ id: 'c', title: 'Charlie', priority: 'medium', dueDate: '2026-07-01', createdAt: '2026-02-01T00:00:00.000Z' }),
    makeTask({ id: 'd', title: 'Delta', priority: 'high', dueDate: '2026-07-01', createdAt: '2026-02-15T00:00:00.000Z', status: 'doing' }),
    makeTask({ id: 'e', title: 'Echo', priority: 'low', dueDate: '2026-06-20', createdAt: '2026-02-20T00:00:00.000Z', status: 'doing' }),
  ]
}

describe('R-SORT-UI: sorting the board', () => {
  req(3, 'the Filters region has a "Sort by" select with Newest first, Due date, Priority', async () => {
    await renderApp(board())
    const filters = screen.getByRole('region', { name: 'Filters' })
    const select = within(filters).getByLabelText('Sort by')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Newest first', 'Due date', 'Priority'])
    expect(select).toHaveValue('created')
  })

  req(3, 'by default every column lists the newest task first', async () => {
    await renderApp(board())
    expect(titlesIn('To do')).toEqual(['Bravo', 'Charlie', 'Alpha'])
    expect(titlesIn('In progress')).toEqual(['Echo', 'Delta'])
  })

  req(3, 'choosing Due date orders each column by due date with undated tasks last', async () => {
    const { user } = await renderApp(board())
    await user.selectOptions(sortSelect(), 'Due date')
    expect(titlesIn('To do')).toEqual(['Charlie', 'Alpha', 'Bravo'])
    expect(titlesIn('In progress')).toEqual(['Echo', 'Delta'])
  })

  req(3, 'choosing Priority orders each column high, medium, low', async () => {
    const { user } = await renderApp(board())
    await user.selectOptions(sortSelect(), 'Priority')
    expect(titlesIn('To do')).toEqual(['Bravo', 'Charlie', 'Alpha'])
    expect(titlesIn('In progress')).toEqual(['Delta', 'Echo'])
  })

  req(2, 'choosing Newest first again restores the default order', async () => {
    const { user } = await renderApp(board())
    await user.selectOptions(sortSelect(), 'Priority')
    await user.selectOptions(sortSelect(), 'Newest first')
    expect(titlesIn('To do')).toEqual(['Bravo', 'Charlie', 'Alpha'])
  })

  edge(3, 'sorting works together with the search and priority filters', async () => {
    const { user } = await renderApp(board())
    await user.selectOptions(sortSelect(), 'Due date')
    await user.selectOptions(screen.getByLabelText('Filter by priority'), 'High')
    expect(titlesIn('To do')).toEqual(['Bravo'])
    expect(titlesIn('In progress')).toEqual(['Delta'])
    expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 5 tasks')
  })

  edge(3, 'Clear filters leaves the sort alone and stays disabled when only the sort changed', async () => {
    const { user } = await renderApp(board())
    const clear = screen.getByRole('button', { name: 'Clear filters' })
    await user.selectOptions(sortSelect(), 'Priority')
    expect(clear).toBeDisabled()
    await user.type(screen.getByLabelText('Search tasks'), 'a')
    expect(clear).toBeEnabled()
    await user.click(clear)
    expect(clear).toBeDisabled()
    expect(sortSelect()).toHaveValue('priority')
    expect(titlesIn('To do')).toEqual(['Bravo', 'Charlie', 'Alpha'])
  })

  edge(3, 'a task that is added or moved lands in the right place for the chosen sort', async () => {
    const { user } = await renderApp(board())
    await user.selectOptions(sortSelect(), 'Priority')
    await addTask(user, { title: 'Zulu', priority: 'High' })
    expect(titlesIn('To do').slice(0, 2)).toEqual(['Zulu', 'Bravo'])
    expect(titlesIn('To do').indexOf('Zulu')).toBeLessThan(titlesIn('To do').indexOf('Charlie'))
    await user.click(screen.getByRole('button', { name: 'Move Echo to To do' }))
    expect(titlesIn('To do').indexOf('Echo')).toBe(titlesIn('To do').length - 1)
  })

  edge(2, 'sorting never changes the header summary or the column counts', async () => {
    const { user } = await renderApp(board())
    await user.selectOptions(sortSelect(), 'Due date')
    expect(screen.getByRole('status')).toHaveTextContent('Showing 5 of 5 tasks')
    expect(screen.getByRole('heading', { level: 2, name: 'To do 3' })).toBeVisible()
  })

  state(3, 'changing the sort commits once', async () => {
    const { user, commits } = await renderApp(board())
    commits.count = 0
    await user.selectOptions(sortSelect(), 'Priority')
    expect(commits.count).toBe(1)
  })

  state(3, 'a card keeps its open edit form when the sort reorders the column', async () => {
    const { user } = await renderApp(board())
    await user.click(screen.getByRole('button', { name: 'Edit Alpha' }))
    await user.type(within(screen.getByRole('form', { name: 'Edit Alpha' })).getByLabelText('Title'), '!')
    await user.selectOptions(sortSelect(), 'Due date')
    expect(within(screen.getByRole('form', { name: 'Edit Alpha' })).getByLabelText('Title')).toHaveValue('Alpha!')
  })
})
