# Task Board

A small React 19 + TypeScript board with three columns (To do, In progress, Done). In memory only.

## Features

Add, edit, move and delete tasks (delete asks for confirmation) · search by text and filter by priority · sort by newest, due date or priority · a count on every column and a header summary · tasks past their due date are marked **Overdue** until done · **Clear completed** · keyboard shortcuts (`n` focuses the add form, `/` focuses search, Escape clears the search or closes an edit form).

## Layout

```
src/
  types/task.ts          domain types and constants
  state/                 actions.ts, taskReducer.ts, selectors.ts (plain TypeScript), TaskContext.tsx
  hooks/                 useTasks (the only way components reach state), useTaskActions, useTaskDraft, useGlobalShortcuts
  utils/                 date.ts, id.ts, guards.ts, draft.ts, validation.ts, fieldIds.ts
  components/            one component per file
  styles/                variables.css, base.css, layout.css, components.css
tools/report/            report.ts: builds a plain-text report from a list of tasks (a second consumer of src/)
```

## House rules

- Layers: `types` <- `utils` <- `state` <- `hooks` <- `components`. Components never import `state/`.
- The reducer is pure. A no-op returns the **same state object**. Unchanged tasks keep their identity. Nothing is mutated.
- Derived data (visible tasks, sorted lists, counts) is computed, never stored in state. No effect copies state into state.
- Named exports only. No `any`, no `as` casts (except `as const`), no non-null `!`.
- No source file over 150 lines, no function over 70 lines, no more than 4 `useState` in a component.
- Colours live only in `variables.css`. No inline styles.
- Dates are calendar days (`YYYY-MM-DD`), never instants. Tests run in the `America/Los_Angeles` time zone.
- Tests sit next to the code (`*.test.ts[x]`), use Testing Library queries by role and label, and `user-event` (awaited).

## Commands

`npm test` (Vitest), `npm run typecheck`, `npm run build`. The type check covers `src/` and `tools/`.
