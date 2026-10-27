// Seven defects planted into the labels solution. `find` is the correct code, `replace` the planted bug.
export const DEFECTS = [
  {
    id: 'reset-is-case-sensitive',
    file: 'src/state/taskReducer.ts',
    find: '!tasks.some((task) => hasLabel(task.labels, label))',
    replace: '!tasks.some((task) => task.labels.includes(label))',
    issue: 'the stale-label reset compares labels case-sensitively, so the filter resets while a task with a differently cased label remains',
  },
  {
    id: 'same-length-update-ignored',
    file: 'src/state/taskReducer.ts',
    find: '    next.labels.length === task.labels.length &&\n    next.labels.every((label, i) => label === task.labels[i])',
    replace: '    next.labels.length === task.labels.length',
    issue: 'an update that replaces labels with the same number of different labels is treated as a no-op',
  },
  {
    id: 'dedupe-is-case-sensitive',
    file: 'src/utils/labels.ts',
    find: 'const key = label.toLowerCase()\n    if (label',
    replace: 'const key = label\n    if (label',
    issue: 'parseLabels removes duplicates case-sensitively, so Bug and bug both stay',
  },
  {
    id: 'labels-from-visible-tasks',
    file: 'src/hooks/useTasks.ts',
    find: 'useMemo(() => selectLabels(state.tasks), [state.tasks])',
    replace: 'useMemo(() => selectLabels(visible), [visible])',
    issue: 'the label options are built from the visible tasks only, so choosing a filter makes the other options disappear',
  },
  {
    id: 'empty-list-rendered',
    file: 'src/components/TaskCard.tsx',
    find: '{task.labels.length > 0 && (',
    replace: '{task.labels && (',
    issue: 'an array is always truthy, so a card with no labels still renders an empty Labels list',
  },
  {
    id: 'limit-off-by-one',
    file: 'src/utils/validation.ts',
    find: 'if (labels.length > MAX_LABELS) return TOO_MANY_LABELS',
    replace: 'if (labels.length >= MAX_LABELS) return TOO_MANY_LABELS',
    issue: 'five labels are rejected although the limit is at most five',
  },
  {
    id: 'query-matches-across-labels',
    file: 'src/state/selectors.ts',
    find: 'task.labels.some((item) => item.toLowerCase().includes(query))',
    replace: "task.labels.join(' ').toLowerCase().includes(query)",
    issue: 'the text query is tested against all labels joined together, so it can match across the gap between two labels',
  },
]
