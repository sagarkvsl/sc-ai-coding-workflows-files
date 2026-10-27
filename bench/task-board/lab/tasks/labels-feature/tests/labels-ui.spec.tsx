import { screen, within } from '@testing-library/react'
import { describe, expect } from 'vitest'
import { makeTask } from '../../../../tests/support/fixtures'
import { addTask, card, column, form, inCard, renderApp, useFixedToday } from '../../../../tests/support/render'
import { lt } from '../../../support/tags'

useFixedToday()

const addForm = () => within(form('Add task'))
const labelsOf = (title: string) => within(inCard(title).getByRole('list', { name: 'Labels' })).getAllByRole('listitem').map((li) => li.textContent)
const filterLabel = () => screen.getByLabelText('Filter by label')
const titlesIn = (name: string) => within(column(name)).queryAllByRole('heading', { level: 3 }).map((h) => h.textContent)

async function addWithLabels(user: Awaited<ReturnType<typeof renderApp>>['user'], title: string, labels: string) {
  await user.type(addForm().getByLabelText('Title'), title)
  await user.type(addForm().getByLabelText('Labels'), labels)
  await user.click(addForm().getByRole('button', { name: 'Add task' }))
}

describe('labels in the add form and on the card', () => {
  lt(3, 'the add form has a Labels input between Description and Priority', async () => {
    await renderApp([])
    const names = within(form('Add task')).getAllByRole('textbox', {}).map((e) => e.getAttribute('id'))
    expect(addForm().getByLabelText('Labels')).toBeVisible()
    const all = Array.from(form('Add task').querySelectorAll('input, textarea, select')).map((el) => el.id)
    const idx = (label: string) => all.indexOf(addForm().getByLabelText(label).id)
    expect(idx('Description')).toBeLessThan(idx('Labels'))
    expect(idx('Labels')).toBeLessThan(idx('Priority'))
    expect(names.length).toBeGreaterThan(0)
  })

  lt(5, 'a task added with labels shows them parsed, trimmed and de-duplicated on its card', async () => {
    const { user } = await renderApp([])
    await addWithLabels(user, 'Labelled', ' Bug, ui ,bug,, UI ')
    expect(labelsOf('Labelled')).toEqual(['Bug', 'ui'])
  })

  lt(2, 'the Labels input is cleared after a successful add', async () => {
    const { user } = await renderApp([])
    await addWithLabels(user, 'One', 'x')
    expect(addForm().getByLabelText('Labels')).toHaveValue('')
  })

  lt(3, 'a card without labels has no Labels list', async () => {
    await renderApp([makeTask({ id: 'a', title: 'Plain' })])
    expect(within(card('Plain')).queryByRole('list', { name: 'Labels' })).not.toBeInTheDocument()
  })

  lt(5, 'more than 5 labels shows an alert tied to the field and blocks the add', async () => {
    const { user } = await renderApp([])
    await addWithLabels(user, 'Too many', 'a,b,c,d,e,f')
    const alert = screen.getByText('Use at most 5 labels.')
    expect(alert).toHaveAttribute('role', 'alert')
    expect(addForm().getByLabelText('Labels')).toHaveAttribute('aria-invalid', 'true')
    expect(addForm().getByLabelText('Labels')).toHaveAccessibleDescription('Use at most 5 labels.')
    expect(screen.queryByRole('article', { name: 'Too many' })).not.toBeInTheDocument()
  })

  lt(3, 'exactly 5 labels and a 20 character label are accepted', async () => {
    const { user } = await renderApp([])
    await addWithLabels(user, 'Edge', 'a,b,c,d,12345678901234567890')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(labelsOf('Edge')).toHaveLength(5)
  })

  lt(4, 'a label of 21 characters shows its own message, and too many wins when both apply', async () => {
    const { user } = await renderApp([])
    await addWithLabels(user, 'Long', '123456789012345678901')
    expect(screen.getByText('Each label must be 20 characters or fewer.')).toBeVisible()
    await user.clear(addForm().getByLabelText('Labels'))
    await user.type(addForm().getByLabelText('Labels'), '123456789012345678901,b,c,d,e,f')
    await user.click(addForm().getByRole('button', { name: 'Add task' }))
    expect(screen.getByText('Use at most 5 labels.')).toBeVisible()
    expect(screen.queryByText('Each label must be 20 characters or fewer.')).not.toBeInTheDocument()
  })

  lt(3, 'the labels error disappears when the Labels field changes', async () => {
    const { user } = await renderApp([])
    await addWithLabels(user, 'Err', 'a,b,c,d,e,f')
    await user.type(addForm().getByLabelText('Labels'), 'g')
    expect(screen.queryByText('Use at most 5 labels.')).not.toBeInTheDocument()
  })
})

