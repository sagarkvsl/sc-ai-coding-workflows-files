# Task Board: build specification

This is the full specification for **Task Board**, a small React and TypeScript app. It is written so that a model's output can be scored by an automated test suite. Anything the suite checks is written down here. Where this document gives an exact string, file path or export name, use it exactly.

Read the whole document before writing code. Build the whole app, including your own tests.

---

## 1. What you are building

Task Board is a single-page to-do board with three columns: **To do**, **In progress** and **Done**.

- Add a task with a title, an optional description, a priority and an optional due date.
- Move a task between columns, edit it in place, and delete it after a confirmation step.
- Search tasks by text and filter them by priority.
- A header summary and a count on every column show how many tasks are visible.
- Tasks past their due date are marked **Overdue** until they are done.
- Sort every column by newest, due date or priority.
- Clear all completed tasks with one button.
- Keyboard shortcuts: `n` jumps to the add form, `/` jumps to the search box, and Escape clears the search.

There is no backend, no router and no persistence. Everything lives in memory and a page refresh starts empty.

---

## 2. Hard constraints

### 2.1 Libraries

| Kind | Allowed |
|---|---|
| Runtime `dependencies` | `react` and `react-dom` only. Nothing else. |
| `devDependencies` | `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@testing-library/dom`, and any `@types/*` package |

No router, state library, CSS framework, CSS-in-JS, UI kit, icon library, date library or utility library (no lodash, no `clsx`).

### 2.2 Project files and scripts

`package.json` must define these scripts:

| Script | Value |
|---|---|
| `dev` | starts Vite |
| `build` | runs the type check, then `vite build` |
| `test` | exactly `vitest run` |
| `typecheck` | `tsc --noEmit` |

Required root files: `package.json`, `index.html`, `tsconfig.json`, `vite.config.ts`.

`tsconfig.json` must set `strict: true`, `noUnusedLocals: true` and `noUnusedParameters: true`. `tsc --noEmit` must report zero errors across source files and test files.

`vite.config.ts` must set the Vitest `environment` to `'jsdom'` and `setupFiles` to `['./src/setupTests.ts']`. Do not enable Vitest `globals`; import `describe`, `it`, `expect` and the rest from `vitest`.

`src/setupTests.ts` must register the jest-dom matchers and clean up after each test:

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
```

`index.html` must have `<!doctype html>`, `<html lang="en">`, a charset meta tag, a viewport meta tag with `width=device-width`, `<title>Task Board</title>`, `<div id="root"></div>` and `<script type="module" src="/src/main.tsx"></script>`.

### 2.2.1 The toolchain is fixed

Nothing is installed by you, and the scorer runs your code with exactly these versions. Write `package.json` with these ranges and write your code for these versions (React 19, TypeScript 6):

```json
"dependencies": { "react": "^19.3.1", "react-dom": "^19.3.1" },
"devDependencies": {
  "@testing-library/jest-dom": "^7.0.1",
  "@testing-library/react": "^16.3.3",
  "@testing-library/user-event": "^14.6.8",
  "@types/react": "^19.3.0",
  "@types/react-dom": "^19.3.0",
  "@vitejs/plugin-react": "^6.1.2",
  "jsdom": "^26.1.0",
  "typescript": "~6.0.3",
  "vite": "^8.3.4",
  "vitest": "^5.0.5"
}
```

Use `vite.config.ts` and `tsconfig.json` exactly as below. `package.json` also needs `"type": "module"`.

```ts
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
```

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client"],
    "strict": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "vite.config.ts"]
}
```

Things that differ from React 18: `useRef<T>(null)` is a `RefObject<T | null>`, so type a ref prop as `Ref<T>` or `RefObject<T | null>`; `ref` is an ordinary prop on function components (no `forwardRef`); React reports an error thrown while rendering without calling `console.error` in the same way, so do not assert on `console.error` in tests.

### 2.3 Time zones

The tests run in the `America/Los_Angeles` time zone. Dates must behave the same in every time zone. Treat a due date as a calendar day (`YYYY-MM-DD`), never as an instant. Do not build one with `new Date('2026-03-05')` (that is UTC midnight) and then read local fields from it.

---

## 3. Required file layout

