import AddPromptForm from '../components/AddPromptForm'
import PromptCard from '../components/PromptCard'
import type { Prompt } from '../types'

type PantryPageProps = {
  prompts: Prompt[]
  onAdd: (input: { title: string; text: string; tag: string }) => void
}

export default function PantryPage({ prompts, onAdd }: PantryPageProps) {
  return (
    <section className="pantry">
      <h1>The Pantry</h1>
      {prompts.length === 0 ? (
        <p className="empty">Your shelf is empty. Add the first prompt.</p>
      ) : (
        <div className="card-grid">
          {prompts.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} />
          ))}
        </div>
      )}
      <AddPromptForm onAdd={onAdd} />
    </section>
  )
}