describe('labels in the edit form', () => {
  lt(4, 'the edit form is pre-filled with the labels joined by a comma and a space', async () => {
    const { user } = await renderApp([makeTask({ id: 'a', title: 'Edit me', labels: ['bug', 'ui'] })])
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    expect(within(form('Edit Edit me')).getByLabelText('Labels')).toHaveValue('bug, ui')
  })

  lt(4, 'saving edited labels updates the card', async () => {
    const { user } = await renderApp([makeTask({ id: 'a', title: 'Edit me', labels: ['bug'] })])
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    const field = within(form('Edit Edit me')).getByLabelText('Labels')
    await user.clear(field)
    await user.type(field, 'api, Api, docs')
    await user.click(within(form('Edit Edit me')).getByRole('button', { name: 'Save' }))
    expect(labelsOf('Edit me')).toEqual(['api', 'docs'])
  })

  lt(3, 'the edit form rejects too many labels and keeps the form open', async () => {
    const { user } = await renderApp([makeTask({ id: 'a', title: 'Edit me' })])
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    await user.type(within(form('Edit Edit me')).getByLabelText('Labels'), 'a,b,c,d,e,f')
    await user.click(within(form('Edit Edit me')).getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Use at most 5 labels.')).toBeVisible()
    expect(form('Edit Edit me')).toBeVisible()
  })

  lt(2, 'saving a task with all labels removed clears its list', async () => {
    const { user } = await renderApp([makeTask({ id: 'a', title: 'Edit me', labels: ['bug'] })])
    await user.click(screen.getByRole('button', { name: 'Edit Edit me' }))
    await user.clear(within(form('Edit Edit me')).getByLabelText('Labels'))
    await user.click(within(form('Edit Edit me')).getByRole('button', { name: 'Save' }))
    expect(within(card('Edit me')).queryByRole('list', { name: 'Labels' })).not.toBeInTheDocument()
  })
})

describe('the label filter', () => {
  const board = () => [
    makeTask({ id: 'a', title: 'Alpha', labels: ['Bug', 'ui'] }),
    makeTask({ id: 'b', title: 'Beta', labels: ['bug'] }),
    makeTask({ id: 'c', title: 'Gamma', labels: ['api'] }),
    makeTask({ id: 'd', title: 'Delta' }),
  ]

  lt(4, 'the Filter by label select lists All labels then each label, sorted', async () => {
    await renderApp(board())
    const options = within(filterLabel()).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['All labels', 'api', 'Bug', 'ui'])
    expect(filterLabel()).toHaveValue('')
  })

  lt(5, 'choosing a label shows only tasks with it and keeps the counts honest', async () => {
    const { user } = await renderApp(board())
    await user.selectOptions(filterLabel(), 'Bug')
    expect(titlesIn('To do')).toEqual(['Alpha', 'Beta'])
    expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 4 tasks')
    expect(within(filterLabel()).getAllByRole('option')).toHaveLength(4)
  })

  lt(3, 'the search box also finds a task by its label', async () => {
    const { user } = await renderApp(board())
    await user.type(screen.getByLabelText('Search tasks'), 'api')
    expect(titlesIn('To do')).toEqual(['Gamma'])
  })

  lt(4, 'Clear filters is enabled by a label and resets it, but not by the sort alone', async () => {
    const { user } = await renderApp(board())
    const clear = screen.getByRole('button', { name: 'Clear filters' })
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Priority')
    expect(clear).toBeDisabled()
    await user.selectOptions(filterLabel(), 'api')
    expect(clear).toBeEnabled()
    await user.click(clear)
    expect(filterLabel()).toHaveValue('')
    expect(screen.getByLabelText('Sort by')).toHaveValue('priority')
    expect(titlesIn('To do')).toHaveLength(4)
  })

  lt(5, 'deleting the last task with the chosen label resets the filter to All labels', async () => {
    const { user } = await renderApp(board())
    await user.selectOptions(filterLabel(), 'api')
    expect(titlesIn('To do')).toEqual(['Gamma'])
    await user.click(screen.getByRole('button', { name: 'Delete Gamma' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete Gamma' }))
    expect(filterLabel()).toHaveValue('')
    expect(titlesIn('To do')).toEqual(['Alpha', 'Beta', 'Delta'])
    expect(within(filterLabel()).queryByRole('option', { name: 'api' })).not.toBeInTheDocument()
  })

  lt(4, 'removing the chosen label by editing resets the filter and the option list', async () => {
    const { user } = await renderApp(board())
    await user.selectOptions(filterLabel(), 'api')
    await user.click(screen.getByRole('button', { name: 'Edit Gamma' }))
    const field = within(form('Edit Gamma')).getByLabelText('Labels')
    await user.clear(field)
    await user.click(within(form('Edit Gamma')).getByRole('button', { name: 'Save' }))
    expect(filterLabel()).toHaveValue('')
    expect(screen.queryByRole('option', { name: 'api' })).not.toBeInTheDocument()
  })

  lt(3, 'a new label typed in the add form shows up as a filter option', async () => {
    const { user } = await renderApp(board())
    await addWithLabels(user, 'Fresh', 'zzz')
    expect(within(filterLabel()).getByRole('option', { name: 'zzz' })).toBeVisible()
    await addTask(user, { title: 'No labels here' })
    expect(within(filterLabel()).getAllByRole('option')).toHaveLength(5)
  })

  lt(3, 'the label filter does not change which labels the select offers', async () => {
    const { user } = await renderApp(board())
    await user.type(screen.getByLabelText('Search tasks'), 'Delta')
    expect(within(filterLabel()).getAllByRole('option').map((o) => o.textContent)).toEqual(['All labels', 'api', 'Bug', 'ui'])
  })
})
