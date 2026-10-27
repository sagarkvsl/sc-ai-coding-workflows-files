import { useTasks } from '../hooks/useTasks'

export function LabelSelect() {
  const { filters, labels, setLabel } = useTasks()

  return (
    <div className="field">
      <label className="field__label" htmlFor="filter-label">
        Filter by label
      </label>
      <select
        id="filter-label"
        className="field__control"
        value={filters.label}
        onChange={(event) => setLabel(event.target.value)}
      >
        <option value="">All labels</option>
        {labels.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}
