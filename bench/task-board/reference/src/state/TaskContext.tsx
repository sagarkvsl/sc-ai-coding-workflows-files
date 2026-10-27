import { createContext, useReducer } from 'react'
import type { Dispatch, ReactNode } from 'react'
import type { Task, TaskState } from '../types/task'
import type { TaskAction } from './actions'
import { createInitialState, taskReducer } from './taskReducer'

export const TaskStateContext = createContext<TaskState | null>(null)
export const TaskDispatchContext = createContext<Dispatch<TaskAction> | null>(
  null,
)

interface TaskProviderProps {
  children: ReactNode
  initialTasks?: Task[]
}

export function TaskProvider({ children, initialTasks }: TaskProviderProps) {
  const [state, dispatch] = useReducer(
    taskReducer,
    initialTasks,
    createInitialState,
  )
  return (
    <TaskStateContext.Provider value={state}>
      <TaskDispatchContext.Provider value={dispatch}>
        {children}
      </TaskDispatchContext.Provider>
    </TaskStateContext.Provider>
  )
}