These paths are fixed. You may add more files, but these must exist with these names. Apart from `App.tsx`, `main.tsx` and `setupTests.ts`, nothing else may sit directly in `src/`.

```
index.html
package.json
tsconfig.json
vite.config.ts
src/
  main.tsx
  App.tsx
  setupTests.ts
  types/
    task.ts
  state/
    actions.ts
    taskReducer.ts
    selectors.ts
    TaskContext.tsx
  hooks/
    useTasks.ts
    useGlobalShortcuts.ts
  utils/
    date.ts
    id.ts
  components/
    Header.tsx
    TaskForm.tsx
    FilterBar.tsx
    Board.tsx
    TaskColumn.tsx
    TaskCard.tsx
    Shortcuts.tsx
  styles/
    variables.css
    base.css
    layout.css
    components.css
```

Required extra structure:

- At least **9 files** in `components/`, **3** in `state/`, **3** in `utils/` and **3** in `hooks/`. The seven components above are the minimum. Split out more (for example a field wrapper, an edit form, card actions) rather than writing long components.
- Put test helpers, if you need any, in `src/test/`. Test files sit next to the code they test and are named `*.test.ts` or `*.test.tsx`.

### 3.1 Module rules

| Rule | Detail |
|---|---|
| Layers | `types` imports nothing from the app. `utils` may import `types`. `state` may import `types` and `utils`. `hooks` may import `types`, `utils` and `state`. `components` may import `types`, `utils` and `hooks`, but **never `state/`**. |
| No cycles | No circular imports. |
| Plain logic | Everything in `types/`, `utils/`, and `state/actions.ts`, `state/taskReducer.ts`, `state/selectors.ts` is a plain `.ts` file with no React import and no JSX. |
| Context access | Components do not call `useContext`. They use `useTasks()`. |
| Exports | Named exports only. No `export default`. |
| Components | One component per file in `components/`. The file name equals the component name (`TaskCard.tsx` exports `TaskCard`). Files are PascalCase. |
| Hooks | Hook files are named `useX.ts` and export a function with the same name. |
| Size | No source file longer than **150 lines**. |
| `main.tsx` | Thin entry point of 30 lines or fewer. It renders `<StrictMode><TaskProvider><App /></TaskProvider></StrictMode>` with `createRoot` and imports the four stylesheets. |
| `App.tsx` | Only composes components. No state, no hooks. |
| Effects | The app has exactly **one** `useEffect`, inside `hooks/useGlobalShortcuts.ts` (section 8.8). Nothing else uses `useEffect` or `useLayoutEffect`. |
| Imports | No module imports more than 10 others. |

---

## 4. Domain types: `src/types/task.ts`

Export these, with these names and meanings:

```ts
export const STATUSES = ['todo', 'doing', 'done'] as const
export const PRIORITIES = ['low', 'medium', 'high'] as const
export const SORT_KEYS = ['created', 'due', 'priority'] as const
export const MAX_TITLE_LENGTH = 80

export type Status = (typeof STATUSES)[number]
export type Priority = (typeof PRIORITIES)[number]
export type PriorityFilter = Priority | 'all'
export type SortKey = (typeof SORT_KEYS)[number]

export const STATUS_LABELS: Record<Status, string>     // todo: 'To do', doing: 'In progress', done: 'Done'
export const PRIORITY_LABELS: Record<Priority, string> // low: 'Low', medium: 'Medium', high: 'High'
export const SORT_LABELS: Record<SortKey, string>      // created: 'Newest first', due: 'Due date', priority: 'Priority'

export interface Task {
  id: string
  title: string
  description: string
  priority: Priority
  status: Status
  dueDate: string | null // 'YYYY-MM-DD' or null
  createdAt: string      // ISO 8601 string, not a Date
}

export interface Filters {
  query: string
  priority: PriorityFilter
  sort: SortKey
}

export interface TaskState {
  tasks: Task[]
  filters: Filters
}

export const DEFAULT_FILTERS: Filters // { query: '', priority: 'all', sort: 'created' }
```

You may add more types (for example `TaskInput` and a form draft type). Do not use `enum`. Do not type a status or priority as plain `string`. The number `80` appears once in the source: in `MAX_TITLE_LENGTH`.

---

## 5. State

### 5.1 Actions: `src/state/actions.ts`

Export one discriminated union named `TaskAction` with exactly these members:

| `type` | Payload |
|---|---|
| `'task/added'` | `task: Task` (already complete, with id and timestamp) |
| `'task/updated'` | `id: string`, `changes: Partial<Pick<Task, 'title' \| 'description' \| 'priority' \| 'dueDate'>>` |
| `'task/moved'` | `id: string`, `status: Status` |
| `'task/deleted'` | `id: string` |
| `'tasks/doneCleared'` | none |
| `'filters/queryChanged'` | `query: string` |
| `'filters/priorityChanged'` | `priority: PriorityFilter` |
| `'filters/sortChanged'` | `sort: SortKey` |
| `'filters/cleared'` | none |

### 5.2 Reducer: `src/state/taskReducer.ts`

Export:

- `taskReducer(state: TaskState, action: TaskAction): TaskState`
- `createInitialState(tasks?: Task[]): TaskState`, returning `{ tasks, filters: DEFAULT_FILTERS }`
- `initialState: TaskState`, which is `createInitialState()`

Rules:

1. `task/added` puts the new task **first** in the list.
2. `task/updated` applies only the fields in `changes` to the task with that id. `task/moved` changes only `status`. `task/deleted` removes that task and keeps the order of the rest.
3. `filters/queryChanged` stores the query **exactly as given** (no trimming). `filters/priorityChanged` stores the priority. `filters/sortChanged` stores the sort key. `filters/cleared` resets the **query and the priority only**; the sort key is kept, because sorting is an ordering choice and not a filter. `tasks/doneCleared` removes every task whose status is `'done'` (whether or not a filter is hiding it) and keeps the order and identity of the rest; it does not touch `filters`.
4. **No-ops return the same state object (`===`)**, not a copy. This covers: an unknown id for update, move or delete; moving to the status the task already has; an update whose values equal the current ones; a filter action that sets a value the filter already has (including `filters/sortChanged` with the current key); `filters/cleared` when the query is already `''` and the priority is already `'all'` (whatever the sort key is); `tasks/doneCleared` when no task is done.
5. **Never mutate** the incoming state, its `tasks` array, any task, or `filters`. Tests run the reducer on deeply frozen input.
6. **Keep identity.** After an action, every task that did not change is the same object as before. Only the changed task is new.
7. The reducer is **pure**: it does not read the clock, call `Math.random`, or generate ids. The `task/added` action carries a finished task.
8. The state has exactly two keys: `tasks` and `filters`. Never store derived values (visible tasks, sorted lists, counts, groups, overdue flags) in state.
9. The `switch` ends in an exhaustive check: a `default` branch that passes the action to a function with a parameter of type `never`.

### 5.3 Selectors: `src/state/selectors.ts`

- `selectVisibleTasks(state: TaskState): Task[]`

  A task is visible when it passes both filters:
  - **Priority:** `'all'`, or equal to the task priority.
  - **Query:** the trimmed, lower-cased query is empty, or is a substring of the lower-cased `title` **or** of the lower-cased `description`. The title and description are tested separately, so a query cannot match across the gap between them. A query of only spaces means no filter.

  The result keeps state order and contains the original task objects, not copies.

- `sortTasks(tasks: Task[], sort: SortKey): Task[]`

  Returns a **new** array and never mutates its input. The sort is **stable**: tasks that tie keep their input order.
  - `'created'`: newest first, by `createdAt` (ISO strings compare correctly as text).
  - `'due'`: earliest `dueDate` first; tasks with no due date go last.
  - `'priority'`: `high`, then `medium`, then `low`.

- `groupByStatus(tasks: Task[]): Record<Status, Task[]>`

  Always returns an array for all three statuses (empty when a status has no tasks). Order inside each group follows input order. Does not mutate its input.

### 5.4 Provider: `src/state/TaskContext.tsx`

Export `TaskProvider({ children, initialTasks })`. `initialTasks?: Task[]` is optional and defaults to no tasks.

- Hold the state with a single `useReducer(taskReducer, …)`, seeded with `createInitialState`.
- Use `createContext`, ideally two contexts (one for state, one for dispatch) so the value is never a freshly built object. Do not pass an object literal, array literal or arrow function as a `value` prop.
- No `useState` in this file.

### 5.5 Rules for state design

These apply everywhere:

