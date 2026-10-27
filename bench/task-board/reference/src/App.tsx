import { Board } from './components/Board'
import { FilterBar } from './components/FilterBar'
import { Header } from './components/Header'
import { Shortcuts } from './components/Shortcuts'
import { TaskForm } from './components/TaskForm'

export function App() {
  return (
    <>
      <Header />
      <Shortcuts />
      <main className="main">
        <TaskForm />
        <FilterBar />
        <Board />
      </main>
    </>
  )
}
