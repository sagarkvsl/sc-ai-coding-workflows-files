import { useState } from 'react'
import { Route, Routes } from 'react-router'
import Navbar from './components/Navbar'
import { seedPrompts } from './data/seedPrompts'
import HomePage from './pages/HomePage'
import PantryPage from './pages/PantryPage'
import type { Prompt } from './types'

export default function App() {
  const [prompts, setPrompts] = useState<Prompt[]>(seedPrompts)

  function addPrompt(input: { title: string; text: string; tag: string }) {
    const prompt: Prompt = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    }
    setPrompts((current) => [prompt, ...current])
  }

  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/pantry"
            element={<PantryPage prompts={prompts} onAdd={addPrompt} />}
          />
        </Routes>
      </main>
    </>
  )
}
