import { Link } from 'react-router'

export default function HomePage() {
  return (
    <section className="hero">
      <h1>Stock your shelf. Share a prompt.</h1>
      <p>
        Prompt Pantry is a shared shelf where developers keep the prompts that
        actually work. Browse what others have stocked, then add one of your own.
      </p>
      <Link to="/pantry" className="button">
        Open the pantry
      </Link>
    </section>
  )
}
