import { screen, within } from '@testing-library/react'
import { describe, expect } from 'vitest'
import { makeTask, seedTasks } from '../support/fixtures'
import { card, column, form, inCard, renderApp, useFixedToday } from '../support/render'
import { edge, req } from '../support/tags'

useFixedToday()

const names = (buttons: HTMLElement[]) => buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent)

describe('R-MOVE: moving and deleting', () => {
  req(3, 'each card offers Move buttons for the two other statuses only', async () => {
    await renderApp(seedTasks())
    const moveNames = (title: string) =>
      names(inCard(title).getAllByRole('button', { name: /^Move / }))
    expect(moveNames('Fix login bug')).toEqual(['Move Fix login bug to In progress', 'Move Fix login bug to Done'])
    expect(moveNames('Write docs')).toEqual(['Move Write docs to To do', 'Move Write docs to Done'])
    expect(moveNames('Plan sprint')).toEqual(['Move Plan sprint to To do', 'Move Plan sprint to In progress'])
  })

  req(4, 'clicking a Move button moves the card and updates the counts', async () => {
    const { user } = await renderApp(seedTasks())
    await user.click(screen.getByRole('button', { name: 'Move Fix login bug to Done' }))
    expect(within(column('Done')).getByRole('article', { name: 'Fix login bug' })).toBeVisible()
    expect(within(column('To do')).queryByRole('article')).not.toBeInTheDocument()
    expect(within(column('To do')).getByRole('heading', { level: 2 })).toHaveTextContent('To do 0')
    expect(within(column('Done')).getByRole('heading', { level: 2 })).toHaveTextContent('Done 2')
  })

  req(2, 'a moved card goes to the top of its new column when state order puts it there', async () => {
    const { user } = await renderApp([
      makeTask({ title: 'Mover' }),
      makeTask({ title: 'Resident', status: 'doing' }),
    ])
    await user.click(screen.getByRole('button', { name: 'Move Mover to In progress' }))
    const titles = within(column('In progress')).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['Mover', 'Resident'])
  })

  req(4, 'Delete asks for confirmation; Confirm removes the card', async () => {
    const { user } = await renderApp(seedTasks())
    await user.click(screen.getByRole('button', { name: 'Delete Write docs' }))
    expect(screen.getByRole('article', { name: 'Write docs' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Confirm delete Write docs' }))
    expect(screen.queryByRole('article', { name: 'Write docs' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 2 tasks')
  })

  req(3, 'Cancel delete keeps the card and brings the Delete button back', async () => {
    const { user } = await renderApp(seedTasks())
    await user.click(screen.getByRole('button', { name: 'Delete Write docs' }))
    await user.click(screen.getByRole('button', { name: 'Cancel delete Write docs' }))
    expect(screen.getByRole('article', { name: 'Write docs' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Delete Write docs' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Confirm delete Write docs' })).not.toBeInTheDocument()
  })

  edge(3, 'only the card being deleted shows the confirm buttons', async () => {
    const { user } = await renderApp(seedTasks())
    await user.click(screen.getByRole('button', { name: 'Delete Write docs' }))
    expect(screen.getByRole('button', { name: 'Delete Fix login bug' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Confirm delete Fix login bug' })).not.toBeInTheDocument()
  })

  edge(2, 'deleting the last task shows the empty board message', async () => {
    const { user } = await renderApp([makeTask({ title: 'Last' })])
    await user.click(screen.getByRole('button', { name: 'Delete Last' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete Last' }))
    expect(screen.getByText('No tasks yet. Add your first task above.')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Showing 0 of 0 tasks')
  })

  edge(3, 'moving an overdue task to Done removes its Overdue marker', async () => {
    const { user } = await renderApp([makeTask({ title: 'Late', dueDate: '2026-06-01' })])
    expect(inCard('Late').getByText('Overdue')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Move Late to Done' }))
    expect(within(card('Late')).queryByText('Overdue')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Move Late to To do' }))
    expect(inCard('Late').getByText('Overdue')).toBeVisible()
  })

  edge(2, 'a pending delete confirmation survives other cards changing', async () => {
    const { user } = await renderApp(seedTasks())
    await user.click(screen.getByRole('button', { name: 'Delete Plan sprint' }))
    await user.click(screen.getByRole('button', { name: 'Move Fix login bug to In progress' }))
    expect(screen.getByRole('button', { name: 'Confirm delete Plan sprint' })).toBeVisible()
  })
})

describe('R-EDIT: inline editing', () => {
  const dated = () => [
    makeTask({ id: 'e', title: 'Edit me', description: 'Old text', priority: 'low', dueDate: '2026-06-01' }),
    makeTask({ id: 'f', title: 'Other task' }),
  ]

  req(4, 'Edit opens an inline form prefilled with the task values', async () => {
    const { user } = await renderApp(dated())
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    const scope = within(form('Edit Edit me'))
    expect(scope.getByLabelText('Title')).toHaveValue('Edit me')
    expect(scope.getByLabelText('Description')).toHaveValue('Old text')
    expect(scope.getByLabelText('Priority')).toHaveValue('low')
    expect(scope.getByLabelText('Due date')).toHaveValue('2026-06-01')
    expect(scope.getByRole('button', { name: 'Save' })).toBeVisible()
    expect(scope.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  req(4, 'Save applies every changed field and closes the form', async () => {
    const { user } = await renderApp(dated())
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    const scope = within(form('Edit Edit me'))
    await user.clear(scope.getByLabelText('Title'))
    await user.type(scope.getByLabelText('Title'), '  New title ')
    await user.clear(scope.getByLabelText('Description'))
    await user.type(scope.getByLabelText('Description'), 'New text')
    await user.selectOptions(scope.getByLabelText('Priority'), 'High')
    await user.clear(scope.getByLabelText('Due date'))
    await user.type(scope.getByLabelText('Due date'), '2026-08-09')
    await user.click(scope.getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('form', { name: /^Edit / })).not.toBeInTheDocument()
    const updated = inCard('New title')
    expect(updated.getByText('New text')).toBeVisible()
    expect(updated.getByText('High priority')).toBeVisible()
    expect(updated.getByText('Due 9 Aug 2026')).toBeVisible()
  })

  req(3, 'Cancel discards the changes', async () => {
    const { user } = await renderApp(dated())
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    const scope = within(form('Edit Edit me'))
    await user.type(scope.getByLabelText('Title'), ' CHANGED')
    await user.click(scope.getByRole('button', { name: 'Cancel' }))
    expect(inCard('Edit me').getByText('Old text')).toBeVisible()
    expect(screen.queryByText('Edit me CHANGED')).not.toBeInTheDocument()
  })

  req(3, 'pressing Escape in the edit form cancels it', async () => {
    const { user } = await renderApp(dated())
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    await user.type(within(form('Edit Edit me')).getByLabelText('Title'), ' CHANGED{Escape}')
    expect(screen.queryByRole('form', { name: /^Edit / })).not.toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Edit me' })).toBeVisible()
  })

  req(3, 'an empty title is rejected inside the edit form', async () => {
    const { user } = await renderApp(dated())
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    const scope = within(form('Edit Edit me'))
    await user.clear(scope.getByLabelText('Title'))
    await user.click(scope.getByRole('button', { name: 'Save' }))
    expect(scope.getByRole('alert')).toHaveTextContent('Title is required.')
    expect(form('Edit Edit me')).toBeVisible()
  })

  req(2, 'a title over 80 characters is rejected inside the edit form', async () => {
    const { user } = await renderApp(dated())
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    const scope = within(form('Edit Edit me'))
    await user.clear(scope.getByLabelText('Title'))
    await user.type(scope.getByLabelText('Title'), 'z'.repeat(81))
    await user.click(scope.getByRole('button', { name: 'Save' }))
    expect(scope.getByRole('alert')).toHaveTextContent('Title must be 80 characters or fewer.')
  })

  edge(3, 'editing allows keeping a due date that is already in the past', async () => {
    const { user } = await renderApp(dated())
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    const scope = within(form('Edit Edit me'))
    await user.type(scope.getByLabelText('Title'), ' v2')
    await user.click(scope.getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(inCard('Edit me v2').getByText('Overdue')).toBeVisible()
  })

  edge(2, 'clearing the due date removes it from the card', async () => {
    const { user } = await renderApp(dated())
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    const scope = within(form('Edit Edit me'))
    await user.clear(scope.getByLabelText('Due date'))
    await user.click(scope.getByRole('button', { name: 'Save' }))
    expect(within(card('Edit me')).queryByText(/^Due /)).not.toBeInTheDocument()
    expect(within(card('Edit me')).queryByText('Overdue')).not.toBeInTheDocument()
  })

  edge(3, 'an open edit form keeps its draft when another card moves (stable keys)', async () => {
    const { user } = await renderApp([
      makeTask({ id: 'b', title: 'Second' }),
      makeTask({ id: 'a', title: 'First' }),
    ])
    await user.click(screen.getByRole('button', { name: 'Edit First' }))
    await user.type(within(form('Edit First')).getByLabelText('Title'), ' draft')
    await user.click(screen.getByRole('button', { name: 'Move Second to Done' }))
    expect(within(form('Edit First')).getByLabelText('Title')).toHaveValue('First draft')
  })

  edge(3, 'two cards can be edited at once without sharing a draft', async () => {
    const { user } = await renderApp(dated())
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    await user.click(screen.getByRole('button', { name: 'Edit Other task' }))
    await user.type(within(form('Edit Edit me')).getByLabelText('Title'), ' A')
    await user.type(within(form('Edit Other task')).getByLabelText('Title'), ' B')
    expect(within(form('Edit Edit me')).getByLabelText('Title')).toHaveValue('Edit me A')
    expect(within(form('Edit Other task')).getByLabelText('Title')).toHaveValue('Other task B')
  })

  edge(2, 'while editing, the card hides its move and delete buttons', async () => {
    const { user } = await renderApp(dated())
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    expect(screen.queryByRole('button', { name: 'Delete Edit me' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Move Edit me to Done' })).not.toBeInTheDocument()
  })

  edge(2, 'reopening the editor after Cancel starts from the saved values again', async () => {
    const { user } = await renderApp(dated())
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    await user.type(within(form('Edit Edit me')).getByLabelText('Title'), ' junk')
    await user.click(within(form('Edit Edit me')).getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    expect(within(form('Edit Edit me')).getByLabelText('Title')).toHaveValue('Edit me')
  })
})
