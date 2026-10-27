import { screen, within } from '@testing-library/react'
import { describe, expect } from 'vitest'
import { seedTasks } from '../support/fixtures'
import { addTask, column, renderApp, useFixedToday } from '../support/render'
import { edge, req } from '../support/tags'

useFixedToday()

const search = () => screen.getByLabelText('Search tasks')
const priority = () => screen.getByLabelText('Filter by priority')
const clear = () => screen.getByRole('button', { name: 'Clear filters' })

describe('R-FILTER: search and priority filters', () => {
  req(3, 'the Filters region has a search box, a priority select and a clear button', async () => {
    await renderApp(seedTasks())
    const filters = screen.getByRole('region', { name: 'Filters' })
    expect(within(filters).getByLabelText('Search tasks')).toBeVisible()
    const options = within(within(filters).getByLabelText('Filter by priority')).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['All priorities', 'Low', 'Medium', 'High'])
    expect(priority()).toHaveValue('all')
  })

  req(3, 'typing in the search box filters by title', async () => {
    const { user } = await renderApp(seedTasks())
    await user.type(search(), 'sprint')
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('article', { name: 'Plan sprint' })).toBeVisible()
  })

  req(3, 'the search also matches the description, ignoring case', async () => {
    const { user } = await renderApp(seedTasks())
    await user.type(search(), 'login')
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['Fix login bug', 'Write docs'])
  })

  req(3, 'the priority select filters by priority', async () => {
    const { user } = await renderApp(seedTasks())
    await user.selectOptions(priority(), 'Low')
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('article', { name: 'Plan sprint' })).toBeVisible()
  })

  req(2, 'search and priority combine', async () => {
    const { user } = await renderApp(seedTasks())
    await user.type(search(), 'login')
    await user.selectOptions(priority(), 'High')
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('article', { name: 'Fix login bug' })).toBeVisible()
  })

  req(3, 'the header and column counts follow the filters', async () => {
    const { user } = await renderApp(seedTasks())
    await user.type(search(), 'login')
    expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 3 tasks')
    expect(within(column('To do')).getByRole('heading', { level: 2 })).toHaveTextContent('To do 1')
    expect(within(column('Done')).getByRole('heading', { level: 2 })).toHaveTextContent('Done 0')
  })

  req(3, '"Clear filters" is disabled until a filter is set, then resets both controls', async () => {
    const { user } = await renderApp(seedTasks())
    expect(clear()).toBeDisabled()
    await user.type(search(), 'x')
    await user.selectOptions(priority(), 'High')
    expect(clear()).toBeEnabled()
    await user.click(clear())
    expect(search()).toHaveValue('')
    expect(priority()).toHaveValue('all')
    expect(clear()).toBeDisabled()
    expect(screen.getAllByRole('article')).toHaveLength(3)
  })

  req(3, 'when filters hide everything the board says "No tasks match your filters."', async () => {
    const { user } = await renderApp(seedTasks())
    await user.type(search(), 'zzz')
    expect(screen.getByText('No tasks match your filters.')).toBeVisible()
    expect(screen.queryByText('No tasks yet. Add your first task above.')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Showing 0 of 3 tasks')
  })

  edge(3, 'a whitespace-only search shows every task but still enables Clear filters', async () => {
    const { user } = await renderApp(seedTasks())
    await user.type(search(), '   ')
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(clear()).toBeEnabled()
  })

  edge(3, 'a new task that does not match the active filter is hidden but counted in the total', async () => {
    const { user } = await renderApp(seedTasks())
    await user.type(search(), 'login')
    await addTask(user, { title: 'Water plants' })
    expect(screen.queryByRole('article', { name: 'Water plants' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 4 tasks')
    await user.click(clear())
    expect(screen.getByRole('article', { name: 'Water plants' })).toBeVisible()
  })

  edge(2, 'filters stay applied when a card is moved to another column', async () => {
    const { user } = await renderApp(seedTasks())
    await user.type(search(), 'login')
    await user.click(screen.getByRole('button', { name: 'Move Fix login bug to Done' }))
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(within(column('Done')).getByRole('article', { name: 'Fix login bug' })).toBeVisible()
  })

  edge(2, 'the search matches letters in the middle of a word', async () => {
    const { user } = await renderApp(seedTasks())
    await user.type(search(), 'ogi')
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  edge(2, 'deleting the last visible task under a filter shows the no-match message', async () => {
    const { user } = await renderApp(seedTasks())
    await user.type(search(), 'sprint')
    await user.click(screen.getByRole('button', { name: 'Delete Plan sprint' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete Plan sprint' }))
    expect(screen.getByText('No tasks match your filters.')).toBeVisible()
  })
})
