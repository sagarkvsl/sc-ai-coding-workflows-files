import type { Task, TaskDraft, TaskInput } from '../types/task'
import { labelsToText, parseLabels } from './labels'

export const EMPTY_DRAFT: TaskDraft = {
  title: '',
  description: '',
  priority: 'medium',
  dueDate: '',
  labels: '',
}

export function toDraft(task: Task): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDate: task.dueDate ?? '',
    labels: labelsToText(task.labels),
  }
}

export function toTaskInput(draft: TaskDraft): TaskInput {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    priority: draft.priority,
    dueDate: draft.dueDate === '' ? null : draft.dueDate,
    labels: parseLabels(draft.labels),
  }
}
