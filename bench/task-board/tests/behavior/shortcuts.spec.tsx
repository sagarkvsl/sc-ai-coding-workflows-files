import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, vi } from 'vitest'
import { makeTask } from '../support/fixtures'
import { form, renderApp, useFixedToday } from '../support/render'
import { edge, req, state } from '../support/tags'

useFixedToday()

afterEach(() => {
  vi.restoreAllMocks()
})

const title = () => within(form('Add task')).getByLabelText('Title')
const search = () => screen.getByLabelText('Search tasks')

describe('R-SHORTCUTS: keyboard shortcuts', () => {
  req(3, 'pressing n outside a field focuses the Title field of the add form', async () => {
    const { user } = await renderApp([])
    await user.keyboard('n')
    expect(title()).toHaveFocus()
  })

  req(3, 'the n key press is swallowed: no letter is typed into the Title field', async () => {
    const { user } = await renderApp([])
    await user.keyboard('n')
    expect(title()).toHaveValue('')
  })

  req(3, 'pressing / outside a field focuses the search box without typing a slash', async () => {
    const { user } = await renderApp([])
    await user.keyboard('/')
    expect(search()).toHaveFocus()
    expect(search()).toHaveValue('')
  })

  req(2, 'the two fields carry the ids add-task-title and filter-query', async () => {
    await renderApp([])
    expect(title()).toHaveAttribute('id', 'add-task-title')
    expect(search()).toHaveAttribute('id', 'filter-query')
  })

  edge(3, 'n and / type normally while a text field, a textarea or a select has focus', async () => {
    const { user } = await renderApp([])
    await user.click(within(form('Add task')).getByLabelText('Description'))
    await user.keyboard('n/')
    expect(within(form('Add task')).getByLabelText('Description')).toHaveValue('n/')
    await user.click(search())
    await user.keyboard('n')
    expect(search()).toHaveValue('n')
    expect(search()).toHaveFocus()
  })

  edge(3, 'a shortcut is ignored when Ctrl, Meta or Alt is held', async () => {
    const { user } = await renderApp([])
    await user.keyboard('{Control>}n{/Control}')
    await user.keyboard('{Meta>}/{/Meta}')
    await user.keyboard('{Alt>}n{/Alt}')
    expect(title()).not.toHaveFocus()
    expect(search()).not.toHaveFocus()
  })

  edge(2, 'the shortcut works while a card button has focus', async () => {
    const { user } = await renderApp([makeTask({ id: 'a', title: 'Solo' })])
    screen.getByRole('button', { name: 'Edit Solo' }).focus()
    await user.keyboard('/')
    expect(search()).toHaveFocus()
  })

  edge(2, 'typing n inside an open edit form types the letter', async () => {
    const { user } = await renderApp([makeTask({ id: 'a', title: 'Solo' })])
    await user.click(screen.getByRole('button', { name: 'Edit Solo' }))
    const field = within(screen.getByRole('form', { name: 'Edit Solo' })).getByLabelText('Title')
    await user.click(field)
    await user.keyboard('n')
    expect(field).toHaveValue('Solon')
    expect(field).toHaveFocus()
  })

  req(3, 'pressing Escape in the search box clears the search text', async () => {
    const { user } = await renderApp([makeTask({ id: 'a', title: 'Solo' }), makeTask({ id: 'b', title: 'Other' })])
    await user.type(search(), 'solo')
    expect(screen.getAllByRole('article')).toHaveLength(1)
    await user.keyboard('{Escape}')
    expect(search()).toHaveValue('')
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  edge(2, 'Escape in an empty search box does nothing and keeps the focus', async () => {
    const { user } = await renderApp([makeTask({ id: 'a' })])
    await user.click(search())
    await user.keyboard('{Escape}')
    expect(search()).toHaveValue('')
    expect(search()).toHaveFocus()
  })

  state(3, 'one keydown listener is registered and it is removed on unmount', async () => {
    const addDoc = vi.spyOn(document, 'addEventListener')
    const addWin = vi.spyOn(window, 'addEventListener')
    const removeDoc = vi.spyOn(document, 'removeEventListener')
    const removeWin = vi.spyOn(window, 'removeEventListener')
    const { unmount } = await renderApp([])
    const count = (spy: typeof addDoc) => spy.mock.calls.filter(([type]) => type === 'keydown').length
    const added = count(addDoc) + count(addWin)
    expect(added).toBeGreaterThanOrEqual(1)
    expect(added).toBeLessThanOrEqual(2)
    unmount()
    expect(count(removeDoc) + count(removeWin)).toBe(added)
  })

  state(3, 'the listener is not re-registered when the board changes', async () => {
    const addDoc = vi.spyOn(document, 'addEventListener')
    const addWin = vi.spyOn(window, 'addEventListener')
    const { user } = await renderApp([makeTask({ id: 'a', title: 'Solo' })])
    const count = () =>
      [...addDoc.mock.calls, ...addWin.mock.calls].filter(([type]) => type === 'keydown').length
    const before = count()
    await user.type(title(), 'abc')
    await user.click(screen.getByRole('button', { name: 'Move Solo to Done' }))
    await user.click(screen.getByRole('button', { name: 'Clear completed' }))
    expect(count()).toBe(before)
  })

  edge(2, 'after unmount a key press does not throw and focuses nothing', async () => {
    const { unmount } = await renderApp([])
    unmount()
    const press = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }))
    expect(press).not.toThrow()
    expect(document.activeElement).toBe(document.body)
  })
})
