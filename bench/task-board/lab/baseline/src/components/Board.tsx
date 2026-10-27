import { useTasks } from '../hooks/useTasks'
import { STATUSES } from '../types/task'
import { TaskColumn } from './TaskColumn'

function getBoardMessage(total: number, visibleCount: number): string | null {
  if (total === 0) return 'No tasks yet. Add your first task above.'
  if (visibleCount === 0) return 'No tasks match your filters.'
  return null
}

export function Board() {
  const { columns, total, visibleCount } = useTasks()
  const message = getBoardMessage(total, visibleCount)

  return (
    <div className="board-area">
      {message !== null && <p className="board-area__message">{message}</p>}
      <div className="board">
        {STATUSES.map((status) => (
          <TaskColumn key={status} status={status} tasks={columns[status]} />
        ))}
      </div>
    </div>
  )
}
