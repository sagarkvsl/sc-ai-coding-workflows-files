import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from './App'
import { seedPrompts } from './data/seedPrompts'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('Home page', () => {
  it('shows the tagline', () => {
    renderAt('/')
    expect(screen.getByText('Stock your shelf. Share a prompt.')).toBeInTheDocument()
  })

  it('has Home and Pantry links in the navbar', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pantry' })).toBeInTheDocument()
  })
})

describe('Add prompt form', () => {
  it('adds a card for a valid prompt', async () => {
    const user = userEvent.setup()
    renderAt('/pantry')

    await user.type(screen.getByLabelText('Title'), 'Explain this regex')
    await user.type(screen.getByLabelText('Prompt text'), 'Explain it step by step.')
    await user.click(screen.getByRole('button', { name: 'Add prompt' }))

    expect(screen.getByText('Explain this regex')).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(seedPrompts.length + 1)
  })

  it('shows an error and adds no card when the title is empty', async () => {
    const user = userEvent.setup()
    renderAt('/pantry')

    await user.type(screen.getByLabelText('Prompt text'), 'Some text')
    await user.click(screen.getByRole('button', { name: 'Add prompt' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Title is required.')
    expect(screen.getAllByRole('article')).toHaveLength(seedPrompts.length)
  })

  it('shows an error and adds no card when the prompt text is empty', async () => {
    const user = userEvent.setup()
    renderAt('/pantry')

    await user.type(screen.getByLabelText('Title'), 'A title')
    await user.click(screen.getByRole('button', { name: 'Add prompt' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Prompt text is required.')
    expect(screen.getAllByRole('article')).toHaveLength(seedPrompts.length)
  })

  it('clears the form after a valid submit', async () => {
    const user = userEvent.setup()
    renderAt('/pantry')

    await user.type(screen.getByLabelText('Title'), 'A title')
    await user.type(screen.getByLabelText('Prompt text'), 'Some text')
    await user.click(screen.getByRole('button', { name: 'Add prompt' }))

    expect(screen.getByLabelText('Title')).toHaveValue('')
    expect(screen.getByLabelText('Prompt text')).toHaveValue('')
  })
})
