// Render-efficiency checks. They catch state that "looks right" but misbehaves:
// derived data copied into state and synced in an effect, form state lifted
// too high, or lists keyed by index.
import { screen, within } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import { makeTask, seedTasks } from '../support/fixtures'
import { form, renderApp, useFixedToday } from '../support/render'
import { state } from '../support/tags'

const cardRenders = vi.hoisted(() => ({ byId: new Map<string, number>(), total: 0 }))

vi.mock('@target/components/TaskCard', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  const { createElement } = await import('react')
  const Real = original.TaskCard as React.ComponentType<{ task: { id: string } }>
  function Counted(props: { task: { id: string } }) {
    cardRenders.total += 1
    cardRenders.byId.set(props.task.id, (cardRenders.byId.get(props.task.id) ?? 0) + 1)
    return createElement(Real, props)
  }
  return { ...original, TaskCard: Counted }
})

useFixedToday()

function resetCounts() {
  cardRenders.byId.clear()
  cardRenders.total = 0
}

const maxPerCard = () => Math.max(0, ...cardRenders.byId.values())

function manyTasks(n: number) {
  return Array.from({ length: n }, (_, i) => makeTask({ id: `m${i}`, title: `Task number ${i}` }))
}

describe('R-RENDER: state design and render efficiency', () => {
  state(3, 'mounting renders every card exactly once (no effect-driven second pass)', async () => {
    resetCounts()
    await renderApp(manyTasks(10))
    expect(cardRenders.total).toBe(10)
  })

  state(4, 'typing in the add form does not re-render any card (form state stays local)', async () => {
    const { user } = await renderApp(manyTasks(6))
    resetCounts()
    await user.type(within(form('Add task')).getByLabelText('Title'), 'twelve chars')
    expect(cardRenders.total).toBe(0)
  })

  state(3, 'typing in the add form commits at most once per keystroke', async () => {
    const { user, commits } = await renderApp(manyTasks(3))
    await user.type(within(form('Add task')).getByLabelText('Description'), 'abcdefghij')
    expect(commits.count).toBeLessThanOrEqual(10)
  })

  state(4, 'each keystroke in the search box commits once and renders each card at most once', async () => {
    const { user, commits } = await renderApp(manyTasks(8))
    resetCounts()
    await user.type(screen.getByLabelText('Search tasks'), 'task')
    expect(commits.count).toBeLessThanOrEqual(4)
    expect(maxPerCard()).toBeLessThanOrEqual(4)
  })

  state(3, 'changing the priority filter is a single commit', async () => {
    const { user, commits } = await renderApp(seedTasks())
    await user.selectOptions(screen.getByLabelText('Filter by priority'), 'High')
    expect(commits.count).toBeLessThanOrEqual(1)
  })

  state(3, 'moving a card is a single commit and re-renders each card at most once', async () => {
    const { user, commits } = await renderApp(manyTasks(5))
    resetCounts()
    await user.click(screen.getByRole('button', { name: 'Move Task number 2 to Done' }))
    expect(commits.count).toBeLessThanOrEqual(1)
    expect(maxPerCard()).toBeLessThanOrEqual(1)
  })

  state(3, 'adding a task is a single commit and re-renders each existing card at most once', async () => {
    const { user, commits } = await renderApp(manyTasks(5))
    const scope = within(form('Add task'))
    await user.type(scope.getByLabelText('Title'), 'New one')
    resetCounts()
    commits.count = 0
    await user.click(scope.getByRole('button', { name: 'Add task' }))
    expect(commits.count).toBeLessThanOrEqual(1)
    expect(maxPerCard()).toBeLessThanOrEqual(1)
  })

  state(3, 'deleting with confirmation takes one commit per click', async () => {
    const { user, commits } = await renderApp(manyTasks(4))
    await user.click(screen.getByRole('button', { name: 'Delete Task number 1' }))
    expect(commits.count).toBeLessThanOrEqual(1)
    commits.count = 0
    await user.click(screen.getByRole('button', { name: 'Confirm delete Task number 1' }))
    expect(commits.count).toBeLessThanOrEqual(1)
  })

  state(3, 'opening, typing in and saving an edit form never needs a second commit per action', async () => {
    const { user, commits } = await renderApp(manyTasks(4))
    await user.click(screen.getByRole('button', { name: 'Edit Task number 0' }))
    expect(commits.count).toBeLessThanOrEqual(1)
    commits.count = 0
    const scope = within(form('Edit Task number 0'))
    await user.type(scope.getByLabelText('Title'), 'abc')
    expect(commits.count).toBeLessThanOrEqual(3)
    commits.count = 0
    await user.click(scope.getByRole('button', { name: 'Save' }))
    expect(commits.count).toBeLessThanOrEqual(1)
  })

  state(3, 'typing in one edit form does not re-render the cards', async () => {
    const { user } = await renderApp(manyTasks(5))
    await user.click(screen.getByRole('button', { name: 'Edit Task number 0' }))
    resetCounts()
    await user.type(within(form('Edit Task number 0')).getByLabelText('Title'), 'xyz')
    expect(cardRenders.total).toBe(0)
  })

  state(3, 'a burst of 40 tasks and 6 actions keeps total card renders bounded', async () => {
    const { user } = await renderApp(manyTasks(40))
    resetCounts()
    const search = screen.getByLabelText('Search tasks')
    await user.type(search, 'N')
    await user.clear(search)
    await user.selectOptions(screen.getByLabelText('Filter by priority'), 'High')
    await user.selectOptions(screen.getByLabelText('Filter by priority'), 'All priorities')
    await user.click(screen.getByRole('button', { name: 'Move Task number 0 to Done' }))
    expect(cardRenders.total).toBeLessThanOrEqual(40 * 6)
  })
})
