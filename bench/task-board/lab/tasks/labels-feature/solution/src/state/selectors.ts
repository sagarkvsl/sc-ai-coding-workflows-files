import type { Priority, SortKey, Status, Task, TaskState } from '../types/task'
import { hasLabel } from '../utils/labels'

export function selectVisibleTasks(state: TaskState): Task[] {
  const query = state.filters.query.trim().toLowerCase()
  const { priority, label } = state.filters
  return state.tasks.filter((task) => {
    const matchesPriority = priority === 'all' || task.priority === priority
    const matchesLabel = label === '' || hasLabel(task.labels, label)
    const matchesQuery =
      query === '' ||
      task.title.toLowerCase().includes(query) ||
      task.description.toLowerCase().includes(query) ||
      task.labels.some((item) => item.toLowerCase().includes(query))
    return matchesPriority && matchesLabel && matchesQuery
  })
}

export function groupByStatus(tasks: Task[]): Record<Status, Task[]> {
  const groups: Record<Status, Task[]> = { todo: [], doing: [], done: [] }
  for (const task of tasks) {
    groups[task.status].push(task)
  }
  return groups
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

function compareTasks(sort: SortKey, a: Task, b: Task): number {
  switch (sort) {
    case 'created':
      if (a.createdAt === b.createdAt) return 0
      return a.createdAt < b.createdAt ? 1 : -1
    case 'due':
      if (a.dueDate === b.dueDate) return 0
      if (a.dueDate === null) return 1
      if (b.dueDate === null) return -1
      return a.dueDate < b.dueDate ? -1 : 1
    case 'priority':
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  }
}

export function sortTasks(tasks: Task[], sort: SortKey): Task[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => compareTasks(sort, a.task, b.task) || a.index - b.index)
    .map(({ task }) => task)
}

export function countDone(tasks: Task[]): number {
  return tasks.filter((task) => task.status === 'done').length
}

export function selectLabels(tasks: Task[]): string[] {
  const first = new Map<string, string>()
  for (const task of tasks) {
    for (const label of task.labels) {
      const key = label.toLowerCase()
      if (!first.has(key)) first.set(key, label)
    }
  }
  return [...first.keys()].sort().map((key) => first.get(key) ?? key)
}
