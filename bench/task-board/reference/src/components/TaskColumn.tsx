import { useId } from 'react'
import { STATUS_LABELS } from '../types/task'
import type { Status, Task } from '../types/task'
import { TaskCard } from './TaskCard'

interface TaskColumnProps {
  status: Status
  tasks: Task[]
}

export function TaskColumn({ status, tasks }: TaskColumnProps) {
  const labelId = useId()

  return (
    <section className="column" aria-labelledby={labelId}>
      <h2 className="column__title">
        <span id={labelId}>{STATUS_LABELS[status]}</span>{' '}
        <span className="column__count">{tasks.length}</span>
      </h2>
      {tasks.length === 0 ? (
        <p className="column__empty">No tasks here.</p>
      ) : (
        <ul className="column__list">
          {tasks.map((task) => (
            <li key={task.id} className="column__item">
              <TaskCard task={task} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
