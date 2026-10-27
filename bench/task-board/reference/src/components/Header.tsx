import { useTasks } from '../hooks/useTasks'

export function Header() {
  const { total, visibleCount, doneCount, clearDone } = useTasks()
  return (
    <header className="header">
      <h1 className="header__title">Task Board</h1>
      <p className="header__summary" role="status">
        Showing {visibleCount} of {total} {total === 1 ? 'task' : 'tasks'}
      </p>
      <button
        type="button"
        className="button"
        disabled={doneCount === 0}
        onClick={clearDone}
      >
        Clear completed
      </button>
    </header>
  )
}
