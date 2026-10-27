import { Field } from './Field'

interface LabelsFieldProps {
  id: string
  value: string
  error?: string
  onChange: (value: string) => void
}

export function LabelsField({ id, value, error, onChange }: LabelsFieldProps) {
  return (
    <Field id={id} label="Labels" error={error}>
      <input
        id={id}
        className="field__control"
        type="text"
        value={value}
        aria-invalid={error !== undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}
