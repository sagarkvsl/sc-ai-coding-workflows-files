import { useContext, useMemo } from 'react'
import type { Dispatch } from 'react'
import type { TaskAction } from '../state/actions'
import {
  countDone,
  groupByStatus,
  selectVisibleTasks,
  sortTasks,
} from '../state/selectors'
import { TaskDispatchContext, TaskStateContext } from '../state/TaskContext'
import type { Filters, Status, Task, TaskState } from '../types/task'
import { useTaskActions } from './useTaskActions'
import type { TaskActions } from './useTaskActions'

export interface UseTasksResult extends TaskActions {
  columns: Record<Status, Task[]>
  filters: Filters
  total: number
  visibleCount: number
  doneCount: number
}

function useRequiredContexts(): {
  state: TaskState
  dispatch: Dispatch<TaskAction>
} {
  const state = useContext(TaskStateContext)
  const dispatch = useContext(TaskDispatchContext)
  if (state === null || dispatch === null) {
    throw new Error('useTasks must be used within a TaskProvider')
  }
  return { state, dispatch }
}

export function useTasks(): UseTasksResult {
  const { state, dispatch } = useRequiredContexts()
  const actions = useTaskActions(dispatch)

  const visible = useMemo(() => selectVisibleTasks(state), [state])
  const { sort } = state.filters
  const columns = useMemo(
    () => groupByStatus(sortTasks(visible, sort)),
    [visible, sort],
  )
  const doneCount = useMemo(() => countDone(state.tasks), [state.tasks])

  return useMemo(
    () => ({
      ...actions,
      columns,
      filters: state.filters,
      total: state.tasks.length,
      visibleCount: visible.length,
      doneCount,
    }),
    [actions, columns, doneCount, state, visible],
  )
}
