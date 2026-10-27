import fs from 'node:fs'
import path from 'node:path'
import { screen, within } from '@testing-library/react'
import { describe, expect } from 'vitest'
import { makeTask as baseTask } from '../../../../tests/support/fixtures'
import { column, renderApp, useFixedToday } from '../../../../tests/support/render'
import { loadSrc, loadTool } from '../../../support/load'
import { lt } from '../../../support/tags'

useFixedToday()

// The shared fixture still defaults to the old status, so this task uses its own default.
const makeTask = (overrides: Record<string, unknown> = {}) => baseTask({ status: 'backlog', ...overrides })

const root = path.resolve(process.env.TASKBOARD_TARGET ?? '.')
function filesUnder(rel: string): string[] {
  const dir = path.join(root, rel)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(rel, e.name)
    return e.isDirectory() ? filesUnder(p) : [p]
  })
}
const textFiles = () => [...filesUnder('src'), ...filesUnder('tools'), 'README.md'].filter((f) => /\.(ts|tsx|css|md|html)$/.test(f) && fs.existsSync(path.join(root, f)))

describe('status migration', () => {
  lt(4, 'STATUSES and STATUS_LABELS use the new names in the same order', async () => {
    const { STATUSES, STATUS_LABELS } = await loadSrc('types/task')
    expect([...STATUSES]).toEqual(['backlog', 'review', 'done'])
    expect(STATUS_LABELS).toEqual({ backlog: 'Backlog', review: 'In review', done: 'Done' })
  })

  lt(3, 'groupByStatus returns the three new keys', async () => {
    const { groupByStatus } = await loadSrc('state/selectors')
    expect(groupByStatus([])).toEqual({ backlog: [], review: [], done: [] })
    const groups = groupByStatus([makeTask({ id: 'a', status: 'review' }), makeTask({ id: 'b', status: 'backlog' })])
    expect(groups.review.map((t: { id: string }) => t.id)).toEqual(['a'])
  })

  lt(3, 'the reducer moves a task to review and clears only done tasks', async () => {
    const { taskReducer, createInitialState } = await loadSrc('state/taskReducer')
    const state = createInitialState([makeTask({ id: 'a', status: 'backlog' }), makeTask({ id: 'b', status: 'done' }), makeTask({ id: 'c', status: 'review' })])
    expect(taskReducer(state, { type: 'task/moved', id: 'a', status: 'review' }).tasks[0].status).toBe('review')
    expect(taskReducer(state, { type: 'task/moved', id: 'c', status: 'review' })).toBe(state)
    expect(taskReducer(state, { type: 'tasks/doneCleared' }).tasks.map((t: { id: string }) => t.id)).toEqual(['a', 'c'])
  })

  lt(2, 'isOverdue works for the new statuses and not for done', async () => {
    const { isOverdue } = await loadSrc('utils/date')
    const today = new Date(2026, 5, 15, 12)
    expect(isOverdue('2026-06-01', 'backlog', today)).toBe(true)
    expect(isOverdue('2026-06-01', 'review', today)).toBe(true)
    expect(isOverdue('2026-06-01', 'done', today)).toBe(false)
  })

  lt(4, 'the three columns are named Backlog, In review and Done with counts', async () => {
    await renderApp([makeTask({ id: 'a', title: 'A' }), makeTask({ id: 'b', title: 'B', status: 'review' })])
    expect(screen.getByRole('heading', { level: 2, name: 'Backlog 1' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'In review 1' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Done 0' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'To do' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'In progress' })).not.toBeInTheDocument()
  })

  lt(4, 'move buttons use the new labels and move the card', async () => {
    const { user } = await renderApp([makeTask({ id: 'a', title: 'Write docs' })])
    expect(screen.getByRole('button', { name: 'Move Write docs to In review' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Move Write docs to Done' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /to Backlog/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Move Write docs to In review' }))
    expect(within(column('In review')).getByRole('heading', { level: 3, name: 'Write docs' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Move Write docs to Backlog' })).toBeVisible()
  })

  lt(3, 'a task added through the form lands in Backlog', async () => {
    const { user } = await renderApp([])
    await user.type(screen.getByLabelText('Title'), 'Fresh')
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    expect(within(column('Backlog')).getByRole('heading', { level: 3, name: 'Fresh' })).toBeVisible()
  })

  lt(3, 'the empty column text is unchanged', async () => {
    await renderApp([makeTask({ id: 'a' })])
    expect(within(column('In review')).getByText('No tasks here.')).toBeVisible()
  })

  lt(5, 'the report tool prints the new column names', async () => {
    const { buildReport } = await loadTool('report/report')
    const report = buildReport([makeTask({ id: '1' }), makeTask({ id: '2', status: 'review' }), makeTask({ id: '3', status: 'done' })], new Date(2026, 5, 15, 12))
    expect(report).toContain('Total: 3 (Backlog 1, In review 1, Done 1)')
  })

  lt(8, 'no old status word is left in src, tools or the README', async () => {
    const leftovers: string[] = []
    for (const f of textFiles()) {
      const lines = fs.readFileSync(path.join(root, f), 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (/\b(todo|doing)\b|\bTo do\b|\bIn progress\b/i.test(line)) leftovers.push(`${f}:${i + 1}`)
      })
    }
    expect(leftovers).toEqual([])
  })

  lt(4, 'the existing tests were migrated rather than deleted', async () => {
    const tests = textFiles().filter((f) => /\.test\.tsx?$/.test(f))
    expect(tests.length).toBeGreaterThanOrEqual(9)
    const text = tests.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n')
    expect(text).toMatch(/'review'/)
    expect(text).toMatch(/'backlog'/)
  })
})
