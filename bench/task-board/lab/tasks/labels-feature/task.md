# Task: add labels to tasks

Add free-form **labels** (tags) to tasks. Follow the house rules in `README.md`. Everything below is exact.

## Data
- `Task` gets a required `labels: string[]`. `TaskInput` also carries `labels: string[]`. `TaskDraft` carries `labels: string`, the raw comma-separated text.
- New file `src/utils/labels.ts` exports `parseLabels(text: string): string[]`: split on commas, trim each part, drop empty parts, and remove duplicates ignoring case (the first spelling and the first position win). Example: `' Bug, ui ,bug,, UI '` becomes `['Bug', 'ui']`.
- Limits: at most **5** labels and each label at most **20** characters. Define them once as constants.

## Forms (add form and edit form, the same fields component)
- A text input labelled `Labels`, placed after `Description` (order: Title, Description, Labels, Priority, Due date).
- Submitting sends `labels: parseLabels(text)`. The add form clears it after a successful add. The edit form is pre-filled with the task's labels joined by `, `.
- Validation, shown like the other field errors (`role="alert"`, the input gets `aria-invalid="true"` and `aria-describedby`, the error disappears when the field changes):
  - more than 5 labels: `Use at most 5 labels.`
  - a label longer than 20 characters: `Each label must be 20 characters or fewer.`
  - if both apply, show only the first message above.
  - validation applies to both forms and blocks the submit.

## Card
When a task has labels, its card shows `<ul aria-label="Labels">` with one `<li>` per label (the label text). No list when there are no labels.

## State
- `Filters` gets `label: string` (`''` means all labels). `DEFAULT_FILTERS` becomes `{ query: '', priority: 'all', sort: 'created', label: '' }`.
- New action `{ type: 'filters/labelChanged'; label: string }`.
- `filters/cleared` resets the query, the priority **and the label**, and still keeps the sort. It stays a no-op (same state object) when they are already default.
- `selectVisibleTasks` also applies the label filter: a task passes when one of its labels equals the filter, ignoring case. The text query now also matches labels: each label is tested separately, as a lower-case substring.
- New selector `selectLabels(tasks: Task[]): string[]` in `src/state/selectors.ts`: every distinct label across **all** the tasks it is given (not only visible ones), distinct ignoring case with the first spelling kept, sorted alphabetically ignoring case.
- **Invariant:** after `task/updated`, `task/deleted` or `tasks/doneCleared` changes the tasks, if `filters.label` is not `''` and no remaining task has that label (ignoring case), the reducer resets `filters.label` to `''` in the same step. Actions that change nothing still return the same state object.
- A `task/updated` whose `labels` has the same entries in the same order as before is a no-op (same state object).

## Hook and filter bar
- `useTasks()` also returns `labels: string[]` (`selectLabels` over all tasks, memoised) and `setLabel(label: string)`. Like every other handler, `setLabel` keeps its identity.
- The filter bar gets a select labelled `Filter by label`. First option `All labels` (value `''`), then one option per label from `labels`.
- `Clear filters` is disabled only when the query is `''`, the priority is `all` **and** the label is `''` (the sort still does not matter).

Update the existing tests so they compile and pass with the new required field. Add tests for the new behaviour if you can.
