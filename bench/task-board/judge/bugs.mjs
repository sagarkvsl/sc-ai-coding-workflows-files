// Bug catalogue for judging the tests a model wrote.
//
// Each bug is a small edit to the REFERENCE solution. The scorer runs the model's
// own test files against the clean reference (they must pass) and then against
// each buggy copy. A bug is "killed" when a test that passed on the clean
// reference now fails. Every bug breaks one rule of spec.md.
//
// `edits` are exact find/replace pairs; each `find` must occur exactly once.

export const BUGS = [
  // ---- reducer ---------------------------------------------------------
  {
    id: 'reducer-append-instead-of-prepend',
    rule: 'new tasks go to the top',
    edits: [{
      file: 'src/state/taskReducer.ts',
      find: 'return { ...state, tasks: [action.task, ...state.tasks] }',
      replace: 'return { ...state, tasks: [...state.tasks, action.task] }',
    }],
  },
  {
    id: 'reducer-mutates-input-array',
    rule: 'the reducer never mutates its input',
    edits: [{
      file: 'src/state/taskReducer.ts',
      find: 'const tasks = state.tasks.map((task, i) => (i === index ? updated : task))',
      replace: 'state.tasks[index] = updated\n  const tasks = [...state.tasks]',
    }],
  },
  {
    id: 'reducer-noop-move-new-reference',
    rule: 'a no-op returns the same state reference',
    edits: [{
      file: 'src/state/taskReducer.ts',
      find: 'task.status === action.status ? task : { ...task, status: action.status },',
      replace: '({ ...task, status: action.status }),',
    }],
  },
  {
    id: 'reducer-delete-unknown-new-reference',
    rule: 'deleting an unknown id returns the same state',
    edits: [{
      file: 'src/state/taskReducer.ts',
      find: "const tasks = state.tasks.filter((task) => task.id !== action.id)\n      return tasks.length === state.tasks.length ? state : { ...state, tasks }",
      replace: "const tasks = state.tasks.filter((task) => task.id !== action.id)\n      return { ...state, tasks }",
    }],
  },
  {
    id: 'reducer-clear-keeps-priority',
    rule: 'filters/cleared resets both filters',
    edits: [{
      file: 'src/state/taskReducer.ts',
      find: "      return setFilters(state, {\n        query: DEFAULT_FILTERS.query,\n        priority: DEFAULT_FILTERS.priority,\n      })",
      replace: "      return setFilters(state, { query: '' })",
    }],
  },
  {
    id: 'reducer-update-rewrites-all-tasks',
    rule: 'untouched tasks keep their identity',
    edits: [{
      file: 'src/state/taskReducer.ts',
      find: 'const tasks = state.tasks.map((task, i) => (i === index ? updated : task))',
      replace: 'const tasks = state.tasks.map((task, i) => (i === index ? updated : { ...task }))',
    }],
  },
  // ---- selectors -------------------------------------------------------
  {
    id: 'select-title-case-sensitive',
    rule: 'search ignores case',
    edits: [{
      file: 'src/state/selectors.ts',
      find: 'task.title.toLowerCase().includes(query) ||',
      replace: 'task.title.includes(query) ||',
    }],
  },
  {
    id: 'select-query-not-trimmed',
    rule: 'the query is trimmed',
    edits: [{
      file: 'src/state/selectors.ts',
      find: 'state.filters.query.trim().toLowerCase()',
      replace: 'state.filters.query.toLowerCase()',
    }],
  },
  {
    id: 'select-ignores-description',
    rule: 'search matches the description too',
    edits: [{
      file: 'src/state/selectors.ts',
      find: "task.title.toLowerCase().includes(query) ||\n      task.description.toLowerCase().includes(query)",
      replace: 'task.title.toLowerCase().includes(query)',
    }],
  },
  {
    id: 'select-filters-or-instead-of-and',
    rule: 'query and priority combine with AND',
    edits: [{
      file: 'src/state/selectors.ts',
      find: 'return matchesPriority && matchesQuery',
      replace: 'return matchesPriority || matchesQuery',
    }],
  },
  {
    id: 'select-group-reverses-order',
    rule: 'grouping keeps input order',
    edits: [{
      file: 'src/state/selectors.ts',
      find: 'for (const task of tasks) {',
      replace: 'for (const task of [...tasks].reverse()) {',
    }],
  },
  // ---- dates -----------------------------------------------------------
  {
    id: 'date-today-counts-as-past',
    rule: 'today is not in the past',
    edits: [{
      file: 'src/utils/date.ts',
      find: 'dueDate < toIsoDate(today)',
      replace: 'dueDate <= toIsoDate(today)',
    }],
  },
  {
    id: 'date-done-can-be-overdue',
    rule: 'a done task is never overdue',
    edits: [{
      file: 'src/utils/date.ts',
      find: "dueDate !== null && status !== 'done' && isPastDate(dueDate, today)",
      replace: 'dueDate !== null && isPastDate(dueDate, today)',
    }],
  },
  {
    id: 'date-iso-uses-utc',
    rule: 'toIsoDate uses the local calendar date',
    edits: [{
      file: 'src/utils/date.ts',
      find: "const month = String(date.getMonth() + 1).padStart(2, '0')\n  const day = String(date.getDate()).padStart(2, '0')\n  return `${date.getFullYear()}-${month}-${day}`",
      replace: 'return date.toISOString().slice(0, 10)',
    }],
  },
  {
    id: 'date-format-pads-day',
    rule: 'the day is not zero-padded',
    edits: [{
      file: 'src/utils/date.ts',
      find: 'return `Due ${Number(day)} ${monthName} ${year}`',
      replace: 'return `Due ${day} ${monthName} ${year}`',
    }],
  },
  {
    id: 'date-format-month-off-by-one',
    rule: 'months are named correctly',
    edits: [{
      file: 'src/utils/date.ts',
      find: 'MONTHS[Number(month) - 1]',
      replace: 'MONTHS[Number(month)]',
    }],
  },
  {
    id: 'date-format-parses-as-utc',
    rule: 'formatting never shifts the day',
    edits: [{
      file: 'src/utils/date.ts',
      find: "const [, year, month, day] = match\n  const monthName = MONTHS[Number(month) - 1]\n  if (monthName === undefined) return dueDate\n  return `Due ${Number(day)} ${monthName} ${year}`",
      replace: "const parsed = new Date(dueDate)\n  return `Due ${parsed.getDate()} ${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`",
    }],
  },
  // ---- validation and forms --------------------------------------------
  {
    id: 'form-title-not-trimmed',
    rule: 'a whitespace-only title is empty',
    edits: [{
      file: 'src/utils/validation.ts',
      find: 'const title = draft.title.trim()',
      replace: 'const title = draft.title',
    }],
  },
  {
    id: 'form-title-limit-off-by-one',
    rule: 'exactly 80 characters is allowed',
    edits: [{
      file: 'src/utils/validation.ts',
      find: 'title.length > MAX_TITLE_LENGTH',
      replace: 'title.length >= MAX_TITLE_LENGTH',
    }],
  },
  {
    id: 'form-past-due-date-allowed',
    rule: 'a past due date is rejected when adding',
    edits: [{
      file: 'src/utils/validation.ts',
      find: 'checkDueDate && isPastDate(draft.dueDate, today)',
      replace: "checkDueDate && draft.dueDate === 'never'",
    }],
  },
  {
    id: 'form-not-reset-after-add',
    rule: 'the form resets after a successful add',
    edits: [{
      file: 'src/components/TaskForm.tsx',
      find: 'reset(EMPTY_DRAFT)\n    titleRef',
      replace: 'reset({ ...draft })\n    titleRef',
    }],
  },
  {
    id: 'form-focus-not-returned',
    rule: 'focus returns to Title after adding',
    edits: [{
      file: 'src/components/TaskForm.tsx',
      find: 'titleRef.current?.focus()',
      replace: 'void titleRef',
    }],
  },
  {
    id: 'form-errors-never-clear-on-typing',
    rule: 'an error clears when its field changes',
    edits: [{
      file: 'src/hooks/useTaskDraft.ts',
      find: 'field in current ? { ...current, [field]: undefined } : current,',
      replace: 'current,',
    }],
  },
  {
    id: 'form-error-not-announced',
    rule: 'errors use role="alert"',
    edits: [{
      file: 'src/components/Field.tsx',
      find: 'className="field__error" role="alert"',
      replace: 'className="field__error"',
    }],
  },
  // ---- cards -----------------------------------------------------------
  {
    id: 'edit-allows-empty-title',
    rule: 'the edit form validates the title',
    edits: [{
      file: 'src/components/TaskEditForm.tsx',
      find: 'const found = validateDraft(draft, new Date(), false)',
      replace: 'const found = {}',
    }],
  },
  {
    id: 'edit-blocks-past-due-date',
    rule: 'editing may keep a past due date',
    edits: [{
      file: 'src/components/TaskEditForm.tsx',
      find: 'const found = validateDraft(draft, new Date(), false)',
      replace: 'const found = validateDraft(draft, new Date(), true)',
    }],
  },
  {
    id: 'edit-escape-does-nothing',
    rule: 'Escape cancels editing',
    edits: [{
      file: 'src/components/TaskEditForm.tsx',
      find: "event.key === 'Escape'",
      replace: "event.key === 'Esc'",
    }],
  },
  {
    id: 'card-key-is-array-index',
    rule: 'cards are keyed by id so local state follows the card',
    edits: [
      { file: 'src/components/TaskColumn.tsx', find: '{tasks.map((task) => (', replace: '{tasks.map((task, index) => (' },
      { file: 'src/components/TaskColumn.tsx', find: '<li key={task.id} className="column__item">', replace: '<li key={index} className="column__item">' },
    ],
  },
  {
    id: 'card-overdue-ignores-status',
    rule: 'done tasks are not overdue',
    edits: [{
      file: 'src/components/TaskCard.tsx',
      find: 'isOverdue(task.dueDate, task.status, new Date())',
      replace: "isOverdue(task.dueDate, 'todo', new Date())",
    }],
  },
  {
    id: 'card-delete-skips-confirmation',
    rule: 'delete asks for confirmation',
    edits: [{
      file: 'src/components/TaskCardActions.tsx',
      find: 'onClick={() => setIsConfirming(true)}',
      replace: 'onClick={() => deleteTask(task.id)}',
    }],
  },
  // ---- board, header, filters ------------------------------------------
  {
    id: 'header-counts-swapped',
    rule: '"Showing <visible> of <total>"',
    edits: [{
      file: 'src/components/Header.tsx',
      find: 'Showing {visibleCount} of {total}',
      replace: 'Showing {total} of {visibleCount}',
    }],
  },
  {
    id: 'board-no-match-message-missing',
    rule: '"No tasks match your filters."',
    edits: [{
      file: 'src/components/Board.tsx',
      find: "if (visibleCount === 0) return 'No tasks match your filters.'",
      replace: 'if (visibleCount === 0) return null',
    }],
  },
  {
    id: 'filter-clear-always-enabled',
    rule: 'Clear filters is disabled when nothing is filtered',
    edits: [{
      file: 'src/components/FilterBar.tsx',
      find: 'disabled={isDefault}',
      replace: 'disabled={false}',
    }],
  },
  {
    id: 'hook-add-task-constant-id',
    rule: 'every task gets a fresh id',
    edits: [{
      file: 'src/hooks/useTaskActions.ts',
      find: 'id: createId(),',
      replace: "id: 'task',",
    }],
  },
  {
    id: 'hook-add-task-wrong-status',
    rule: 'new tasks start in To do',
    edits: [{
      file: 'src/hooks/useTaskActions.ts',
      find: "status: 'todo',",
      replace: "status: 'doing',",
    }],
  },
  // ---- sort, clear completed, shortcuts ----------------------------------
  {
    id: 'sort-created-oldest-first',
    rule: 'the created sort puts the newest task first',
    edits: [{ file: 'src/state/selectors.ts', find: 'return a.createdAt < b.createdAt ? 1 : -1', replace: 'return a.createdAt < b.createdAt ? -1 : 1' }],
  },
  {
    id: 'sort-due-undated-first',
    rule: 'tasks with no due date sort last',
    edits: [{
      file: 'src/state/selectors.ts',
      find: 'if (a.dueDate === null) return 1\n      if (b.dueDate === null) return -1',
      replace: 'if (a.dueDate === null) return -1\n      if (b.dueDate === null) return 1',
    }],
  },
  {
    id: 'sort-priority-reversed',
    rule: 'the priority sort puts high first',
    edits: [{ file: 'src/state/selectors.ts', find: '{ high: 0, medium: 1, low: 2 }', replace: '{ high: 2, medium: 1, low: 0 }' }],
  },
  {
    id: 'sort-ties-reversed',
    rule: 'sorting is stable: ties keep their input order',
    edits: [{ file: 'src/state/selectors.ts', find: '|| a.index - b.index', replace: '|| b.index - a.index' }],
  },
  {
    id: 'sort-mutates-input',
    rule: 'sortTasks never mutates its input',
    edits: [{ file: 'src/state/selectors.ts', find: '  return tasks\n    .map((task, index)', replace: '  tasks.sort(() => 0)\n  return tasks\n    .map((task, index)' }],
  },
  {
    id: 'sort-default-is-due',
    rule: 'the default sort is newest first',
    edits: [{ file: 'src/types/task.ts', find: "  sort: 'created',\n}", replace: "  sort: 'due',\n}" }],
  },
  {
    id: 'clear-filters-resets-sort',
    rule: 'Clear filters keeps the sort key',
    edits: [{
      file: 'src/state/taskReducer.ts',
      find: '      return setFilters(state, {\n        query: DEFAULT_FILTERS.query,\n        priority: DEFAULT_FILTERS.priority,\n      })',
      replace: '      return setFilters(state, DEFAULT_FILTERS)',
    }],
  },
  {
    id: 'clear-done-also-removes-doing',
    rule: 'Clear completed removes only done tasks',
    edits: [{ file: 'src/state/taskReducer.ts', find: "state.tasks.filter((task) => task.status !== 'done')", replace: "state.tasks.filter((task) => task.status === 'todo')" }],
  },
  {
    id: 'clear-done-noop-new-reference',
    rule: 'a no-op returns the same state reference',
    edits: [{
      file: 'src/state/taskReducer.ts',
      find: "      const tasks = state.tasks.filter((task) => task.status !== 'done')\n      return tasks.length === state.tasks.length ? state : { ...state, tasks }",
      replace: "      const tasks = state.tasks.filter((task) => task.status !== 'done')\n      return { ...state, tasks }",
    }],
  },
  {
    id: 'done-count-follows-filters',
    rule: 'doneCount ignores the filters',
    edits: [{ file: 'src/hooks/useTasks.ts', find: 'useMemo(() => countDone(state.tasks), [state.tasks])', replace: 'useMemo(() => countDone(visible), [visible])' }],
  },
  {
    id: 'clear-completed-never-disabled',
    rule: 'Clear completed is disabled when nothing is done',
    edits: [{ file: 'src/components/Header.tsx', find: '        disabled={doneCount === 0}\n', replace: '' }],
  },
  {
    id: 'shortcut-types-the-letter',
    rule: 'the shortcut key press is swallowed',
    edits: [{ file: 'src/hooks/useGlobalShortcuts.ts', find: '  event.preventDefault()\n  element.focus()', replace: '  element.focus()' }],
  },
  {
    id: 'shortcut-hijacks-typing',
    rule: 'shortcuts are ignored while typing in a field',
    edits: [{ file: 'src/hooks/useGlobalShortcuts.ts', find: '  if (isTypingTarget(event.target)) return\n', replace: '' }],
  },
  {
    id: 'shortcut-ignores-modifier-check',
    rule: 'shortcuts are ignored when Ctrl, Meta or Alt is held',
    edits: [{ file: 'src/hooks/useGlobalShortcuts.ts', find: '  if (event.ctrlKey || event.metaKey || event.altKey) return\n', replace: '' }],
  },
  {
    id: 'shortcut-listener-leaks',
    rule: 'the keydown listener is removed on unmount',
    edits: [{ file: 'src/hooks/useGlobalShortcuts.ts', find: "    return () => document.removeEventListener('keydown', handleKeyDown)\n", replace: '' }],
  },
  {
    id: 'shortcut-n-focuses-search',
    rule: 'n focuses the Title field',
    edits: [{ file: 'src/hooks/useGlobalShortcuts.ts', find: '  n: TITLE_FIELD_ID,', replace: '  n: SEARCH_FIELD_ID,' }],
  },
  {
    id: 'escape-does-not-clear-search',
    rule: 'Escape in the search box clears the query',
    edits: [{ file: 'src/components/FilterBar.tsx', find: "event.key === 'Escape' && filters.query !== ''", replace: "event.key === 'Esc' && filters.query !== ''" }],
  },
]
