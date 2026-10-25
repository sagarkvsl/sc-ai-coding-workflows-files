import { NavLink } from 'react-router'

export default function Navbar() {
  return (
    <header className="navbar">
      <span className="brand">Prompt Pantry</span>
      <nav className="nav-links">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/pantry">Pantry</NavLink>
      </nav>
    </header>
  )
}
