import { MAX_LABELS, MAX_LABEL_LENGTH, MAX_TITLE_LENGTH } from '../types/task'
import type { TaskDraft } from '../types/task'
import { isPastDate } from './date'
import { parseLabels } from './labels'

export interface TaskErrors {
  title?: string
  dueDate?: string
  labels?: string
}

export const TITLE_REQUIRED = 'Title is required.'
export const TITLE_TOO_LONG = `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`
export const DUE_DATE_IN_PAST = 'Due date cannot be in the past.'
export const TOO_MANY_LABELS = `Use at most ${MAX_LABELS} labels.`
export const LABEL_TOO_LONG = `Each label must be ${MAX_LABEL_LENGTH} characters or fewer.`

function validateLabels(text: string): string | undefined {
  const labels = parseLabels(text)
  if (labels.length > MAX_LABELS) return TOO_MANY_LABELS
  if (labels.some((label) => label.length > MAX_LABEL_LENGTH)) return LABEL_TOO_LONG
  return undefined
}

export function validateDraft(
  draft: TaskDraft,
  today: Date,
  checkDueDate: boolean,
): TaskErrors {
  const errors: TaskErrors = {}
  const title = draft.title.trim()
  if (title === '') {
    errors.title = TITLE_REQUIRED
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.title = TITLE_TOO_LONG
  }
  if (checkDueDate && isPastDate(draft.dueDate, today)) {
    errors.dueDate = DUE_DATE_IN_PAST
  }
  const labels = validateLabels(draft.labels)
  if (labels !== undefined) errors.labels = labels
  return errors
}

export function hasErrors(errors: TaskErrors): boolean {
  return Object.values(errors).some((message) => message !== undefined)
}