| Rule | Why |
|---|---|
| Derived data is computed, not stored. Do not keep `filteredTasks`, counts, totals, groups or overdue flags in `useState`. | A copy can go stale and costs an extra render. |
| **No `useEffect` or `useLayoutEffect` that calls a setter or `dispatch`.** The app needs no effects at all. | An effect that syncs state with state renders twice. |
| Memoise derived data with `useMemo` inside `useTasks`. | A re-render that changes nothing must not rebuild `columns`. |
| Handlers handed out by `useTasks` keep their identity (`useCallback`, or `dispatch` itself). | They stay stable when state changes. |
| Form fields and edit drafts are **local** state inside the form. | Typing must not re-render the board. |
| No component has more than 4 `useState` calls. Extract a hook for bigger forms. | Keeps components small. |
| Cards are keyed by `task.id`, never by array index. | Local state follows the card, not the position. |

---

## 6. Utilities

### 6.1 `src/utils/date.ts`

Dates are calendar days. The functions below take `today: Date` as a parameter so they stay pure.

| Function | Behaviour |
|---|---|
| `toIsoDate(date: Date): string` | The **local** calendar date as `YYYY-MM-DD`, zero-padded. Never the UTC date: `new Date(2026, 0, 5, 23, 30)` gives `'2026-01-05'`. |
| `isPastDate(dueDate: string, today: Date): boolean` | `true` only when `dueDate` is a valid `YYYY-MM-DD` string **before** today's local date. Today itself is not past. Anything that is not an ISO date gives `false`. |
| `isOverdue(dueDate: string \| null, status: Status, today: Date): boolean` | `true` when there is a due date, the task is not `'done'`, and the date is past. |
| `formatDueDate(dueDate: string): string` | `'2026-03-05'` becomes `'Due 5 Mar 2026'`. The day has no leading zero. Month names are fixed English abbreviations: `Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec`. Do not use `Intl` or `toLocale…`. An invalid string, including a month of `13`, is returned unchanged. |

### 6.2 `src/utils/id.ts`

`createId(): string` returns a new unique id each call (use `crypto.randomUUID()`).

### 6.3 Other utilities

Put validation, draft conversion and type guards in `utils/` too (for example `validation.ts`, `draft.ts`, `guards.ts`). Do not cast with `as` to turn a DOM `string` into a union; write a type guard.

Messages are defined once in the source (each exact string appears in a single file):

| Message | Exact text |
|---|---|
| Empty title | `Title is required.` |
| Title too long | `Title must be 80 characters or fewer.` |
| Past due date | `Due date cannot be in the past.` |

---

## 7. The hook: `src/hooks/useTasks.ts`

`useTasks()` is the only way components touch the state. It returns:

| Property | Meaning |
|---|---|
| `columns: Record<Status, Task[]>` | **Visible** tasks, sorted by `filters.sort`, grouped by status (via the selectors) |
| `filters: Filters` | The current filters |
| `total: number` | All tasks, ignoring filters |
| `visibleCount: number` | Number of visible tasks |
| `doneCount: number` | Number of tasks with status `done`, **ignoring the filters** |
| `addTask(input)` | `input` is `{ title, description, priority, dueDate }`. Builds a task with `createId()`, `status: 'todo'` and `createdAt: new Date().toISOString()`, then dispatches `task/added`. |
| `updateTask(id, changes)` | Dispatches `task/updated` |
| `moveTask(id, status)` | Dispatches `task/moved` |
| `deleteTask(id)` | Dispatches `task/deleted` |
| `clearDone()` | Dispatches `tasks/doneCleared` |
| `setQuery(query)` | Dispatches `filters/queryChanged` |
| `setPriority(priority)` | Dispatches `filters/priorityChanged` |
| `setSort(sort)` | Dispatches `filters/sortChanged` |
| `clearFilters()` | Dispatches `filters/cleared` |

Rules:

- Called outside a `TaskProvider`, it throws an `Error` whose message contains `TaskProvider`.
- The nine functions keep the **same identity** across renders and state changes.
- `columns` keeps its identity across a re-render where nothing changed, and gets a new identity when the filters, the sort or the tasks change.
- The order of work is: filter, then sort, then group. Sorting never changes `total` or `visibleCount`.
- `src/hooks/useTasks.ts` imports from `../state/selectors`.

---

