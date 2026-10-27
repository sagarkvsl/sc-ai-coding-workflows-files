import { screen, within } from '@testing-library/react'
import { describe, expect } from 'vitest'
import { addTask, column, form, renderApp, useFixedToday } from '../support/render'
import { edge, req } from '../support/tags'

useFixedToday()

const fields = () => within(form('Add task'))

describe('R-FORM: add task form', () => {
  req(3, 'has labelled Title, Description, Priority and Due date fields and an "Add task" button', async () => {
    await renderApp()
    expect(fields().getByLabelText('Title')).toHaveAttribute('type', 'text')
    expect(fields().getByLabelText('Description').tagName).toBe('TEXTAREA')
    expect(fields().getByLabelText('Priority').tagName).toBe('SELECT')
    expect(fields().getByLabelText('Due date')).toHaveAttribute('type', 'date')
    expect(fields().getByRole('button', { name: 'Add task' })).toHaveAttribute('type', 'submit')
  })

  req(2, 'Priority offers Low, Medium and High and starts on Medium', async () => {
    await renderApp()
    const options = within(fields().getByLabelText('Priority')).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Low', 'Medium', 'High'])
    expect(fields().getByLabelText('Priority')).toHaveValue('medium')
  })

  req(4, 'a valid submit adds a card with every entered value to the To do column', async () => {
    const { user } = await renderApp()
    await addTask(user, { title: 'Buy milk', description: 'Two litres', priority: 'High', dueDate: '2026-06-20' })
    const card = within(column('To do')).getByRole('article', { name: 'Buy milk' })
    expect(within(card).getByText('Two litres')).toBeVisible()
    expect(within(card).getByText('High priority')).toBeVisible()
    expect(within(card).getByText('Due 20 Jun 2026')).toBeVisible()
  })

  req(3, 'new tasks appear at the top of the column', async () => {
    const { user } = await renderApp()
    await addTask(user, { title: 'First one' })
    await addTask(user, { title: 'Second one' })
    const titles = within(column('To do'))
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(titles).toEqual(['Second one', 'First one'])
  })

  req(3, 'title and description are trimmed before saving', async () => {
    const { user } = await renderApp()
    await addTask(user, { title: '   Padded   ', description: '  note  ' })
    const card = screen.getByRole('article', { name: 'Padded' })
    expect(within(card).getByText('note')).toBeVisible()
  })

  req(3, 'the form is reset after a successful add, including the Medium default', async () => {
    const { user } = await renderApp()
    await addTask(user, { title: 'Water plants', description: 'Balcony', priority: 'High', dueDate: '2026-06-30' })
    expect(fields().getByLabelText('Title')).toHaveValue('')
    expect(fields().getByLabelText('Description')).toHaveValue('')
    expect(fields().getByLabelText('Priority')).toHaveValue('medium')
    expect(fields().getByLabelText('Due date')).toHaveValue('')
  })

  req(2, 'focus returns to the Title field after a successful add', async () => {
    const { user } = await renderApp()
    await addTask(user, { title: 'Focus me' })
    expect(fields().getByLabelText('Title')).toHaveFocus()
  })

  req(3, 'an empty title shows "Title is required." and adds nothing', async () => {
    const { user } = await renderApp()
    await user.click(fields().getByRole('button', { name: 'Add task' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Title is required.')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  req(3, 'a title longer than 80 characters is rejected with the exact message', async () => {
    const { user } = await renderApp()
    await addTask(user, { title: 'x'.repeat(81) })
    expect(screen.getByRole('alert')).toHaveTextContent('Title must be 80 characters or fewer.')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  req(3, 'a due date before today is rejected with the exact message', async () => {
    const { user } = await renderApp()
    await addTask(user, { title: 'Late', dueDate: '2026-06-14' })
    expect(screen.getByRole('alert')).toHaveTextContent('Due date cannot be in the past.')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  req(2, 'no error is shown before the first submit', async () => {
    const { user } = await renderApp()
    await user.type(fields().getByLabelText('Title'), 'abc')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  req(2, 'adding a task updates the header summary and the column count', async () => {
    const { user } = await renderApp()
    expect(screen.getByRole('status')).toHaveTextContent('Showing 0 of 0 tasks')
    await addTask(user, { title: 'One' })
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 1 task')
    expect(within(column('To do')).getByRole('heading', { level: 2 })).toHaveTextContent('To do 1')
  })

  edge(3, 'a whitespace-only title is treated as empty', async () => {
    const { user } = await renderApp()
    await addTask(user, { title: '     ' })
    expect(screen.getByRole('alert')).toHaveTextContent('Title is required.')
  })

  edge(3, 'a title of exactly 80 characters is accepted (spaces around it are ignored)', async () => {
    const { user } = await renderApp()
    const title = 'y'.repeat(80)
    await addTask(user, { title: `  ${title}  ` })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('article', { name: title })).toBeVisible()
  })

  edge(3, 'a due date of today is accepted', async () => {
    const { user } = await renderApp()
    await addTask(user, { title: 'Today', dueDate: '2026-06-15' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Due 15 Jun 2026')).toBeVisible()
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
  })

  edge(2, 'leaving the due date empty shows no due date on the card', async () => {
    const { user } = await renderApp()
    await addTask(user, { title: 'No date' })
    expect(within(screen.getByRole('article', { name: 'No date' })).queryByText(/^Due /)).not.toBeInTheDocument()
  })

  edge(3, 'title and due date errors can show together', async () => {
    const { user } = await renderApp()
    await addTask(user, { dueDate: '2026-06-01' })
    const alerts = screen.getAllByRole('alert').map((a) => a.textContent)
    expect(alerts).toEqual(
      expect.arrayContaining(['Title is required.', 'Due date cannot be in the past.']),
    )
    expect(alerts).toHaveLength(2)
  })

  edge(3, 'the invalid field is flagged and described by its error', async () => {
    const { user } = await renderApp()
    await user.click(fields().getByRole('button', { name: 'Add task' }))
    const title = fields().getByLabelText('Title')
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(title).toHaveAccessibleDescription('Title is required.')
    expect(fields().getByLabelText('Due date')).not.toHaveAttribute('aria-invalid', 'true')
  })

  edge(3, 'an error clears when its own field changes, others stay', async () => {
    const { user } = await renderApp()
    await addTask(user, { dueDate: '2026-06-01' })
    await user.type(fields().getByLabelText('Description'), 'hello')
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    await user.type(fields().getByLabelText('Title'), 'x')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent('Due date cannot be in the past.')
  })

  edge(2, 'a failed submit keeps what the user typed', async () => {
    const { user } = await renderApp()
    await addTask(user, { description: 'keep me', priority: 'Low' })
    expect(fields().getByLabelText('Description')).toHaveValue('keep me')
    expect(fields().getByLabelText('Priority')).toHaveValue('low')
  })

  edge(2, 'a later successful submit clears every old error', async () => {
    const { user } = await renderApp()
    await user.click(fields().getByRole('button', { name: 'Add task' }))
    await user.type(fields().getByLabelText('Title'), 'Fixed{Enter}')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Fixed' })).toBeVisible()
  })

  edge(2, 'pressing Enter in the Title field submits the form', async () => {
    const { user } = await renderApp()
    await user.type(fields().getByLabelText('Title'), 'Enter task{Enter}')
    expect(screen.getByRole('article', { name: 'Enter task' })).toBeVisible()
  })
})
