import type { Prompt } from '../types'

type PromptCardProps = {
  prompt: Prompt
}

export default function PromptCard({ prompt }: PromptCardProps) {
  return (
    <article className="card">
      <header className="card-header">
        <h3>{prompt.title}</h3>
        <span className="badge">{prompt.tag}</span>
      </header>
      <time className="card-date" dateTime={prompt.createdAt.toISOString()}>
        {prompt.createdAt.toLocaleDateString()}
      </time>
      <p className="card-text">{prompt.text}</p>
    </article>
  )
}
