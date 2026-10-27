import { Profiler } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { loadApp, loadProvider } from './load'
import { TODAY } from './fixtures'

/** Freezes only `Date`, so timers and user-event keep working. */
export function useFixedToday() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TODAY)
  })
  afterEach(() => {
    vi.useRealTimers()
  })
}

export async function renderApp(tasks: unknown[] = []) {
  const { App } = await loadApp()
  const { TaskProvider } = await loadProvider()
  const user = userEvent.setup()
  const commits = { count: 0 }
  const view = render(
    <Profiler
      id="app"
      onRender={() => {
        commits.count += 1
      }}
    >
      <TaskProvider initialTasks={tasks}>
        <App />
      </TaskProvider>
    </Profiler>,
  )
  commits.count = 0
  return { user, commits, ...view }
}

export function column(name: string) {
  return screen.getByRole('region', { name })
}

export function card(title: string) {
  return screen.getByRole('article', { name: title })
}

export function inCard(title: string) {
  return within(card(title))
}

export function form(name: string) {
  return screen.getByRole('form', { name })
}

export async function addTask(
  user: ReturnType<typeof userEvent.setup>,
  fields: { title?: string; description?: string; priority?: string; dueDate?: string },
) {
  const addForm = form('Add task')
  const scope = within(addForm)
  if (fields.title !== undefined) await user.type(scope.getByLabelText('Title'), fields.title)
  if (fields.description !== undefined)
    await user.type(scope.getByLabelText('Description'), fields.description)
  if (fields.priority !== undefined)
    await user.selectOptions(scope.getByLabelText('Priority'), fields.priority)
  if (fields.dueDate !== undefined) await user.type(scope.getByLabelText('Due date'), fields.dueDate)
  await user.click(scope.getByRole('button', { name: 'Add task' }))
}
