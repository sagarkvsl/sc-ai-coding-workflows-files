import { useRef } from 'react'
import type { FormEvent } from 'react'
import { useTaskDraft } from '../hooks/useTaskDraft'
import { useTasks } from '../hooks/useTasks'
import { EMPTY_DRAFT, toTaskInput } from '../utils/draft'
import { TITLE_FIELD_ID } from '../utils/fieldIds'
import { hasErrors, validateDraft } from '../utils/validation'
import { TaskFields } from './TaskFields'

export function TaskForm() {
  const { addTask } = useTasks()
  const { draft, errors, setErrors, changeField, reset } =
    useTaskDraft(EMPTY_DRAFT)
  const titleRef = useRef<HTMLInputElement>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = validateDraft(draft, new Date(), true)
    setErrors(found)
    if (hasErrors(found)) return
    addTask(toTaskInput(draft))
    reset(EMPTY_DRAFT)
    titleRef.current?.focus()
  }

  return (
    <form
      className="task-form"
      aria-label="Add task"
      noValidate
      onSubmit={handleSubmit}
    >
      <TaskFields
        draft={draft}
        errors={errors}
        onChange={changeField}
        titleRef={titleRef}
        titleId={TITLE_FIELD_ID}
      />
      <button type="submit" className="button button--primary">
        Add task
      </button>
    </form>
  )
}
