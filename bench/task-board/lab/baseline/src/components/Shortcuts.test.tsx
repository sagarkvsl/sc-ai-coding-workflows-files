import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { TaskProvider } from '../state/TaskContext'

function renderApp() {
  const view = render(
    <TaskProvider initialTasks={[]}>
      <App />
    </TaskProvider>,
  )
  return { user: userEvent.setup(), ...view }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('keyboard shortcuts', () => {
  it('keyboard shortcut n focuses the title field when pressed outside a field', async () => {
    const { user } = renderApp()
    await user.keyboard('n')
    expect(screen.getByLabelText('Title')).toHaveFocus()
    expect(screen.getByLabelText('Title')).toHaveValue('')
  })

  it('keyboard shortcut slash focuses the search box when pressed outside a field', async () => {
    const { user } = renderApp()
    await user.keyboard('/')
    expect(screen.getByLabelText('Search tasks')).toHaveFocus()
    expect(screen.getByLabelText('Search tasks')).toHaveValue('')
  })

  it('shortcut keys type normally while a field has focus', async () => {
    const { user } = renderApp()
    await user.click(screen.getByLabelText('Description'))
    await user.keyboard('n/')
    expect(screen.getByLabelText('Description')).toHaveValue('n/')
    expect(screen.getByLabelText('Description')).toHaveFocus()
  })

  it('ignores the shortcut when a modifier key is held down', async () => {
    const { user } = renderApp()
    await user.keyboard('{Control>}n{/Control}')
    expect(screen.getByLabelText('Title')).not.toHaveFocus()
  })

  it('clears the search text when Escape is pressed in the search box', async () => {
    const { user } = renderApp()
    await user.type(screen.getByLabelText('Search tasks'), 'abc')
    await user.keyboard('{Escape}')
    expect(screen.getByLabelText('Search tasks')).toHaveValue('')
  })

  it('adds one keydown listener and removes it on unmount', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    const { user, unmount } = renderApp()
    await user.type(screen.getByLabelText('Title'), 'abc')
    const added = add.mock.calls.filter(([type]) => type === 'keydown').length
    unmount()
    const removed = remove.mock.calls.filter(([type]) => type === 'keydown').length
    expect(added).toBe(1)
    expect(removed).toBe(1)
  })
})
