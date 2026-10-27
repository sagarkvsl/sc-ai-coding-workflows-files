import type { FormEvent, KeyboardEvent } from 'react'
import { useTaskDraft } from '../hooks/useTaskDraft'
import { useTasks } from '../hooks/useTasks'
import type { Task } from '../types/task'
import { toDraft, toTaskInput } from '../utils/draft'
import { hasErrors, validateDraft } from '../utils/validation'
import { TaskFields } from './TaskFields'

interface TaskEditFormProps {
  task: Task
  onClose: () => void
}

export function TaskEditForm({ task, onClose }: TaskEditFormProps) {
  const { updateTask } = useTasks()
  const { draft, errors, setErrors, changeField } = useTaskDraft(toDraft(task))

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = validateDraft(draft, new Date(), false)
    setErrors(found)
    if (hasErrors(found)) return
    updateTask(task.id, toTaskInput(draft))
    onClose()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape') onClose()
  }

  return (
    <form
      className="task-form task-form--inline"
      aria-label={`Edit ${task.title}`}
      noValidate
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    >
      <TaskFields draft={draft} errors={errors} onChange={changeField} />
      <div className="card__actions">
        <button type="submit" className="button button--primary">
          Save
        </button>
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  )
}