## 8. Components and behaviour

All visible text and accessible names below are exact (case and punctuation included). "Name" means the accessible name, which is what `getByRole(…, { name })` matches.

### 8.1 `App`

```
<Header />
<Shortcuts />
<main>
  <TaskForm />
  <FilterBar />
  <Board />
</main>
```

`Shortcuts` renders nothing (`null`); it only mounts the keyboard shortcuts (section 8.8). The page has one `banner` (the header), one `main` and one `h1`.

### 8.2 `Header`

- `<header>` containing `<h1>Task Board</h1>`.
- An element with `role="status"` showing: `Showing {visibleCount} of {total} {tasks}`. The last word is `task` when `total` is 1 and `tasks` otherwise. Examples: `Showing 2 of 3 tasks`, `Showing 1 of 1 task`, `Showing 0 of 0 tasks`.
- A button named `Clear completed` (a `type="button"`). Clicking it removes **every** done task at once, with no confirmation, even tasks that the current filters are hiding. It is **disabled** when there is no done task (`doneCount` is 0, which ignores the filters) and enabled otherwise.

### 8.3 `TaskForm` (add a task)

A `<form>` named **Add task** (`aria-label="Add task"`). It must **not** rely on native browser validation (use `noValidate`).

| Field | Control | Label | Notes |
|---|---|---|---|
| Title | `<input type="text">` | `Title` | Its `id` is exactly `add-task-title` (the shortcuts in 8.8 look it up). |
| Description | `<textarea>` | `Description` | |
| Priority | `<select>` | `Priority` | Options `Low`, `Medium`, `High` in that order. Default `Medium`. |
| Due date | `<input type="date">` | `Due date` | Optional. |

A submit button named `Add task`. Pressing Enter in the Title field submits the form.

On submit:

1. Validate. **Title:** trimmed length 0 gives `Title is required.`; trimmed length over 80 gives `Title must be 80 characters or fewer.` (exactly 80 is fine). **Due date:** if set and before today (local calendar day), `Due date cannot be in the past.` Today is allowed.
2. Both errors can show together.
3. Each error is its own element with `role="alert"`. The invalid control gets `aria-invalid="true"` and `aria-describedby` pointing at the error element's id, so its accessible description is the message.
4. Errors appear only after a submit attempt. An error disappears as soon as its own field changes. Changing another field leaves it.
5. A failed submit keeps everything the user typed and adds nothing.
6. On success, call `addTask` with the **trimmed** title and **trimmed** description, the chosen priority, and the due date (`null` when empty). Then clear all fields, set Priority back to `Medium`, clear errors, and move keyboard **focus to the Title field**.

### 8.4 `FilterBar`

A region named **Filters** (`<section aria-label="Filters">`) containing:

- A search input labelled `Search tasks`. Its `id` is exactly `filter-query`. Pressing **Escape** in it clears the query when the query is not empty.
- A select labelled `Filter by priority` with options `All priorities`, `Low`, `Medium`, `High` (values `all`, `low`, `medium`, `high`).
- A select labelled `Sort by` with options `Newest first`, `Due date`, `Priority` (values `created`, `due`, `priority`; default `created`). Choosing one sorts **every column** (section 5.3) immediately. Sorting is not a filter: it never changes the counts, the header summary or the empty-board messages.
- A button `Clear filters`, **disabled** when the query is `''` and the priority is `all`, enabled otherwise. The sort does not matter here: a board that is only sorted still has `Clear filters` disabled, and clicking it never resets the sort. A query of only spaces counts as a filter, so the button is enabled.

Filtering is immediate (no debounce), and the controls are controlled by the state in the store.

### 8.5 `Board`, `TaskColumn`

- The board holds three columns in order To do, In progress, Done.
- A message above the columns:
  - `No tasks yet. Add your first task above.` when `total` is 0.
  - `No tasks match your filters.` when `total` is above 0 but `visibleCount` is 0.
  - Nothing otherwise.
- Each column is a `<section>`. Its **name** is exactly the column label (`To do`, `In progress`, `Done`), so the accessible name must come from the label text alone.
- Each column has an `<h2>` whose text content is the label, a space, then the number of visible tasks in that column. Example: `To do 2`, `In progress 0`.
- Tasks are `<li>` items of a `<ul>`, and each `<li>` holds one card. A column with no visible tasks renders no list, only the paragraph `No tasks here.`.

