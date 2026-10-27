import { PRIORITIES, SORT_KEYS } from '../types/task'
import type { Priority, PriorityFilter, SortKey } from '../types/task'

export function isPriority(value: string): value is Priority {
  return PRIORITIES.some((priority) => priority === value)
}

export function isPriorityFilter(value: string): value is PriorityFilter {
  return value === 'all' || isPriority(value)
}

export function isSortKey(value: string): value is SortKey {
  return SORT_KEYS.some((key) => key === value)
}
