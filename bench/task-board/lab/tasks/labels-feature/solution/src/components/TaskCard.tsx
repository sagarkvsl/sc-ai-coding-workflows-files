import { useId, useState } from 'react'
import { PRIORITY_LABELS } from '../types/task'
import type { Task } from '../types/task'
import { formatDueDate, isOverdue } from '../utils/date'
import { TaskCardActions } from './TaskCardActions'
import { TaskEditForm } from './TaskEditForm'

interface TaskCardProps {
  task: Task
}

export function TaskCard({ task }: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const headingId = useId()

  if (isEditing) {
    return (
      <article className="card card--editing">
        <TaskEditForm task={task} onClose={() => setIsEditing(false)} />
      </article>
    )
  }

  const overdue = isOverdue(task.dueDate, task.status, new Date())

  return (
    <article className="card" aria-labelledby={headingId}>
      <h3 id={headingId} className="card__title">
        {task.title}
      </h3>
      {task.description !== '' && (
        <p className="card__description">{task.description}</p>
      )}
      {task.labels.length > 0 && (
        <ul className="card__labels" aria-label="Labels">
          {task.labels.map((label) => (
            <li key={label} className="label">
              {label}
            </li>
          ))}
        </ul>
      )}
      <div className="card__meta">
        <span className={`badge badge--${task.priority}`}>
          {PRIORITY_LABELS[task.priority]} priority
        </span>
        {task.dueDate !== null && (
          <time className="card__due" dateTime={task.dueDate}>
            {formatDueDate(task.dueDate)}
          </time>
        )}
        {overdue && <span className="badge badge--overdue">Overdue</span>}
      </div>
      <TaskCardActions task={task} onEdit={() => setIsEditing(true)} />
    </article>
  )
}