### 8.6 `TaskCard`

`TaskCard` takes one prop, `task: Task`. In normal mode it is an `<article>` named after the task title (`aria-labelledby` pointing at the title heading) and shows:

| Part | Detail |
|---|---|
| Title | An `<h3>` with the title text |
| Description | A `<p>`, only when the description is not empty |
| Priority | Text `Low priority`, `Medium priority` or `High priority` |
| Due date | When set: `<time datetime="2026-07-04">Due 4 Jul 2026</time>` (the text from `formatDueDate`) |
| Overdue | The text `Overdue` when `isOverdue(dueDate, status, today)` is true |
| Actions | See below |

Actions (all real `<button type="button">`). Visible text may be short; the **accessible name** must be exactly:

| Button | Name |
|---|---|
| Move | `Move {title} to {label}`: one button for **each of the two other statuses**, in `STATUSES` order, e.g. `Move Write docs to To do` and `Move Write docs to Done` |
| Edit | `Edit {title}` |
| Delete | `Delete {title}` |

Moving updates the board immediately and every count.

**Delete uses a confirmation step.** Clicking `Delete {title}` swaps that one card's Delete button for two buttons named `Confirm delete {title}` and `Cancel delete {title}`. Confirm removes the task. Cancel brings the Delete button back and keeps the task. Other cards are not affected. This is local state inside the card.

### 8.7 Editing a card

Clicking `Edit {title}` replaces the card's content with an inline `<form>` named `Edit {title}` (using the task's current title). It contains controls labelled `Title`, `Description`, `Priority` and `Due date`, **pre-filled** with the task's values (the due date input is empty when there is none), plus buttons `Save` and `Cancel`. Move, Edit and Delete buttons are hidden while editing.

- **Save** validates the title with the same two rules as the add form (`Title is required.`, `Title must be 80 characters or fewer.`), shown as `role="alert"` linked to the field. A **past due date is allowed** when editing (the task may already be overdue). On success it saves with trimmed title and description, closes the form, and shows the card again. Clearing the due date removes it.
- **Cancel**, or pressing **Escape** inside the form, closes the form and discards the draft.
- The draft is local to the card. Several cards can be edited at once without sharing a draft, and an open form keeps what the user typed when a **different** card moves or changes (so keys must be stable ids).
- Ids must stay unique in the page even with several forms open (use `useId`).
- Reopening the editor after Cancel starts again from the saved values.

### 8.8 Keyboard shortcuts

`hooks/useGlobalShortcuts.ts` exports `useGlobalShortcuts(): void` and `components/Shortcuts.tsx` exports `Shortcuts`, which calls the hook and renders `null`.

- The hook registers **one** `keydown` listener on `document` (or `window`) inside a single `useEffect` with an empty dependency array, and removes that same listener in the effect cleanup. It is not registered again when the board changes.
- Pressing **`n`** focuses the Title field of the add form (`#add-task-title`). Pressing **`/`** focuses the search box (`#filter-query`). In both cases the key press is **swallowed** (`preventDefault`), so the letter is not typed into the field that just got focus.
- A shortcut is **ignored** when the key press comes from an `input`, `textarea`, `select` or content-editable element, so typing `n` or `/` in a field types the character. It is also ignored when Ctrl, Meta or Alt is held.
- This hook is the one place where `document.getElementById` is allowed.

---

## 9. HTML and accessibility

| Rule | Detail |
|---|---|
| Landmarks | One `banner`, one `main`, one `h1`. Columns and the filter bar are named regions. |
| Headings | `h1` then `h2` (columns) then `h3` (cards). A level never jumps by more than one. |
| Names | Every input, select, textarea and button has a non-empty accessible name. Labels are real `<label>` elements tied by `for` and `id`. |
| Buttons | Every `<button>` has an explicit `type` (`button` or `submit`). |
| Native controls | No `role="button"` and no clickable `div` or `span`. No `tabindex` above 0. |
| Ids | Page ids are unique. Every `for`, `aria-labelledby` and `aria-describedby` target exists. |
| Lists | Cards are `article` elements inside `li` elements inside a `ul`. |
| Time | Due dates use `<time>` with a valid `datetime`. |
| Errors | `role="alert"` and tied to the field with `aria-describedby`; the control has `aria-invalid="true"`. |
| Card actions | The accessible name of every card button contains the task title. |
| New controls | `Sort by`, `Clear completed` and the shortcuts follow the same rules: real labels, explicit button `type`, no extra roles. |

