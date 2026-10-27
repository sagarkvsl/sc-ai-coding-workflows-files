import { useState } from 'react'
import type { TaskDraft } from '../types/task'
import type { TaskErrors } from '../utils/validation'

export interface UseTaskDraftResult {
  draft: TaskDraft
  errors: TaskErrors
  setErrors: (errors: TaskErrors) => void
  changeField: <K extends keyof TaskDraft>(field: K, value: TaskDraft[K]) => void
  reset: (next: TaskDraft) => void
}

export function useTaskDraft(initial: TaskDraft): UseTaskDraftResult {
  const [draft, setDraft] = useState<TaskDraft>(initial)
  const [errors, setErrors] = useState<TaskErrors>({})

  function changeField<K extends keyof TaskDraft>(
    field: K,
    value: TaskDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) =>
      field in current ? { ...current, [field]: undefined } : current,
    )
  }

  function reset(next: TaskDraft) {
    setDraft(next)
    setErrors({})
  }

  return { draft, errors, setErrors, changeField, reset }
}
