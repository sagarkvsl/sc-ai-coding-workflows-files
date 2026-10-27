import { useTasks } from '../hooks/useTasks'
import { SORT_KEYS, SORT_LABELS } from '../types/task'
import { isSortKey } from '../utils/guards'

export function SortSelect() {
  const { filters, setSort } = useTasks()

  return (
    <div className="field">
      <label className="field__label" htmlFor="sort-by">
        Sort by
      </label>
      <select
        id="sort-by"
        className="field__control"
        value={filters.sort}
        onChange={(event) => {
          if (isSortKey(event.target.value)) setSort(event.target.value)
        }}
      >
        {SORT_KEYS.map((key) => (
          <option key={key} value={key}>
            {SORT_LABELS[key]}
          </option>
        ))}
      </select>
    </div>
  )
}
