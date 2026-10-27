# Task: change two function signatures

Two shared helpers take positional arguments that no longer scale. Change their signatures and **update every caller in the repository** (the app, the tests and anything outside `src/`).

## 1. `isOverdue` in `src/utils/date.ts`
- Before: `isOverdue(dueDate: string | null, status: Status, today: Date): boolean`
- After: `isOverdue(task: Pick<Task, 'dueDate' | 'status'>, today: Date): boolean`
- The rule is the same: true when there is a due date, the status is not `'done'`, and the date is before today.

## 2. `sortTasks` in `src/state/selectors.ts`
- Before: `sortTasks(tasks: Task[], sort: SortKey): Task[]`
- After: `sortTasks(tasks: Task[], options: SortOptions): Task[]`
- Add `export interface SortOptions { by: SortKey; reverse?: boolean }` to `src/types/task.ts`.
- `options.by` is what `sort` was. When `options.reverse` is `true`, the sorted list is returned in the **reverse** order (the whole list, ties included). When it is missing or `false`, nothing changes.
- It still returns a new array, never mutates its input, and stays stable.

Nothing else changes: the board, the report and every other behaviour must work as before. Update the existing tests that call the old signatures and keep them passing. The type check covers `src/` and `tools/`.