---

## 10. Styles

Plain CSS in four files under `src/styles/`, all imported from `main.tsx`:

| File | Content |
|---|---|
| `variables.css` | `:root` custom properties: **at least 12**, including at least 5 colour properties, 3 spacing properties and a radius |
| `base.css` | Reset (`box-sizing: border-box`), body, headings and form-control defaults, and a `:focus-visible` rule |
| `layout.css` | Page structure: header, main, the board grid, the filter bar |
| `components.css` | Fields, buttons, form, cards, badges, columns |

Rules:

- Colours are written **only** in `variables.css` (hex, `rgb()`, `hsl()`). Elsewhere use `var(--…)`. Use `var(--…)` at least 30 times in total.
- No `!important`. No id selectors. No inline `style` attributes or props.
- Class names are lower-case kebab-case, optionally in BEM form (`card`, `card__title`, `button--primary`). Every class used in a component is defined in the CSS.
- The layout uses CSS grid or flexbox. The board has three columns on wide screens and **stacks to one column** under a `max-width` or `min-width` media query.
- Keyboard focus is visible (`:focus-visible`). Never remove an outline without replacing it.
- Font sizes use `rem`, `em` or variables, not `px`.
- If you use `transition` or `animation`, add a `prefers-reduced-motion` query.

---

## 11. Code quality rules

| Rule | Limit |
|---|---|
| Function length | At most 70 lines (components included) |
| Cyclomatic complexity | At most 12 per function |
| Parameters | At most 4 per function |
| Nesting | No nested ternaries |
| TypeScript | No `any`. No `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck`. No non-null assertions (`!`). At most 2 `as` type assertions in the whole source (`as const` is free). No `enum`. No `Function` or `object` types. |
| Return types | Exported functions in `state/`, `utils/`, `hooks/` declare their return type |
| Props | Each component types its props with a named `interface` or `type`. No `React.FC`. |
| Imports | Type-only imports use `import type` |
| Leftovers | No `console.*`, `TODO`, `FIXME`, `debugger` or commented-out code |
| Duplication | No block of 8 or more identical lines repeated anywhere |
| Dead code | No exported function or constant that nothing uses (except the public API named in this spec) |
| DOM access | No `dangerouslySetInnerHTML`, no `document.querySelector` or `getElementById` anywhere except `hooks/useGlobalShortcuts.ts` |
| Handlers | Inline handlers have at most 3 statements; name longer ones |
| Naming | Components PascalCase, hooks `useX`, other files camelCase |

---

## 12. Tests you must write

Write your own tests with Vitest and React Testing Library. They are scored on **quality**, not only on passing.

### 12.1 Required files and sizes

| File | Minimum number of tests |
|---|---|
| `src/state/taskReducer.test.ts` | 10 |
| `src/state/selectors.test.ts` | 5 |
| `src/utils/date.test.ts` | 6 |
| `src/components/TaskForm.test.tsx` | 5 |
| `src/App.test.tsx` | 6 |

### 12.2 Quality rules

