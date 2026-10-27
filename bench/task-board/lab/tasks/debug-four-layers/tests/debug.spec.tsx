import { screen, within } from '@testing-library/react'
import { describe, expect } from 'vitest'
import { makeTask } from '../../../../tests/support/fixtures'
import { addTask, column, form, renderApp, useFixedToday } from '../../../../tests/support/render'
import { loadSrc } from '../../../support/load'
import { lt } from '../../../support/tags'

useFixedToday()

const titlesIn = (name: string) => within(column(name)).queryAllByRole('heading', { level: 3 }).map((h) => h.textContent)

describe('four reported problems', () => {
  lt(4, 'a newly added task appears in To do and not in In progress', async () => {
    const { user } = await renderApp([makeTask({ id: 'x', title: 'Existing', status: 'doing' })])
    await addTask(user, { title: 'Fresh' })
    expect(titlesIn('To do')).toEqual(['Fresh'])
    expect(titlesIn('In progress')).toEqual(['Existing'])
  })

  lt(2, 'the header and column counts reflect the new task in To do', async () => {
    const { user } = await renderApp([])
    await addTask(user, { title: 'Counted' })
    expect(screen.getByRole('heading', { level: 2, name: 'To do 1' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'In progress 0' })).toBeVisible()
  })

  lt(4, 'the newest task is shown at the top of its column', async () => {
    const { user } = await renderApp([makeTask({ id: 'a', title: 'Older', createdAt: '2026-01-01T00:00:00.000Z' })])
    await addTask(user, { title: 'Newest' })
    expect(titlesIn('To do')).toEqual(['Newest', 'Older'])
  })

  lt(3, 'the reducer puts an added task first and keeps the rest in order', async () => {
    const { taskReducer, createInitialState } = await loadSrc('state/taskReducer')
    const state = createInitialState([makeTask({ id: 'a' }), makeTask({ id: 'b' })])
    const next = taskReducer(state, { type: 'task/added', task: makeTask({ id: 'n' }) })
    expect(next.tasks.map((t: { id: string }) => t.id)).toEqual(['n', 'a', 'b'])
  })

  lt(4, 'searching for a word that is only in a description finds the task', async () => {
    const { user } = await renderApp([
      makeTask({ id: 'a', title: 'Alpha', description: 'Contains the zebra word' }),
      makeTask({ id: 'b', title: 'Beta', description: 'nothing here' }),
    ])
    await user.type(screen.getByLabelText('Search tasks'), 'zebra')
    expect(titlesIn('To do')).toEqual(['Alpha'])
  })

  lt(2, 'searching still matches titles and ignores case', async () => {
    const { user } = await renderApp([makeTask({ id: 'a', title: 'Alpha' }), makeTask({ id: 'b', title: 'Beta' })])
    await user.type(screen.getByLabelText('Search tasks'), 'BET')
    expect(titlesIn('To do')).toEqual(['Beta'])
  })

  lt(2, 'selectVisibleTasks matches a description and a title separately', async () => {
    const { selectVisibleTasks } = await loadSrc('state/selectors')
    const { DEFAULT_FILTERS } = await loadSrc('types/task')
    const tasks = [makeTask({ id: 'a', title: 'ab', description: 'cd' })]
    expect(selectVisibleTasks({ tasks, filters: { ...DEFAULT_FILTERS, query: 'cd' } })).toHaveLength(1)
    expect(selectVisibleTasks({ tasks, filters: { ...DEFAULT_FILTERS, query: 'bc' } })).toHaveLength(0)
  })

  lt(4, 'after adding a task the Title field has focus again', async () => {
    const { user } = await renderApp([])
    await addTask(user, { title: 'One' })
    expect(within(form('Add task')).getByLabelText('Title')).toHaveFocus()
    expect(within(form('Add task')).getByLabelText('Title')).toHaveValue('')
  })

  lt(2, 'a failed submit does not clear what was typed', async () => {
    const { user } = await renderApp([])
    await addTask(user, { description: 'keep me' })
    expect(within(form('Add task')).getByLabelText('Description')).toHaveValue('keep me')
    expect(screen.getByText('Title is required.')).toBeVisible()
  })
})
