import { useId } from 'react'
import type { Ref } from 'react'
import { PRIORITIES, PRIORITY_LABELS } from '../types/task'
import type { TaskDraft } from '../types/task'
import { isPriority } from '../utils/guards'
import type { TaskErrors } from '../utils/validation'
import { Field } from './Field'
import { LabelsField } from './LabelsField'

interface TaskFieldsProps {
  draft: TaskDraft
  errors: TaskErrors
  onChange: <K extends keyof TaskDraft>(field: K, value: TaskDraft[K]) => void
  titleRef?: Ref<HTMLInputElement>
  titleId?: string
}

export function TaskFields({
  draft,
  errors,
  onChange,
  titleRef,
  titleId: fixedTitleId,
}: TaskFieldsProps) {
  const id = useId()
  const titleId = fixedTitleId ?? `${id}-title`
  const dueDateId = `${id}-due-date`
  const labelsId = `${id}-labels`

  return (
    <>
      <Field id={titleId} label="Title" error={errors.title}>
        <input
          id={titleId}
          ref={titleRef}
          className="field__control"
          type="text"
          value={draft.title}
          aria-invalid={errors.title !== undefined}
          aria-describedby={errors.title ? `${titleId}-error` : undefined}
          onChange={(event) => onChange('title', event.target.value)}
        />
      </Field>
      <Field id={`${id}-description`} label="Description">
        <textarea
          id={`${id}-description`}
          className="field__control"
          rows={3}
          value={draft.description}
          onChange={(event) => onChange('description', event.target.value)}
        />
      </Field>
      <LabelsField
        id={labelsId}
        value={draft.labels}
        error={errors.labels}
        onChange={(value) => onChange('labels', value)}
      />
      <Field id={`${id}-priority`} label="Priority">
        <select
          id={`${id}-priority`}
          className="field__control"
          value={draft.priority}
          onChange={(event) => {
            if (isPriority(event.target.value)) {
              onChange('priority', event.target.value)
            }
          }}
        >
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABELS[priority]}
            </option>
          ))}
        </select>
      </Field>
      <Field id={dueDateId} label="Due date" error={errors.dueDate}>
        <input
          id={dueDateId}
          className="field__control"
          type="date"
          value={draft.dueDate}
          aria-invalid={errors.dueDate !== undefined}
          aria-describedby={errors.dueDate ? `${dueDateId}-error` : undefined}
          onChange={(event) => onChange('dueDate', event.target.value)}
        />
      </Field>
    </>
  )
}