1. **Test the spec through its public surface.** Your tests must also pass against a different, correct implementation of this spec. In practice: use the paths, exports, labels and messages in this document, and nothing private. Render the app as `<TaskProvider initialTasks={…}><App /></TaskProvider>`.
2. **Query like a user.** Use `getByRole`, `getByLabelText`, `getByText` and the matching `queryBy` / `findBy` / `getAllBy` forms. Never `getByTestId`, `querySelector`, `container`, `.children` or `innerHTML`.
3. **Use `@testing-library/user-event`**, not `fireEvent`. **`await` every user-event call.**
4. **Every test asserts something**, on average at least 1.5 assertions per test. Avoid weak matchers (`toBeTruthy`, `toBeFalsy`, `toBeDefined`, `not.toBeNull`) as more than 20% of your assertions. No snapshot tests. No tautologies such as `expect(true).toBe(true)`.
5. **No `.skip`, `.only` or `.todo`.**
6. **Describe behaviour in the name**: at least 4 words and 20 characters, in the form "does X when Y". Group related tests in `describe` blocks once a file has 6 or more.
7. **Cover the edges.** Your test names should cover at least 7 of these themes: empty or blank input; whitespace and trimming; exact boundaries (80 vs 81 characters); no-op actions returning the same reference; immutability (frozen input); overdue, past and today; Escape and cancel; unknown or missing ids; case-insensitive search; clearing and resetting.
8. **Reducer tests** exercise all nine action types and check reference stability and immutability, not only values. The two newest actions (`tasks/doneCleared`, `filters/sortChanged`) may be tested in any of your test files.
9. **Form tests** assert all three validation messages.
10. **Control time.** Tests that depend on today use `vi.useFakeTimers({ toFake: ['Date'] })` plus `vi.setSystemTime(…)`, or fixed `new Date(2026, …)` values, and restore real timers (`vi.useRealTimers()`). Restore spies and stubs (`vi.restoreAllMocks()`).
11. Tests must not depend on the real clock or the machine's time zone.
12. **Cover the three newer features** with at least 3 tests each: sorting (including a tie or an undated task), `Clear completed` (including a done task hidden by a filter) and the keyboard shortcuts (including a key press inside a field). Test names must mention `sort`, `clear completed` and `shortcut` or `keyboard` so they can be found.

---

## 13. How the result is scored

The score is out of 100. Every check is automated. The hidden suite is not shown to the model, but every rule it checks is in this document.

| Category | Points | What it measures |
|---|---|---|
| Requirements completeness | 25 | Every feature, label, message and rule above works as written |
| Behaviour and edge cases | 18 | Boundaries, no-ops, time zones, keyboard use, stable keys, error clearing, sort ties |
| State design and render efficiency | 14 | No derived state, no sync effects, reference stability, at most one commit per user action, form state kept local, one clean listener |
| Architecture and modularity | 10 | File layout, layers, no cycles, file size, pure logic modules, thin entry points, library list, build passes |
| TypeScript quality | 8 | Strict mode, zero `tsc` errors, no `any`, unions, exhaustive reducer, typed props |
| Code quality | 7 | Function size and complexity, duplication, keys, leftovers, naming, dead code |
| Styles, HTML and accessibility | 5 | The four stylesheets, variables, responsive layout, semantic HTML, names, ids |
| Quality of your own tests | 13 | Required files and counts, user-facing queries, awaited events, edge themes, and the dynamic checks in section 13.2 |

### 13.1 The marking is steep

- **Each category is curved.** A category earns `points x (share of checks passed) ^ 3`, weighted by check. Passing 90% of a category's checks earns about 73% of its points, and 80% earns about 51%.
- **Hard caps apply to the total**, after the curve:

| Situation | Total can be at most |
|---|---|
| `vite build` fails | 60 |
| `tsc --noEmit` reports errors | 85 |
| A rule of the run (section 14) was broken | 50 |

### 13.2 How your own tests are judged dynamically

1. **They pass on your code.** All of them, and at least 20 exist.
2. **They pass on a reference solution.** Your test files are copied onto a known-good implementation of this spec. A test that only works on your own private structure fails here.
3. **They catch bugs.** About 45 small bugs are injected one at a time into the reference solution (a wrong sort order, an off-by-one limit, a mutated array, a missing confirmation step, a shortcut that types its letter, and so on). A bug counts as caught when one of your tests fails because of it. Catching 85% or more earns full marks for this part.

---

## 14. Rules of the run

These rules describe how you work, not what you build. They are checked afterwards from the log of your session.

1. **One pass.** Write the whole project once. Do **not** run anything that executes the project or its tools: no `npm install`, `npm test`, `npm run build`, `npm run typecheck`, `tsc`, `vitest`, `vite`, `node` or `npx`. There is no run, check, fix loop. You may read and write files, and you may re-read what you wrote. The dependencies are already installed in the scorer, at the versions in section 2.2.1, and the scorer runs everything itself.
2. **At most 3 sub-agents in total**, counting any started by other sub-agents. If you use none, that is fine.
3. **An orchestrator does not write the project files itself.** It plans, shares the interfaces between the pieces, and hands the writing to its sub-agents. If you work alone, you write the files yourself.
4. Do not read anything outside your working folder.
