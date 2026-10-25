import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { seedPrompts } from '../data/seedPrompts'
import PantryPage from './PantryPage'

describe('PantryPage', () => {
  it('shows the heading', () => {
    render(<PantryPage prompts={seedPrompts} onAdd={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'The Pantry' })).toBeInTheDocument()
  })

  it('shows the title of a seed prompt', () => {
    render(<PantryPage prompts={seedPrompts} onAdd={vi.fn()} />)
    expect(screen.getByText(seedPrompts[0].title)).toBeInTheDocument()
  })

  it('renders one card per prompt', () => {
    render(<PantryPage prompts={seedPrompts} onAdd={vi.fn()} />)
    expect(screen.getAllByRole('article')).toHaveLength(seedPrompts.length)
  })

  it('shows the empty-shelf message when there are no prompts', () => {
    render(<PantryPage prompts={[]} onAdd={vi.fn()} />)
    expect(
      screen.getByText('Your shelf is empty. Add the first prompt.'),
    ).toBeInTheDocument()
    expect(screen.queryAllByRole('article')).toHaveLength(0)
  })
})
