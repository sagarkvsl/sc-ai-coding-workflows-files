import { useState, type FormEvent } from 'react'

const TAGS = ['debugging', 'refactor', 'testing', 'review']

type AddPromptFormProps = {
  onAdd: (input: { title: string; text: string; tag: string }) => void
}

export default function AddPromptForm({ onAdd }: AddPromptFormProps) {
  const [title, setTitle] = useState('')
  const [tag, setTag] = useState(TAGS[0])
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors: string[] = []
    if (title.trim() === '') nextErrors.push('Title is required.')
    if (text.trim() === '') nextErrors.push('Prompt text is required.')
    setErrors(nextErrors)
    if (nextErrors.length > 0) return

    onAdd({ title: title.trim(), text: text.trim(), tag })
    setTitle('')
    setTag(TAGS[0])
    setText('')
  }

  return (
    <form className="add-form" onSubmit={handleSubmit} noValidate>
      <h2>Add a prompt</h2>

      <label htmlFor="prompt-title">Title</label>
      <input
        id="prompt-title"
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <label htmlFor="prompt-tag">Tag</label>
      <select
        id="prompt-tag"
        value={tag}
        onChange={(event) => setTag(event.target.value)}
      >
        {TAGS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <label htmlFor="prompt-text">Prompt text</label>
      <textarea
        id="prompt-text"
        rows={4}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      {errors.map((error) => (
        <p key={error} role="alert" className="error">
          {error}
        </p>
      ))}

      <button type="submit" className="button">
        Add prompt
      </button>
    </form>
  )
}
