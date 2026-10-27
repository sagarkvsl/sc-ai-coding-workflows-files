import { useMemo } from 'react'
import type { Dispatch } from 'react'
import type { TaskAction, TaskChanges } from '../state/actions'
import type {
  PriorityFilter,
  SortKey,
  Status,
  Task,
  TaskInput,
} from '../types/task'
import { createId } from '../utils/id'

export interface TaskActions {
  addTask: (input: TaskInput) => void
  updateTask: (id: string, changes: TaskChanges) => void
  moveTask: (id: string, status: Status) => void
  deleteTask: (id: string) => void
  clearDone: () => void
  setQuery: (query: string) => void
  setPriority: (priority: PriorityFilter) => void
  setSort: (sort: SortKey) => void
  setLabel: (label: string) => void
  clearFilters: () => void
}

function createActions(dispatch: Dispatch<TaskAction>): TaskActions {
  return {
    addTask: (input) => {
      const task: Task = {
        ...input,
        id: createId(),
        status: 'todo',
        createdAt: new Date().toISOString(),
      }
      dispatch({ type: 'task/added', task })
    },
    updateTask: (id, changes) => dispatch({ type: 'task/updated', id, changes }),
    moveTask: (id, status) => dispatch({ type: 'task/moved', id, status }),
    deleteTask: (id) => dispatch({ type: 'task/deleted', id }),
    clearDone: () => dispatch({ type: 'tasks/doneCleared' }),
    setQuery: (query) => dispatch({ type: 'filters/queryChanged', query }),
    setPriority: (priority) =>
      dispatch({ type: 'filters/priorityChanged', priority }),
    setSort: (sort) => dispatch({ type: 'filters/sortChanged', sort }),
    setLabel: (label) => dispatch({ type: 'filters/labelChanged', label }),
    clearFilters: () => dispatch({ type: 'filters/cleared' }),
  }
}

export function useTaskActions(dispatch: Dispatch<TaskAction>): TaskActions {
  return useMemo(() => createActions(dispatch), [dispatch])
}
