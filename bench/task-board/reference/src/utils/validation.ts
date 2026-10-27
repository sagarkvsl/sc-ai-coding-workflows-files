import { MAX_TITLE_LENGTH } from '../types/task'
import type { TaskDraft } from '../types/task'
import { isPastDate } from './date'

export interface TaskErrors {
  title?: string
  dueDate?: string
}

export const TITLE_REQUIRED = 'Title is required.'
export const TITLE_TOO_LONG = `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`
export const DUE_DATE_IN_PAST = 'Due date cannot be in the past.'

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
  return errors
}

export function hasErrors(errors: TaskErrors): boolean {
  return Object.values(errors).some((message) => message !== undefined)
}
