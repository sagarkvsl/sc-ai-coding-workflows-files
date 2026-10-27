import { useState } from 'react'
import { useTasks } from '../hooks/useTasks'
import { STATUSES, STATUS_LABELS } from '../types/task'
import type { Task } from '../types/task'

interface TaskCardActionsProps {
  task: Task
  onEdit: () => void
}

export function TaskCardActions({ task, onEdit }: TaskCardActionsProps) {
  const { moveTask, deleteTask } = useTasks()
  const [isConfirming, setIsConfirming] = useState(false)
  const targets = STATUSES.filter((status) => status !== task.status)

  return (
    <div className="card__actions">
      {targets.map((status) => (
        <button
          key={status}
          type="button"
          className="button"
          aria-label={`Move ${task.title} to ${STATUS_LABELS[status]}`}
          onClick={() => moveTask(task.id, status)}
        >
          {STATUS_LABELS[status]}
        </button>
      ))}
      <button
        type="button"
        className="button"
        aria-label={`Edit ${task.title}`}
        onClick={onEdit}
      >
        Edit
      </button>
      {isConfirming ? (
        <>
          <button
            type="button"
            className="button button--danger"
            aria-label={`Confirm delete ${task.title}`}
            onClick={() => deleteTask(task.id)}
          >
            Confirm
          </button>
          <button
            type="button"
            className="button"
            aria-label={`Cancel delete ${task.title}`}
            onClick={() => setIsConfirming(false)}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          className="button button--danger"
          aria-label={`Delete ${task.title}`}
          onClick={() => setIsConfirming(true)}
        >
          Delete
        </button>
      )}
    </div>
  )
}
