import { screen, within } from '@testing-library/react'
import { describe, expect } from 'vitest'
import { makeTask, seedTasks } from '../support/fixtures'
import { card, column, inCard, renderApp, useFixedToday } from '../support/render'
import { edge, req } from '../support/tags'

useFixedToday()

describe('R-BOARD: layout, columns and cards', () => {
  req(3, 'the app shows a "Task Board" h1 inside a banner, and a main landmark', async () => {
    await renderApp()
    expect(screen.getByRole('heading', { level: 1, name: 'Task Board' })).toBeVisible()
    expect(within(screen.getByRole('banner')).getByRole('heading', { level: 1 })).toBeVisible()
    expect(screen.getByRole('main')).toBeVisible()
  })

  req(3, 'three named regions To do, In progress and Done appear in that order', async () => {
    await renderApp()
    const regions = ['To do', 'In progress', 'Done'].map(column)
    expect(regions[0].compareDocumentPosition(regions[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(regions[1].compareDocumentPosition(regions[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  req(3, 'each column heading is an h2 containing the label and the visible count', async () => {
    await renderApp([...seedTasks(), makeTask({ title: 'Another todo' })])
    expect(within(column('To do')).getByRole('heading', { level: 2 })).toHaveTextContent('To do 2')
    expect(within(column('In progress')).getByRole('heading', { level: 2 })).toHaveTextContent('In progress 1')
    expect(within(column('Done')).getByRole('heading', { level: 2 })).toHaveTextContent('Done 1')
  })

  req(3, 'each task sits in the column of its status as an article with an h3 title', async () => {
    await renderApp(seedTasks())
    expect(within(column('To do')).getByRole('article', { name: 'Fix login bug' })).toBeVisible()
    expect(within(column('In progress')).getByRole('article', { name: 'Write docs' })).toBeVisible()
    expect(within(column('Done')).getByRole('article', { name: 'Plan sprint' })).toBeVisible()
    expect(within(card('Fix login bug')).getByRole('heading', { level: 3 })).toHaveTextContent('Fix login bug')
  })

  req(2, 'cards are list items of a list, in state order', async () => {
    await renderApp([makeTask({ title: 'Alpha' }), makeTask({ title: 'Beta' }), makeTask({ title: 'Gamma' })])
    const items = within(within(column('To do')).getByRole('list')).getAllByRole('listitem')
    expect(items.map((item) => within(item).getByRole('heading').textContent)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  req(2, 'the description is shown, and omitted when empty', async () => {
    await renderApp([
      makeTask({ title: 'With text', description: 'Some detail' }),
      makeTask({ title: 'Without text', description: '' }),
    ])
    expect(inCard('With text').getByText('Some detail')).toBeVisible()
    expect(within(card('Without text')).queryByText('Some detail')).not.toBeInTheDocument()
    const paragraphs = Array.from(card('Without text').querySelectorAll('p'))
    expect(paragraphs.filter((p) => (p.textContent ?? '').trim() === '')).toHaveLength(0)
  })

  req(3, 'the priority is shown as "<Label> priority"', async () => {
    await renderApp([
      makeTask({ title: 'L', priority: 'low' }),
      makeTask({ title: 'M', priority: 'medium' }),
      makeTask({ title: 'H', priority: 'high' }),
    ])
    expect(inCard('L').getByText('Low priority')).toBeVisible()
    expect(inCard('M').getByText('Medium priority')).toBeVisible()
    expect(inCard('H').getByText('High priority')).toBeVisible()
  })

  req(3, 'a due date is rendered in a <time> element with the ISO value', async () => {
    await renderApp([makeTask({ title: 'Dated', dueDate: '2026-07-04' })])
    const time = inCard('Dated').getByText('Due 4 Jul 2026')
    expect(time.tagName).toBe('TIME')
    expect(time).toHaveAttribute('datetime', '2026-07-04')
  })

  req(3, 'open tasks with a past due date show "Overdue"; done or future tasks do not', async () => {
    await renderApp([
      makeTask({ title: 'Late todo', dueDate: '2026-06-01' }),
      makeTask({ title: 'Late doing', dueDate: '2026-06-14', status: 'doing' }),
      makeTask({ title: 'Late done', dueDate: '2026-06-01', status: 'done' }),
      makeTask({ title: 'Due today', dueDate: '2026-06-15' }),
      makeTask({ title: 'Future', dueDate: '2026-12-01' }),
      makeTask({ title: 'No date' }),
    ])
    expect(inCard('Late todo').getByText('Overdue')).toBeVisible()
    expect(inCard('Late doing').getByText('Overdue')).toBeVisible()
    for (const title of ['Late done', 'Due today', 'Future', 'No date']) {
      expect(within(card(title)).queryByText('Overdue')).not.toBeInTheDocument()
    }
  })

  req(3, 'empty columns say "No tasks here." and an empty board says to add the first task', async () => {
    await renderApp([])
    expect(screen.getByText('No tasks yet. Add your first task above.')).toBeVisible()
    for (const name of ['To do', 'In progress', 'Done']) {
      expect(within(column(name)).getByText('No tasks here.')).toBeVisible()
      expect(within(column(name)).queryByRole('list')).not.toBeInTheDocument()
    }
  })

  req(3, 'the header status reads "Showing X of Y tasks"', async () => {
    await renderApp(seedTasks())
    expect(screen.getByRole('status')).toHaveTextContent('Showing 3 of 3 tasks')
  })

  edge(2, 'the header uses the singular "task" when the total is 1', async () => {
    await renderApp([makeTask({ title: 'Solo' })])
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 1 task')
    expect(screen.getByRole('status').textContent).not.toMatch(/tasks/)
  })

  edge(2, 'the board has no empty-state message when there are visible tasks', async () => {
    await renderApp(seedTasks())
    expect(screen.queryByText('No tasks yet. Add your first task above.')).not.toBeInTheDocument()
    expect(screen.queryByText('No tasks match your filters.')).not.toBeInTheDocument()
  })

  edge(2, 'a column with no tasks still shows its own empty text when others have tasks', async () => {
    await renderApp([makeTask({ title: 'Only todo' })])
    expect(within(column('In progress')).getByText('No tasks here.')).toBeVisible()
    expect(within(column('In progress')).getByRole('heading', { level: 2 })).toHaveTextContent('In progress 0')
    expect(within(column('To do')).queryByText('No tasks here.')).not.toBeInTheDocument()
  })

  edge(2, 'overdue is judged on the calendar day, not the time of day', async () => {
    await renderApp([makeTask({ title: 'Yesterday', dueDate: '2026-06-14' })])
    expect(inCard('Yesterday').getByText('Overdue')).toBeVisible()
  })

  edge(2, 'the due date text never shifts a day in any time zone', async () => {
    await renderApp([makeTask({ title: 'Boundary', dueDate: '2026-01-01' })])
    expect(inCard('Boundary').getByText('Due 1 Jan 2026')).toBeVisible()
  })

  edge(1, 'long titles and descriptions render in full', async () => {
    const title = 'T'.repeat(80)
    const description = 'word '.repeat(80).trim()
    await renderApp([makeTask({ title, description })])
    expect(inCard(title).getByText(description)).toBeVisible()
  })
})
