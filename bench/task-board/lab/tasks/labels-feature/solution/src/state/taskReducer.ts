import { DEFAULT_FILTERS } from '../types/task'
import type { Filters, Task, TaskState } from '../types/task'
import type { TaskAction, TaskChanges } from './actions'
import { hasLabel } from '../utils/labels'

export function createInitialState(tasks: Task[] = []): TaskState {
  return { tasks, filters: DEFAULT_FILTERS }
}

export const initialState: TaskState = createInitialState()

function assertNever(action: never): never {
  throw new Error(`Unhandled action: ${JSON.stringify(action)}`)
}

function applyChanges(task: Task, changes: TaskChanges): Task {
  const next = { ...task, ...changes }
  const unchanged =
    next.title === task.title &&
    next.description === task.description &&
    next.priority === task.priority &&
    next.dueDate === task.dueDate &&
    next.labels.length === task.labels.length &&
    next.labels.every((label, i) => label === task.labels[i])
  return unchanged ? task : next
}

function withTasks(state: TaskState, tasks: Task[]): TaskState {
  const { label } = state.filters
  const stale = label !== '' && !tasks.some((task) => hasLabel(task.labels, label))
  const filters = stale ? { ...state.filters, label: '' } : state.filters
  return { ...state, tasks, filters }
}

function updateTask(
  state: TaskState,
  id: string,
  update: (task: Task) => Task,
): TaskState {
  const index = state.tasks.findIndex((task) => task.id === id)
  if (index === -1) return state
  const updated = update(state.tasks[index])
  if (updated === state.tasks[index]) return state
  const tasks = state.tasks.map((task, i) => (i === index ? updated : task))
  return withTasks(state, tasks)
}

function setFilters(state: TaskState, changes: Partial<Filters>): TaskState {
  const filters = { ...state.filters, ...changes }
  const unchanged =
    filters.query === state.filters.query &&
    filters.priority === state.filters.priority &&
    filters.sort === state.filters.sort &&
    filters.label === state.filters.label
  return unchanged ? state : { ...state, filters }
}

export function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'task/added':
      return { ...state, tasks: [action.task, ...state.tasks] }
    case 'task/updated':
      return updateTask(state, action.id, (task) =>
        applyChanges(task, action.changes),
      )
    case 'task/moved':
      return updateTask(state, action.id, (task) =>
        task.status === action.status ? task : { ...task, status: action.status },
      )
    case 'task/deleted': {
      const tasks = state.tasks.filter((task) => task.id !== action.id)
      return tasks.length === state.tasks.length ? state : withTasks(state, tasks)
    }
    case 'filters/queryChanged':
      return setFilters(state, { query: action.query })
    case 'filters/priorityChanged':
      return setFilters(state, { priority: action.priority })
    case 'tasks/doneCleared': {
      const tasks = state.tasks.filter((task) => task.status !== 'done')
      return tasks.length === state.tasks.length ? state : withTasks(state, tasks)
    }
    case 'filters/sortChanged':
      return setFilters(state, { sort: action.sort })
    case 'filters/labelChanged':
      return setFilters(state, { label: action.label })
    case 'filters/cleared':
      return setFilters(state, {
        query: DEFAULT_FILTERS.query,
        priority: DEFAULT_FILTERS.priority,
        label: DEFAULT_FILTERS.label,
      })
    default:
      return assertNever(action)
  }
}
