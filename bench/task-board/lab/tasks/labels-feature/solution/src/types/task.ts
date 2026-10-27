export const STATUSES = ['todo', 'doing', 'done'] as const
export const PRIORITIES = ['low', 'medium', 'high'] as const
export const SORT_KEYS = ['created', 'due', 'priority'] as const
export const MAX_TITLE_LENGTH = 80
export const MAX_LABELS = 5
export const MAX_LABEL_LENGTH = 20

export type Status = (typeof STATUSES)[number]
export type Priority = (typeof PRIORITIES)[number]
export type PriorityFilter = Priority | 'all'
export type SortKey = (typeof SORT_KEYS)[number]

export const STATUS_LABELS: Record<Status, string> = {
  todo: 'To do',
  doing: 'In progress',
  done: 'Done',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const SORT_LABELS: Record<SortKey, string> = {
  created: 'Newest first',
  due: 'Due date',
  priority: 'Priority',
}

export interface Task {
  id: string
  title: string
  description: string
  priority: Priority
  status: Status
  dueDate: string | null
  labels: string[]
  createdAt: string
}

export interface TaskInput {
  title: string
  description: string
  priority: Priority
  dueDate: string | null
  labels: string[]
}

export interface TaskDraft {
  title: string
  description: string
  priority: Priority
  dueDate: string
  labels: string
}

export interface Filters {
  query: string
  priority: PriorityFilter
  sort: SortKey
  label: string
}

export interface TaskState {
  tasks: Task[]
  filters: Filters
}

export const DEFAULT_FILTERS: Filters = {
  query: '',
  priority: 'all',
  sort: 'created',
  label: '',
}
