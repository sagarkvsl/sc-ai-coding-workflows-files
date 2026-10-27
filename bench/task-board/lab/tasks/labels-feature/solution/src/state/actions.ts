import type { PriorityFilter, SortKey, Status, Task } from '../types/task'

export type TaskChanges = Partial<
  Pick<Task, 'title' | 'description' | 'priority' | 'dueDate'>
>

export type TaskAction =
  | { type: 'task/added'; task: Task }
  | { type: 'task/updated'; id: string; changes: TaskChanges }
  | { type: 'task/moved'; id: string; status: Status }
  | { type: 'task/deleted'; id: string }
  | { type: 'tasks/doneCleared' }
  | { type: 'filters/queryChanged'; query: string }
  | { type: 'filters/priorityChanged'; priority: PriorityFilter }
  | { type: 'filters/sortChanged'; sort: SortKey }
  | { type: 'filters/labelChanged'; label: string }
  | { type: 'filters/cleared' }
