let counter = 0

export function makeTask(overrides: Record<string, unknown> = {}) {
  counter += 1
  return {
    id: `task-${counter}`,
    title: `Task ${counter}`,
    description: '',
    priority: 'medium',
    status: 'todo',
    dueDate: null as string | null,
    labels: [] as string[],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

/** Three tasks, one per column, with distinct priorities. */
export function seedTasks() {
  return [
    makeTask({ id: 'a', title: 'Fix login bug', priority: 'high' }),
    makeTask({ id: 'b', title: 'Write docs', description: 'Explain the LOGIN flow', status: 'doing' }),
    makeTask({ id: 'c', title: 'Plan sprint', priority: 'low', status: 'done' }),
  ]
}

/** "Today" for every UI test: 15 June 2026, local noon. */
export const TODAY = new Date(2026, 5, 15, 12, 0, 0)
