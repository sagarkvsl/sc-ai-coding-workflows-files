import { groupByStatus, sortTasks } from '../../src/state/selectors'
import { STATUSES, STATUS_LABELS } from '../../src/types/task'
import type { Task } from '../../src/types/task'
import { formatDueDate, isOverdue, toIsoDate } from '../../src/utils/date'

function overdueLine(task: Task, today: Date): string | null {
  if (task.dueDate === null) return null
  if (!isOverdue(task, today)) return null
  return `- ${task.title} (${formatDueDate(task.dueDate)})`
}

export function buildReport(tasks: Task[], today: Date): string {
  const groups = groupByStatus(tasks)
  const counts = STATUSES.map(
    (status) => `${STATUS_LABELS[status]} ${groups[status].length}`,
  ).join(', ')
  const lines = [
    `Task Board report for ${toIsoDate(today)}`,
    `Total: ${tasks.length} (${counts})`,
  ]
  const overdue = sortTasks(tasks, { by: 'due' })
    .map((task) => overdueLine(task, today))
    .filter((line): line is string => line !== null)
  lines.push(`Overdue: ${overdue.length}`, ...overdue)
  const open = tasks.filter((task) => task.status !== 'done')
  const next = sortTasks(open, { by: 'priority' })[0]
  if (next !== undefined) lines.push(`Next up: ${next.title}`)
  return lines.join('\n')
}
