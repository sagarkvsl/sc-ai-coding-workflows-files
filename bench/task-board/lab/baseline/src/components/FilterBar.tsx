import type { KeyboardEvent } from 'react'
import { useTasks } from '../hooks/useTasks'
import { DEFAULT_FILTERS, PRIORITIES, PRIORITY_LABELS } from '../types/task'
import { SEARCH_FIELD_ID } from '../utils/fieldIds'
import { isPriorityFilter } from '../utils/guards'
import { SortSelect } from './SortSelect'

export function FilterBar() {
  const { filters, setQuery, setPriority, clearFilters } = useTasks()
  const isDefault =
    filters.query === DEFAULT_FILTERS.query &&
    filters.priority === DEFAULT_FILTERS.priority

  function clearOnEscape(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && filters.query !== '') setQuery('')
  }

  return (
    <section className="filters" aria-label="Filters">
      <div className="field">
        <label className="field__label" htmlFor={SEARCH_FIELD_ID}>
          Search tasks
        </label>
        <input
          id={SEARCH_FIELD_ID}
          className="field__control"
          type="search"
          value={filters.query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={clearOnEscape}
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="filter-priority">
          Filter by priority
        </label>
        <select
          id="filter-priority"
          className="field__control"
          value={filters.priority}
          onChange={(event) => {
            if (isPriorityFilter(event.target.value)) {
              setPriority(event.target.value)
            }
          }}
        >
          <option value="all">All priorities</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABELS[priority]}
            </option>
          ))}
        </select>
      </div>
      <SortSelect />
      <button
        type="button"
        className="button"
        disabled={isDefault}
        onClick={clearFilters}
      >
        Clear filters
      </button>
    </section>
  )
}
